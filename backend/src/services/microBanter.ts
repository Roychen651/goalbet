/**
 * microBanter — AI roast fired the moment a Momentum Bets question locks
 * (V4 Sprint 14). Reuses the shared Groq client (callGroq, exported from
 * aiScout.ts) — same single-client discipline as every other AI feature in
 * this codebase (Scout, HT Read, Chronicles, the H2H Provocateur). This is
 * NOT a second Groq call site; it's the same one, a new prompt.
 *
 * AI generates the commentary only, never the question or its resolution —
 * the betting proposition and its outcome are always mechanically determined
 * (fixed templates, score-delta resolution). An LLM never touches anything
 * that moves coins.
 */
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { logger } from '../lib/logger';
import { callGroq } from './aiScout';

interface MicroPick {
  username: string;
  choice: 'yes' | 'no';
}

const SYSTEM_EN = `You are the GoalBet "Locker Room Provocateur" reacting to a live in-play micro-bet that just locked. Given the milestone moment and the conflicting yes/no picks, write EXACTLY TWO short sentences of playful, urgent commentary. Name names. This is happening live, right now — convey that energy. Punchy and teasing, never cruel, never profane. Reply ONLY in English. Max 40 words. Output the banter only, no quotes.`;
const SYSTEM_HE = `אתה ה"מתגרה" של GoalBet, מגיב על ניחוש-בזק חי שזה עתה ננעל. בהינתן רגע הציון (מילסטון) והניחושים המנוגדים (כן/לא), כתוב בדיוק שני משפטים קצרים של פרשנות משועשעת ודחופה. נקוב בשמות. זה קורה עכשיו, בזמן אמת — העבר את האנרגיה הזו. חד ומתגרה, לעולם לא אכזרי ולא גס. השב אך ורק בעברית. עד 40 מילים. החזר את ההתגרות בלבד, בלי מרכאות.`;

const MILESTONE_LABEL: Record<string, { en: string; he: string }> = {
  kickoff: { en: 'kickoff', he: 'פתיחת המשחק' },
  halftime: { en: 'half-time', he: 'המחצית' },
  minute_75: { en: 'the 75th minute', he: 'הדקה ה-75' },
};

async function generateMicroBanterText(
  homeTeam: string,
  awayTeam: string,
  milestone: string,
  picks: MicroPick[],
  lang: 'en' | 'he',
): Promise<string | null> {
  const isHe = lang === 'he';
  const label = MILESTONE_LABEL[milestone] ?? { en: milestone, he: milestone };
  const header = isHe
    ? `רגע: ${isHe ? label.he : label.en} — ${homeTeam} נגד ${awayTeam}\nניחוש-בזק: יגיע שער ב-10 הדקות הקרובות?\nניחושים:`
    : `MOMENT: ${label.en} — ${homeTeam} vs ${awayTeam}\nMICRO-BET: goal in the next 10 minutes?\nPICKS:`;
  const body = picks
    .map(p => `- ${p.username} → ${isHe ? (p.choice === 'yes' ? 'כן' : 'לא') : p.choice.toUpperCase()}`)
    .join('\n');

  return callGroq(
    [
      { role: 'system', content: isHe ? SYSTEM_HE : SYSTEM_EN },
      { role: 'user', content: `${header}\n${body}` },
    ],
    110,
  );
}

/**
 * Fires immediately after a question is locked (called from
 * lockExpiredMicroQuestions, one question at a time). Skips silently if
 * there's no conflict (unanimous picks aren't interesting) or if Groq is
 * unavailable — same graceful-degradation contract as every other AI
 * function in this codebase.
 */
export async function triggerMicroBanter(questionId: string): Promise<void> {
  if (!process.env.GROQ_API_KEY?.trim()) return;

  try {
    const { data: question } = await supabaseAdmin
      .from('micro_prediction_questions')
      .select('id, match_id, group_id, milestone')
      .eq('id', questionId)
      .single();
    if (!question) return;

    const { data: bets } = await supabaseAdmin
      .from('micro_prediction_bets')
      .select('user_id, choice')
      .eq('question_id', questionId);
    if (!bets || bets.length < 2) return;

    const distinctChoices = new Set(bets.map(b => b.choice));
    if (distinctChoices.size < 2) return; // unanimous — nothing to provoke

    const { data: match } = await supabaseAdmin
      .from('matches')
      .select('home_team, away_team')
      .eq('id', question.match_id)
      .single();
    if (!match) return;

    const userIds = [...new Set(bets.map(b => b.user_id))];
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, username')
      .in('id', userIds);
    const nameMap = new Map((profiles ?? []).map(p => [p.id, p.username]));

    const picks: MicroPick[] = bets.map(b => ({
      username: nameMap.get(b.user_id) ?? 'Someone',
      choice: b.choice as 'yes' | 'no',
    }));

    const [en, he] = await Promise.all([
      generateMicroBanterText(match.home_team, match.away_team, question.milestone, picks, 'en'),
      generateMicroBanterText(match.home_team, match.away_team, question.milestone, picks, 'he'),
    ]);
    if (!en) return;

    const { error: insErr } = await supabaseAdmin.from('group_events').insert({
      group_id: question.group_id,
      user_id: null,
      event_type: 'MICRO_BANTER',
      match_id: question.match_id,
      question_id: question.id,
      metadata: {
        text_en: en,
        text_he: he ?? en,
        home_team: match.home_team,
        away_team: match.away_team,
        milestone: question.milestone,
      },
    });

    if (insErr) {
      // Unique-violation on (group_id, question_id) = another worker already
      // posted — same "not a real failure" treatment as aiProvocateur.ts.
      if (!/duplicate|unique/i.test(insErr.message)) {
        logger.warn(`[microBanter] insert failed: ${insErr.message}`);
      }
      return;
    }

    logger.info(`[microBanter] Roast posted for question ${questionId}`);
  } catch (err) {
    logger.warn(`[microBanter] failed for question ${questionId}: ${(err as Error).message}`);
  }
}
