/**
 * AI Provocateur — the "Locker Room" banter engine (V3 Sprint 10).
 *
 * A context-aware sports-pundit persona that reads the conflicting H2H picks in
 * a group and posts witty, provocative banter into the activity feed.
 *
 * Privacy (Sprint 2 / migration 037): predictions are hidden from other members
 * while a match is NS and kickoff is in the future. So banter fires ONLY at
 * kickoff (T-0) or later — once kickoff has passed, picks are already public and
 * revealing them is legal. Never post before kickoff.
 *
 * Reuses the AI Scout Groq client: compute both languages, serve per-viewer,
 * swallow every failure. No Groq key → silent no-op, the feed is untouched.
 */
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { logger } from './../lib/logger';
import { callGroq } from './aiScout';

type Outcome = 'H' | 'D' | 'A';

interface PickRow {
  username: string;
  rank: number | null;
  points: number | null;
  outcome: Outcome;
  homeScore: number | null;
  awayScore: number | null;
}

// Statuses where kickoff has passed (picks public) but the match isn't a dead
// fixture — i.e. just-kicked-off (NS not yet polled) through live/ET/pens.
const LIVE_OR_KICKED = ['NS', '1H', 'HT', '2H', 'ET1', 'ET2', 'AET', 'PEN'];

const SYSTEM_EN = `You are the GoalBet "Locker Room Provocateur" — a witty, sharp football pundit who stirs friendly rivalry between friends in a prediction league. Given their conflicting picks and league standings, write EXACTLY TWO short sentences of playful, provocative banter. Name names. Reference their rank where it lands (the leader betting recklessly, an underdog's bold call). Punchy and teasing, never cruel, never profane. Reply ONLY in English. Max 45 words. Output the banter only, no quotes.`;

const SYSTEM_HE = `אתה ה"מתגרה" של GoalBet — פרשן כדורגל חד ושנון שמלבה יריבות ידידותית בין חברים בליגת ניחושים. בהינתן הניחושים המנוגדים והדירוג, כתוב בדיוק שני משפטים קצרים של התגרות משועשעת ופרובוקטיבית. נקוב בשמות. התייחס לדירוג (המוביל שמהמר בפזיזות, ניחוש נועז של מי שמאחור). חד ומתגרה, לעולם לא אכזרי ולא גס. השב אך ורק בעברית. עד 45 מילים. החזר את ההתגרות בלבד, בלי מרכאות.`;

function pickLine(p: PickRow, homeTeam: string, awayTeam: string, isHe: boolean): string {
  const call = p.outcome === 'H' ? homeTeam : p.outcome === 'A' ? awayTeam : isHe ? 'תיקו' : 'Draw';
  const score = p.homeScore != null && p.awayScore != null ? ` ${p.homeScore}-${p.awayScore}` : '';
  const rank = p.rank != null ? ` (#${p.rank}, ${p.points}${isHe ? ' נק׳' : 'pts'})` : '';
  return `- ${p.username}${rank} → ${call}${score}`;
}

async function generateBanter(
  homeTeam: string,
  awayTeam: string,
  picks: PickRow[],
  lang: 'en' | 'he',
): Promise<string | null> {
  const isHe = lang === 'he';
  const header = isHe ? `משחק: ${homeTeam} מול ${awayTeam}\nניחושים:` : `MATCH: ${homeTeam} vs ${awayTeam}\nPICKS:`;
  const body = picks.map(p => pickLine(p, homeTeam, awayTeam, isHe)).join('\n');
  return callGroq(
    [
      { role: 'system', content: isHe ? SYSTEM_HE : SYSTEM_EN },
      { role: 'user', content: `${header}\n${body}` },
    ],
    120,
  );
}

/**
 * Sweep just-kicked-off matches and post one banter per (group, match) where
 * the group has ≥2 conflicting picks. Fire-and-forget; never blocks anything.
 * @param limit max banters posted per run (keeps Groq bursts small).
 */
