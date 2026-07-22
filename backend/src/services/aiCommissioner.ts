/**
 * AI Commissioner — "The Autonomous Commish" (V7 Sprint 51).
 *
 * A weekly, autonomous Locker Room post: a Groq-generated recap of the
 * group's standings/streaks/upcoming fixtures, paired with a purely
 * NARRATIVE weekly theme ("Underdog Week", "Clean Sheet Special", ...).
 *
 * CORRECTED SCOPE (see CLAUDE.md §69 for the full write-up): the original
 * brief asked for the AI to invent a numeric scoring bonus each week
 * (e.g. "+5 points for away picks"). This codebase has an explicit,
 * already-enforced rule (Sprint 14, §29): "AI never generates the
 * question or determines its resolution — only the commentary after the
 * outcome is already mechanically known... An LLM must never touch
 * anything that moves coins." An AI-invented scoring modifier would
 * violate that directly. The weekly theme below is therefore chosen
 * DETERMINISTICALLY by pickWeeklyTheme() (a fixed, small, developer-owned
 * enum — never Groq's own output) and carries ZERO scoring effect
 * anywhere in this codebase; pointsEngine.ts is completely untouched by
 * this file. Groq only narrates AROUND the already-chosen theme name.
 *
 * Reuses callGroq() (aiScout.ts) — the single Groq client every AI
 * feature in this codebase funnels through. No Groq key → silent no-op,
 * same graceful-degradation discipline as every other AI function here.
 */
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { logger } from './../lib/logger';
import { callGroq } from './aiScout';

interface StandingRow {
  username: string;
  totalPoints: number;
  currentStreak: number;
}

interface FixtureRow {
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
}

interface WeeklyTheme {
  en: string;
  he: string;
}

// Fixed, developer-owned — never AI-generated. See the file-header note on
// why this must stay deterministic. Ordered arbitrarily; picked by index,
// not by any Groq output.
const WEEKLY_THEMES: WeeklyTheme[] = [
  { en: 'Underdog Week — celebrating the bold away picks', he: 'שבוע האנדרדוגים — לכבוד הניחושים החוצניים האמיצים' },
  { en: 'Clean Sheet Special — defense wins titles', he: 'ספיישל שער נקי — הגנה מנצחת אליפויות' },
  { en: 'Golden Boot Watch — goals, goals, goals', he: 'מעקב מגף הזהב — שערים, שערים, שערים' },
  { en: 'Form Guide Frenzy — hot streaks take center stage', he: 'שיגעון מדריך הפורמה — רצפים חמים במרכז הבמה' },
  { en: 'Comeback Kids — never count anyone out', he: 'ילדי הקאמבק — לעולם אל תספרו אף אחד בחוץ' },
  { en: 'Derby Day Drama — local rivalries take priority', he: 'דרמת ימי הדרבי — יריבויות מקומיות בעדיפות עליונה' },
];

// A plain, non-cryptographic string hash — deterministic, stable across
// runs, sufficient for picking a theme index. Never used for anything
// security-adjacent.
function stableHashIndex(input: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % modulo;
}

/** Deterministic per-(group, week) theme pick — see file header. */
function pickWeeklyTheme(groupId: string, weekStart: string): WeeklyTheme {
  const idx = stableHashIndex(`${groupId}:${weekStart}`, WEEKLY_THEMES.length);
  return WEEKLY_THEMES[idx];
}

const SYSTEM_EN = `You are the "Commissioner" of a friendly football prediction league — an entertaining, slightly theatrical group announcer delivering a weekly matchday program. Given the group's current standings, hot streaks, and upcoming fixtures, write THREE punchy sentences: (1) a headline moment from the standings, (2) a callout of whoever is on a hot streak, (3) a tease for the upcoming fixtures, weaving in the week's theme naturally. Confident, warm, a little dramatic — like a real sports-radio host, never robotic. Reply ONLY in English. Max 70 words. Output the recap only, no quotes, no markdown.`;

const SYSTEM_HE = `אתה ה"קומישנר" של ליגת ניחושי כדורגל בין חברים — מנחה קבוצתי משעשע ומעט תיאטרלי שמגיש תוכנייה שבועית. בהינתן הדירוג הנוכחי, הרצפים החמים, והמשחקים הקרובים, כתוב שלושה משפטים קליטים: (1) רגע מרכזי מהדירוג, (2) קריאת שמות למי שנמצא ברצף חם, (3) טיזר למשחקים הקרובים, תוך שילוב טבעי של נושא השבוע. בטוח, חם, ומעט דרמטי — כמו מגיש רדיו ספורט אמיתי, לעולם לא רובוטי. השב אך ורק בעברית. עד 70 מילים. החזר את התוכנייה בלבד, בלי מרכאות, בלי markdown.`;

function buildUserPrompt(
  groupName: string,
  theme: string,
  standings: StandingRow[],
  fixtures: FixtureRow[],
  isHe: boolean,
): string {
  const standingsLines = standings
    .slice(0, 5)
    .map((s, i) => `${i + 1}. ${s.username} — ${s.totalPoints}${isHe ? ' נק׳' : 'pts'}${s.currentStreak >= 3 ? (isHe ? ` (רצף חם: ${s.currentStreak})` : ` (hot streak: ${s.currentStreak})`) : ''}`)
    .join('\n');
  const fixtureLines = fixtures
    .slice(0, 3)
    .map((f) => `${f.homeTeam} vs ${f.awayTeam}`)
    .join(isHe ? '; ' : '; ');

  return isHe
    ? `קבוצה: ${groupName}\nנושא השבוע: ${theme}\nדירוג נוכחי:\n${standingsLines}\nמשחקים קרובים: ${fixtureLines || 'אין משחקים קרובים ידועים'}`
    : `Group: ${groupName}\nWeek theme: ${theme}\nCurrent standings:\n${standingsLines}\nUpcoming fixtures: ${fixtureLines || 'None currently scheduled'}`;
}

async function generateBrief(
  groupName: string,
  theme: WeeklyTheme,
  standings: StandingRow[],
  fixtures: FixtureRow[],
  lang: 'en' | 'he',
): Promise<string | null> {
  const isHe = lang === 'he';
  const system = isHe ? SYSTEM_HE : SYSTEM_EN;
  const user = buildUserPrompt(groupName, isHe ? theme.he : theme.en, standings, fixtures, isHe);
  return callGroq(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    220,
  );
}

/**
 * EXPORTED. Sweeps groups that haven't received this week's brief yet,
 * generates + posts one COMMISSIONER_BRIEF group_event each. `limit` caps
 * Groq calls per run (this codebase's established burst-avoidance
 * discipline, e.g. runPreMatchBatch/runHTInsightBatch's own small limits,
 * §22/§23) — a weekly cadence with a generous per-run cap comfortably
 * covers any realistic number of groups for this friend-group-scale app
 * across the run's own recurring interval.
 */
export async function runCommissionerBriefBatch(limit = 10): Promise<void> {
  if (!process.env.GROQ_API_KEY?.trim()) return; // no key → dormant

  // The SAME source of truth Global Arena's own weekly promotion sweep
  // uses (migration 066) — never a second, independently-computed JS copy
  // of "what week is it," which is exactly the dual-source-of-truth trap
  // this codebase warns against repeatedly.
  const { data: weekStartRaw, error: weekErr } = await supabaseAdmin.rpc('arena_current_week_start');
  if (weekErr || !weekStartRaw) {
    logger.warn(`[commissioner] arena_current_week_start() failed: ${weekErr?.message ?? 'no data'}`);
    return;
  }
  const weekStart = String(weekStartRaw);

  const { data: groups, error: groupsErr } = await supabaseAdmin
    .from('groups')
    .select('id, name, active_leagues')
    .limit(limit * 4); // over-fetch; many will already be briefed this week

  if (groupsErr) {
    logger.warn(`[commissioner] groups query failed: ${groupsErr.message}`);
    return;
  }
  if (!groups || groups.length === 0) return;

  let posted = 0;
  for (const g of groups) {
    if (posted >= limit) break;
    try {
      // Already briefed this week? (the unique index is the real
      // backstop — this check only saves a Groq call.)
      const { data: existing } = await supabaseAdmin
        .from('group_events')
        .select('id')
        .eq('group_id', g.id)
        .eq('event_type', 'COMMISSIONER_BRIEF')
        .filter('metadata->>week_start', 'eq', weekStart)
        .limit(1);
      if (existing && existing.length > 0) continue;

      const { data: lb } = await supabaseAdmin
        .from('leaderboard')
        .select('user_id, total_points, current_streak')
        .eq('group_id', g.id)
        .order('total_points', { ascending: false })
        .limit(5);

      if (!lb || lb.length === 0) continue; // nothing to report yet

      const userIds = lb.map((r) => r.user_id);
      const { data: profiles } = await supabaseAdmin.from('profiles').select('id, username').in('id', userIds);
      const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.username]));

      const standings: StandingRow[] = lb.map((r) => ({
        username: nameMap.get(r.user_id) ?? 'Someone',
        totalPoints: r.total_points,
        currentStreak: r.current_streak ?? 0,
      }));

      const activeLeagues: number[] = g.active_leagues ?? [];
      let fixtures: FixtureRow[] = [];
      if (activeLeagues.length > 0) {
        const { data: matches } = await supabaseAdmin
          .from('matches')
          .select('home_team, away_team, kickoff_time')
          .in('league_id', activeLeagues)
          .eq('status', 'NS')
          .gte('kickoff_time', new Date().toISOString())
          .order('kickoff_time', { ascending: true })
          .limit(3);
        fixtures = (matches ?? []).map((m) => ({ homeTeam: m.home_team, awayTeam: m.away_team, kickoff: m.kickoff_time }));
      }

      const theme = pickWeeklyTheme(g.id, weekStart);
      const groupName = g.name ?? 'Your League';

      const [en, he] = await Promise.all([
        generateBrief(groupName, theme, standings, fixtures, 'en'),
        generateBrief(groupName, theme, standings, fixtures, 'he'),
      ]);
      if (!en) continue; // EN failed → skip (HE-only would be inconsistent, §22)

      const { error: insErr } = await supabaseAdmin.from('group_events').insert({
        group_id: g.id,
        user_id: null,
        event_type: 'COMMISSIONER_BRIEF',
        metadata: {
          text_en: en,
          text_he: he ?? en,
          theme_en: theme.en,
          theme_he: theme.he,
          week_start: weekStart,
        },
      });

      if (insErr) {
        // Unique-index race = another worker already posted this week — not a real error.
        if (!insErr.message?.includes('duplicate key')) {
          logger.warn(`[commissioner] insert failed for group ${g.id}: ${insErr.message}`);
        }
        continue;
      }

      posted++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`[commissioner] unexpected error for group ${g.id}: ${message}`);
    }
  }
}