export async function runProvocateurBatch(limit = 3): Promise<void> {
  if (!process.env.GROQ_API_KEY?.trim()) return; // no key → dormant

  const now = Date.now();
  const windowStart = new Date(now - 20 * 60 * 1000).toISOString(); // kicked off in the last 20 min
  const nowIso = new Date(now).toISOString();

  const { data: matches, error } = await supabaseAdmin
    .from('matches')
    .select('id, league_id, home_team, away_team')
    .in('status', LIVE_OR_KICKED)
    .gte('kickoff_time', windowStart)
    .lte('kickoff_time', nowIso)
    .limit(30);

  if (error) {
    logger.warn(`[provocateur] match query failed: ${error.message}`);
    return;
  }
  if (!matches || matches.length === 0) return;

  let posted = 0;
  for (const m of matches) {
    if (posted >= limit) break;
    try {
      const { data: groups } = await supabaseAdmin
        .from('groups')
        .select('id')
        .contains('active_leagues', [m.league_id]);

      for (const g of groups ?? []) {
        if (posted >= limit) break;

        // Already bantered? (unique index is the true backstop; this saves Groq calls.)
        const { data: existing } = await supabaseAdmin
          .from('group_events')
          .select('id')
          .eq('group_id', g.id)
          .eq('match_id', m.id)
          .eq('event_type', 'AI_BANTER')
          .limit(1);
        if (existing && existing.length > 0) continue;

        const { data: preds } = await supabaseAdmin
          .from('predictions')
          .select('user_id, predicted_outcome, predicted_home_score, predicted_away_score')
          .eq('match_id', m.id)
          .eq('group_id', g.id)
          .not('predicted_outcome', 'is', null);

        if (!preds || preds.length < 2) continue;
        const distinct = new Set(preds.map(p => p.predicted_outcome));
        if (distinct.size < 2) continue; // everyone agrees → nothing to provoke

        const userIds = [...new Set(preds.map(p => p.user_id))];
        const [{ data: profiles }, { data: lb }] = await Promise.all([
          supabaseAdmin.from('profiles').select('id, username').in('id', userIds),
          supabaseAdmin.from('leaderboard').select('user_id, total_points').eq('group_id', g.id),
        ]);

        const ranked = (lb ?? []).slice().sort((a, b) => b.total_points - a.total_points);
        const rankMap = new Map<string, { rank: number; points: number }>();
        ranked.forEach((r, i) => rankMap.set(r.user_id, { rank: i + 1, points: r.total_points }));
        const nameMap = new Map((profiles ?? []).map(p => [p.id, p.username]));

        const picks: PickRow[] = preds.map(p => ({
          username: nameMap.get(p.user_id) ?? 'Someone',
          rank: rankMap.get(p.user_id)?.rank ?? null,
          points: rankMap.get(p.user_id)?.points ?? null,
          outcome: p.predicted_outcome as Outcome,
          homeScore: p.predicted_home_score,
          awayScore: p.predicted_away_score,
        }));

        const [en, he] = await Promise.all([
          generateBanter(m.home_team, m.away_team, picks, 'en'),
          generateBanter(m.home_team, m.away_team, picks, 'he'),
        ]);
        if (!en) continue; // EN failed → skip (HE-only would be inconsistent)

        const { error: insErr } = await supabaseAdmin.from('group_events').insert({
          group_id: g.id,
          user_id: null,
          event_type: 'AI_BANTER',
          match_id: m.id,
          metadata: {
            text_en: en,
            text_he: he ?? en,
            home_team: m.home_team,
            away_team: m.away_team,
          },
        });

        if (insErr) {
          // Unique-index race = another worker already posted — not a real error.
          if (!/duplicate|unique/i.test(insErr.message)) {
            logger.warn(`[provocateur] insert failed: ${insErr.message}`);
          }
          continue;
        }
        posted++;
        logger.info(`[provocateur] banter posted: ${m.home_team} vs ${m.away_team} (group ${g.id})`);
      }
    } catch (err) {
      logger.warn(`[provocateur] match ${m.id} failed: ${(err as Error).message}`);
    }
  }

  if (posted > 0) logger.info(`[provocateur] posted ${posted} banter message(s)`);
}
