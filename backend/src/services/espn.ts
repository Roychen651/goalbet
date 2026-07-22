/**
 * ESPN Public API — free, no key, no registration
 * https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/scoreboard
 */

import { logger } from '../lib/logger';
import { espnGet } from '../lib/espnHttp';
import { DBMatch } from './sportsdb';
import { FALLBACK_LEAGUE_MAP, refreshLeagueRegistry } from './leagueRegistry';

export type DBMatchWithClock = DBMatch & {
  display_clock: string | null;
  // Regulation-time (90 min) scores — set only when match went to ET or penalties.
  // home_score/away_score will reflect the final result (including ET goals).
  regulation_home: number | null;
  regulation_away: number | null;
  // True when the match was decided by a penalty shootout (STATUS_FINAL_PK).
  went_to_penalties: boolean;
  // V4 Sprint 29 — the full raw ESPN competitor.statistics[] array per team,
  // verbatim, for match_team_stats.raw_stats. Was being read (via getStat())
  // for just 2 named fields and then discarded; now returned in full instead
  // of thrown away after parsing. null when ESPN's statistics array is
  // absent for this competitor (e.g. a not-yet-played match).
  home_stats_raw: Record<string, unknown>[] | null;
  away_stats_raw: Record<string, unknown>[] | null;
  // Per-team corners — matches.corners_total only ever stores the SUM of
  // these two (irreversible once summed), so this is the first place the
  // real per-team split is captured. yellow_cards is a genuinely new
  // extraction, not previously read anywhere in this codebase — same
  // "unverified field name, degrades to null gracefully" caveat as every
  // other best-effort ESPN field this engagement has added (see Sprint 27).
  home_corners: number | null;
  away_corners: number | null;
  home_yellow_cards: number | null;
  away_yellow_cards: number | null;
};

// Map our internal TheSportsDB league IDs → ESPN league slugs.
//
// V4 Sprint 28 — this is now a DERIVED VIEW over the `league_registry` table
// (leagueRegistry.ts), refreshed every 10 minutes by refreshEspnLeagueMap()
// below (called from scheduler.ts's startup + interval, same pattern as
// every other cron-driven sweep). It's seeded here from FALLBACK_LEAGUE_MAP
// (a shallow copy, so mutating this object never touches the fallback
// itself) so it's never empty even before the first DB read resolves.
//
// CRITICAL: this binding is never reassigned, only mutated in place (see
// leagueRegistry.ts's module doc comment for exactly why) — every one of the
// ~15 files across this backend that does `import { LEAGUE_ESPN_MAP } from
// './espn'` keeps working unchanged, because they all hold a reference to
// this SAME object, which just gets fresher keys over time.
export const LEAGUE_ESPN_MAP: Record<number, string> = { ...FALLBACK_LEAGUE_MAP };

export async function refreshEspnLeagueMap(): Promise<void> {
  await refreshLeagueRegistry(LEAGUE_ESPN_MAP);
}

function mapEspnStatus(statusName: string, period: number, state: string): string {
  switch (statusName) {
    case 'STATUS_FINAL':
    case 'STATUS_FULL_TIME':
    case 'STATUS_FULL_PEN':
    case 'STATUS_FULL_ET':
    case 'STATUS_FINAL_AET':
    case 'STATUS_FINAL_PK':
    case 'STATUS_FINAL_PEN':   // soccer penalty-shootout final (ESPN uses _PEN, not _PK)
    case 'STATUS_RESULT_OF_LEG':
      return 'FT';
    case 'STATUS_HALFTIME':
      return 'HT';
    // Extra time statuses
    case 'STATUS_FIRST_HALF_OVERTIME':
      return 'ET1';
    case 'STATUS_SECOND_HALF_OVERTIME':
      return 'ET2';
    case 'STATUS_END_OVERTIME':
      return 'AET'; // ET ended — may be heading to penalties or result confirmed
    case 'STATUS_SHOOTOUT':
      return 'PEN';
    case 'STATUS_IN_PROGRESS':
    case 'STATUS_LIVE':
      if (period >= 3) return 'ET1'; // period 3 = ET1, period 4 = ET2 handled above
      return period <= 1 ? '1H' : '2H';
    case 'STATUS_POSTPONED':
    case 'STATUS_DELAY':
    case 'STATUS_RAIN_DELAY':
      return 'PST';
    case 'STATUS_CANCELED':
    case 'STATUS_CANCELLED':
    case 'STATUS_ABANDONED':
      return 'CANC';
    default:
      // Fall back to ESPN state ('pre' | 'in' | 'post') if status name is unrecognised
      if (state === 'in') return period <= 1 ? '1H' : '2H';
      if (state === 'post') return 'FT';
      return 'NS';
  }
}

function parseScore(scoreStr: string | undefined, state: string): number | null {
  if (state === 'pre' || !scoreStr) return null;
  const n = parseInt(scoreStr, 10);
  return isNaN(n) ? null : n;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function buildDisplayClock(statusName: string, state: string, displayClock: string | undefined, period: number): string | null {
  if (state === 'pre') return null;
  if (statusName === 'STATUS_HALFTIME') return 'HT';
  if (statusName === 'STATUS_END_OVERTIME') return 'AET';
  if (statusName === 'STATUS_FINAL' || statusName === 'STATUS_FINAL_AET' || statusName === 'STATUS_FINAL_PK' || statusName === 'STATUS_FULL_ET' || statusName === 'STATUS_FULL_PEN' || state === 'post') return null;
  if (displayClock) {
    // ESPN gives "MM:SS" elapsed (e.g. "48:23") or "MM:SS+" for stoppage time (e.g. "90:00+", "45:00+")
    const isStoppage = displayClock.includes('+');
    const m = displayClock.match(/^(\d+)/);
    if (m) {
      const mins = parseInt(m[1]);
      if (isStoppage) {
        // Show stoppage time clearly: "45+'" or "90+'" or "105+'"
        const baseMin = period <= 1 ? 45 : period === 2 ? 90 : period === 3 ? 105 : 120;
        return `${baseMin}+'`;
      }
      return `${mins}'`;
    }
  }
  // Fallback: period label only
  if (state === 'in') {
    if (period >= 4) return 'ET2';
    if (period === 3) return 'ET1';
    return period <= 1 ? '1H' : '2H';
  }
  return null;
}

// V4 Sprint 29 — extracted to module scope (was a local closure redefined on
// every loop iteration inside fetchLeagueMatches) the moment a second real
// consumer (fetchMatchTeamStatsFromSummary, below) needed the identical
// extraction logic. Same "extract on the second real consumer" precedent
// already established repeatedly on the frontend side of this engagement,
// applied here on the backend for the first time.
function getStat(competitor: Record<string, unknown>, name: string): number | null {
  const stats = (competitor.statistics as Record<string, unknown>[] | undefined) ?? [];
  const s = stats.find(st => st.name === name);
  if (!s) return null;
  const v = parseInt(String(s.displayValue ?? s.value ?? ''), 10);
  return isNaN(v) ? null : v;
}

// V6 Sprint 48 — best-effort round-name extraction. ESPN's scoreboard
// competition object typically carries `notes: [{ type, headline }]` with
// a free-text round description. Never verified against a real response
// from this sandbox (no outbound ESPN access here — the same standing
// limitation already noted for other best-effort fields), so this reads
// defensively and returns null on any unexpected shape rather than
// throwing or producing garbage. A wrong/missing extraction here only
// costs a missed round-depth bonus (pointsEngine.ts) — it never blocks
// sync, never affects score resolution.
function extractRoundName(comp: Record<string, unknown>): string | null {
  try {
    const notes = comp.notes as Record<string, unknown>[] | undefined;
    const headline = notes?.[0]?.headline;
    return typeof headline === 'string' && headline.trim().length > 0 ? headline.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Fetch full per-period linescores from the ESPN event summary endpoint.
 * Returns halftime, regulation (90-min), ET info and penalty detection.
 * Used as a fallback for STATUS_RESULT_OF_LEG knockout-tie matches where
 * the scoreboard endpoint returns empty linescores.
 */
// eslint-disable-next-line prefer-const
export async function fetchMatchLinescoreRepair(
  externalId: string,
  leagueId: number,
) {
  return fetchMatchLinescoreDetails(externalId, leagueId);
}
async function fetchMatchLinescoreDetails(
  externalId: string,
  leagueId: number,
): Promise<{
  halftime_home: number | null;
  halftime_away: number | null;
  regulation_home: number | null;
  regulation_away: number | null;
  went_to_penalties: boolean;
  penalty_home: number | null;
  penalty_away: number | null;
} | null> {
  const slug = LEAGUE_ESPN_MAP[leagueId];
  if (!slug) return null;
  const eventId = externalId.replace(/^espn_/, '');
  if (!eventId || !/^\d+$/.test(eventId)) return null;

  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${eventId}`;
  try {
    const data = await espnGet<any>(url, { timeout: 8_000, headers: { 'User-Agent': 'GoalBet/1.0' } });

    const comp = data?.header?.competitions?.[0];
    const competitors = (comp?.competitors as Record<string, unknown>[] | undefined) ?? [];
    const home = competitors.find(c => (c as Record<string, unknown>).homeAway === 'home') as Record<string, unknown> | undefined;
    const away = competitors.find(c => (c as Record<string, unknown>).homeAway === 'away') as Record<string, unknown> | undefined;

    const getIdx = (competitor: Record<string, unknown> | undefined, idx: number): number | null => {
      if (!competitor) return null;
      const ls = competitor.linescores as Record<string, unknown>[] | undefined;
      if (!ls || ls.length <= idx) return null;
      const v = ls[idx]?.value ?? ls[idx]?.displayValue ?? ls[idx]?.score;
      if (v === undefined || v === null) return null;
      const n = parseInt(String(v), 10);
      return isNaN(n) ? null : n;
    };

    const htHome = getIdx(home, 0);   // 1H goals
    const htAway = getIdx(away, 0);
    const h2Home = getIdx(home, 1);   // 2H goals
    const h2Away = getIdx(away, 1);
    const et1Home = getIdx(home, 2);  // ET1 goals (null if no ET)
    const et1Away = getIdx(away, 2);
    // Shootout: prefer the explicit competitor.shootoutScore, fall back to linescores[4].
    const shootoutOf = (c: Record<string, unknown> | undefined): number | null => {
      const v = c?.shootoutScore;
      if (v === undefined || v === null) return null;
      const n = parseInt(String(v), 10);
      return isNaN(n) ? null : n;
    };
    const pkHome = shootoutOf(home) ?? getIdx(home, 4);   // shootout (null if no pens)
    const pkAway = shootoutOf(away) ?? getIdx(away, 4);
    const statusNamePK = String((comp?.status as Record<string, unknown>)?.type &&
      ((comp?.status as Record<string, unknown>).type as Record<string, unknown>).name || '');

    // Check total linescore count — ESPN omits 0-goal ET periods in some responses,
    // so we can't rely solely on et1Home/et1Away being non-null to detect ET.
    const homeLsCount = (home?.linescores as unknown[] | undefined)?.length ?? 0;
    const awayLsCount = (away?.linescores as unknown[] | undefined)?.length ?? 0;
    const lsCount = Math.max(homeLsCount, awayLsCount);

    const hasPK = pkHome !== null || pkAway !== null ||
      statusNamePK === 'STATUS_FINAL_PEN' || statusNamePK === 'STATUS_FINAL_PK' || statusNamePK === 'STATUS_FULL_PEN';
    // ET happened if: ET linescore present, OR 3+ periods in linescore, OR penalties (pens always follow ET)
    const hasET = et1Home !== null || et1Away !== null || lsCount >= 3 || hasPK ||
      statusNamePK === 'STATUS_FINAL_AET';

    let regulationHome: number | null = null;
    let regulationAway: number | null = null;
    // Regulation = 1H goals + 2H goals (always true regardless of ET)
    if (hasET && htHome !== null && h2Home !== null && htAway !== null && h2Away !== null) {
      regulationHome = htHome + h2Home;
      regulationAway = htAway + h2Away;
    }

    return {
      halftime_home: htHome,
      halftime_away: htAway,
      regulation_home: regulationHome,
      regulation_away: regulationAway,
      went_to_penalties: hasPK,
      penalty_home: hasPK ? pkHome : null,
      penalty_away: hasPK ? pkAway : null,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch halftime scores from the ESPN event summary endpoint.
 * This endpoint returns per-period linescores even for in-progress 2H matches,
 * whereas the scoreboard endpoint sometimes returns null linescores during live play.
 * Used as a fallback when halftime_home is still null for a 2H match.
 */
export async function fetchMatchHalftimeScore(
  externalId: string,
  leagueId: number,
): Promise<{ halftime_home: number; halftime_away: number } | null> {
  const slug = LEAGUE_ESPN_MAP[leagueId];
  if (!slug) return null;

  // external_id is "espn_<numericId>" — extract the numeric part
  const eventId = externalId.replace(/^espn_/, '');
  if (!eventId || !/^\d+$/.test(eventId)) return null;

  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${eventId}`;

  try {
    const data = await espnGet<any>(url, {
      timeout: 8_000,
      headers: { 'User-Agent': 'GoalBet/1.0' },
    });

    // Try primary source: header.competitions[0].competitors linescores
    const comp = data?.header?.competitions?.[0];
    const competitors = (comp?.competitors as Record<string, unknown>[] | undefined) ?? [];
    const home = competitors.find(c => (c as Record<string, unknown>).homeAway === 'home') as Record<string, unknown> | undefined;
    const away = competitors.find(c => (c as Record<string, unknown>).homeAway === 'away') as Record<string, unknown> | undefined;

    const getP1Score = (competitor: Record<string, unknown> | undefined): number | null => {
      if (!competitor) return null;
      const ls = competitor.linescores as Record<string, unknown>[] | undefined;
      if (!ls || ls.length === 0) return null;
      const v = ls[0]?.value ?? ls[0]?.displayValue ?? ls[0]?.score;
      if (v === undefined || v === null) return null;
      const n = parseInt(String(v), 10);
      return isNaN(n) ? null : n;
    };

    const htHome = getP1Score(home);
    const htAway = getP1Score(away);
    if (htHome !== null && htAway !== null) {
      return { halftime_home: htHome, halftime_away: htAway };
    }

    return null;
  } catch {
    return null;
  }
}

export interface MatchKeyEvent {
  minute: number;
  extraTime: number | null; // stoppage time added (e.g. 45+2 → extraTime=2)
  period: number;           // 1=1H, 2=2H, 3=ET1, 4=ET2
  type: 'goal' | 'own_goal' | 'penalty_goal' | 'yellow_card' | 'red_card' | 'second_yellow' | 'substitution';
  team: 'home' | 'away';
  playerName: string;
  playerOff?: string; // substitution: player being replaced
}

/**
 * Fetch key match events (goals, cards, substitutions) from the ESPN summary endpoint.
 * Works retroactively for any finished match with a valid external_id.
 */
export async function fetchMatchKeyEvents(
  externalId: string,
  leagueId: number,
): Promise<MatchKeyEvent[] | null> {
  const slug = LEAGUE_ESPN_MAP[leagueId];
  if (!slug) return null;
  const eventId = externalId.replace(/^espn_/, '');
  if (!eventId || !/^\d+$/.test(eventId)) return null;

  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${eventId}`;
  try {
    const data = await espnGet<any>(url, { timeout: 10_000, headers: { 'User-Agent': 'GoalBet/1.0' } });

    // Determine home/away team IDs from the competitors list
    const comp = data?.header?.competitions?.[0];
    const competitors = (comp?.competitors as Record<string, unknown>[] | undefined) ?? [];
    const homeComp = competitors.find(c => (c as Record<string, unknown>).homeAway === 'home') as Record<string, unknown> | undefined;
    const awayComp = competitors.find(c => (c as Record<string, unknown>).homeAway === 'away') as Record<string, unknown> | undefined;
    const homeTeamId = String((homeComp?.team as Record<string, unknown>)?.id ?? '');
    const awayTeamId = String((awayComp?.team as Record<string, unknown>)?.id ?? '');

    // ESPN summary has multiple possible locations for key events
    const keyEvents: Record<string, unknown>[] =
      (data?.keyEvents as Record<string, unknown>[]) ??
      (data?.commentary as Record<string, unknown>[]) ??
      [];

    if (!keyEvents.length) return null;

    const events: MatchKeyEvent[] = [];

    for (const ev of keyEvents) {
      // Parse clock: "30:00" or "45:00+" → minute=30 or minute=45 extraTime set
      const clockStr = String((ev.clock as Record<string, unknown>)?.displayValue ?? ev.clock ?? '');
      const isStoppage = clockStr.includes('+');
      const clockMatch = clockStr.match(/^(\d+)/);
      if (!clockMatch) continue;
      const minute = parseInt(clockMatch[1]);
      let extraTime: number | null = null;
      if (isStoppage) {
        const stoppageMatch = clockStr.match(/\+(\d+)/);
        extraTime = stoppageMatch ? parseInt(stoppageMatch[1]) : 0;
      }

      const period = ((ev.period as Record<string, unknown>)?.number as number) ?? 1;

      // Determine event type
      const typeText = String(((ev.type as Record<string, unknown>)?.text ?? ev.type ?? '')).toLowerCase();
      const isGoal = (ev.scoringPlay as boolean) === true || typeText.includes('goal');
      const isOwnGoal = (ev.ownGoal as boolean) === true || typeText.includes('own goal');
      const isPenaltyGoal = (ev.penaltyKick as boolean) === true && isGoal;
      const isYellow = (ev.yellowCard as boolean) === true || typeText.includes('yellow');
      const isRed = (ev.redCard as boolean) === true || typeText.includes('red card');
      const isSecondYellow = isYellow && isRed;
      const isSub = typeText.includes('sub') || typeText.includes('substit');

      let type: MatchKeyEvent['type'];
      if (isOwnGoal) type = 'own_goal';
      else if (isPenaltyGoal) type = 'penalty_goal';
      else if (isGoal) type = 'goal';
      else if (isSecondYellow) type = 'second_yellow';
      else if (isRed) type = 'red_card';
      else if (isYellow) type = 'yellow_card';
      else if (isSub) type = 'substitution';
      else continue; // skip non-key events

      // Team side
      const teamId = String((ev.team as Record<string, unknown>)?.id ?? '');
      const team: 'home' | 'away' = teamId === homeTeamId ? 'home' : teamId === awayTeamId ? 'away' : 'home';

      // Player names from participants or athletesInvolved
      const participants: Record<string, unknown>[] =
        (ev.participants as Record<string, unknown>[]) ??
        (ev.athletesInvolved as Record<string, unknown>[]) ?? [];
      const scorer = participants.find(p => {
        const typeText = String(((p.type as Record<string, unknown>)?.text ?? p.type ?? '')).toLowerCase();
        return typeText.includes('scor') || typeText === 'scorer' || typeText === 'goal';
      }) ?? participants[0];
      const playerIn = participants.find(p => {
        const t = String(((p.type as Record<string, unknown>)?.text ?? p.type ?? '')).toLowerCase();
        return t.includes('in') || t.includes('enter');
      }) ?? participants[0];
      const playerOut = participants.find(p => {
        const t = String(((p.type as Record<string, unknown>)?.text ?? p.type ?? '')).toLowerCase();
        return t.includes('out') || t.includes('exit') || t.includes('replac');
      });

      const getName = (p: Record<string, unknown> | undefined): string => {
        if (!p) return 'Unknown';
        const athlete = p.athlete as Record<string, unknown> | undefined;
        return String(athlete?.shortName ?? athlete?.displayName ?? athlete?.fullName ?? p.displayName ?? 'Unknown');
      };

      const playerName = isSub ? getName(playerIn) : getName(scorer);
      const playerOff = isSub ? getName(playerOut) : undefined;

      events.push({ minute, extraTime, period, type, team, playerName, playerOff });
    }

    // Sort by period, then minute, then extraTime
    events.sort((a, b) => {
      if (a.period !== b.period) return a.period - b.period;
      if (a.minute !== b.minute) return a.minute - b.minute;
      return (a.extraTime ?? 0) - (b.extraTime ?? 0);
    });

    return events;
  } catch {
    return null;
  }
}

/**
 * V6 Sprint 44 — the referee's display name from the same summary endpoint
 * fetchMatchKeyEvents() already reads. A separate call, not a shared fetch
 * with fetchMatchKeyEvents(), deliberately: this only ever fires once per
 * match at FT resolution (scoreUpdater.ts), not on every live-poll tick —
 * a low-frequency call, so the simplicity of its own request outweighs the
 * marginal cost of a second identical fetch. `data.boxscore.officials[0]`
 * is the exact field path the frontend's own fetchEspnMatchInfo() already
 * reads (MatchCard.tsx) — reused verbatim, not re-derived.
 */
export async function fetchMatchOfficials(externalId: string, leagueId: number): Promise<string | null> {
  const slug = LEAGUE_ESPN_MAP[leagueId];
  if (!slug) return null;
  const eventId = externalId.replace(/^espn_/, '');
  if (!eventId || !/^\d+$/.test(eventId)) return null;

  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${eventId}`;
  try {
    const data = await espnGet<any>(url, { timeout: 10_000, headers: { 'User-Agent': 'GoalBet/1.0' } });
    const officials = (data?.boxscore?.officials as Record<string, unknown>[]) ?? [];
    const ref = officials[0] as Record<string, unknown> | undefined;
    if (!ref) return null;
    const name = (typeof ref.displayName === 'string' && ref.displayName) ||
      (typeof ref.fullName === 'string' && ref.fullName) || null;
    return name;
  } catch {
    return null;
  }
}

export interface MatchTeamStatsSummary {
  home_stats_raw: Record<string, unknown>[] | null;
  away_stats_raw: Record<string, unknown>[] | null;
  home_corners: number | null;
  away_corners: number | null;
  home_red_cards: number | null;
  away_red_cards: number | null;
  home_yellow_cards: number | null;
  away_yellow_cards: number | null;
}

/**
 * V4 Sprint 29 — retroactive backfill support. Re-fetches a single
 * historical match's team stats from the ESPN summary endpoint (the same
 * endpoint fetchMatchKeyEvents already uses, same competitor-lookup shape:
 * data.header.competitions[0].competitors[]).
 *
 * WHETHER the summary endpoint's competitor objects expose `.statistics[]`
 * in the same shape the live scoreboard endpoint does is UNVERIFIED — this
 * sandbox cannot reach ESPN to confirm (same constraint as every other
 * best-effort ESPN field added in this engagement). If it doesn't, every
 * field below comes back null and the caller (the backfill script) records
 * that match as `unavailable` rather than fabricating a value — never
 * throws, matching this codebase's standing "never throw from an ESPN
 * integration" discipline.
 */
export async function fetchMatchTeamStatsFromSummary(
  externalId: string,
  leagueId: number,
): Promise<MatchTeamStatsSummary | null> {
  const slug = LEAGUE_ESPN_MAP[leagueId];
  if (!slug) return null;
  const eventId = externalId.replace(/^espn_/, '');
  if (!eventId || !/^\d+$/.test(eventId)) return null;

  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${eventId}`;
  try {
    const data = await espnGet<any>(url, { timeout: 10_000, headers: { 'User-Agent': 'GoalBet/1.0' } });

    const comp = data?.header?.competitions?.[0];
    const competitors = (comp?.competitors as Record<string, unknown>[] | undefined) ?? [];
    const home = competitors.find(c => (c as Record<string, unknown>).homeAway === 'home') as Record<string, unknown> | undefined;
    const away = competitors.find(c => (c as Record<string, unknown>).homeAway === 'away') as Record<string, unknown> | undefined;
    if (!home || !away) return null;

    return {
      home_stats_raw: (home.statistics as Record<string, unknown>[] | undefined) ?? null,
      away_stats_raw: (away.statistics as Record<string, unknown>[] | undefined) ?? null,
      home_corners: getStat(home, 'wonCorners'),
      away_corners: getStat(away, 'wonCorners'),
      home_red_cards: getStat(home, 'redCards'),
      away_red_cards: getStat(away, 'redCards'),
      home_yellow_cards: getStat(home, 'yellowCards'),
      away_yellow_cards: getStat(away, 'yellowCards'),
    };
  } catch (err) {
    logger.debug(`[ESPN] Team stats backfill fetch failed for ${externalId}: ${err}`);
    return null;
  }
}

// Leagues where ESPN nests a genuine pre-tournament qualifying stage
// under the SAME competition slug (seasontype=1) as the main tournament
// phase (seasontype=2) — a real, standard ESPN site-API parameter, not a
// fabricated one. Scoped narrowly to continent-wide club cups that
// actually have a qualifying stage; domestic leagues have no such split,
// and World Cup Qualifiers (5000) IS the qualifying competition already
// (no separate "main" phase to split from). See fetchLeagueMatches()'s
// own comment on why this is queried ADDITIVELY, never as a replacement.
const LEAGUES_WITH_QUALIFYING_ROUNDS = new Set([4346, 4399, 4877]); // UCL, UEL, UECL

// Fetches + parses ONE scoreboard request window. Extracted out of
// fetchLeagueMatches() the moment a second real caller (the seasontype=1
// qualifying-round request, below) needed the identical per-event parsing
// logic — the same "extract on the second real consumer" precedent this
// codebase already applies elsewhere (lib/espnEvents.ts, teamNameUtils.ts).
// Every line of the per-event parsing in this function is UNCHANGED from
// before this extraction — only the request URL is now a parameter
// instead of built inline, and callers can safely invoke this more than
// once per sync tick.
async function fetchOneScoreboardWindow(
  url: string,
  slug: string,
  leagueId: number,
  dateRange: string,
): Promise<DBMatchWithClock[]> {
  // TEMP DEBUG (remove once sync is confirmed): log the exact URL requested so
  // we can see in Render logs precisely what window/slug we hit.
  logger.info(`[ESPN][debug] GET league=${leagueId} slug=${slug} → ${url}`);

  try {
    const data = await espnGet<any>(url, {
      timeout: 10_000,
      headers: { 'User-Agent': 'GoalBet/1.0' },
    });

    const events: unknown[] = data.events ?? [];
    // TEMP DEBUG: how many events ESPN actually returned for this window.
    logger.info(`[ESPN][debug] league=${leagueId} slug=${slug} events=${events.length} range=${dateRange}`);
    if (events.length === 0) {
      logger.warn(`[ESPN][debug] ZERO events for ${slug} (${dateRange}) — off-season, wrong slug, or window miss`);
      return [];
    }

    const leagueName: string = (data.leagues?.[0]?.name as string) ?? slug;
    const matches: DBMatchWithClock[] = [];

    for (const event of events as Record<string, unknown>[]) {
      try {
        const comp = (event.competitions as Record<string, unknown>[])?.[0];
        if (!comp) continue;

        const competitors = comp.competitors as Record<string, unknown>[];
        const home = competitors.find(c => c.homeAway === 'home');
        const away = competitors.find(c => c.homeAway === 'away');
        if (!home || !away) {
          // Previously a silent `continue` — no log at all. A knockout
          // bracket slot whose participants aren't determined yet can
          // plausibly have an incomplete `competitors[]` shape on ESPN's
          // side; if that same shape persists even after the earlier round
          // resolves in real life, this event gets skipped on every single
          // sync cycle with zero diagnostic trail. Elevated to a real log
          // line (event id + how many competitors were actually present)
          // so a recurrence is diagnosable instead of invisible.
          logger.warn(`[ESPN] Event ${(event as Record<string, unknown>).id} missing home/away competitor (found ${competitors?.length ?? 0}) — skipped`);
          continue;
        }

        const status = comp.status as Record<string, unknown>;
        const statusType = status?.type as Record<string, unknown>;
        const statusName = (statusType?.name as string) ?? 'STATUS_SCHEDULED';
        const period = (status?.period as number) ?? 1;
        const state = (statusType?.state as string) ?? 'pre';

        // A knockout bracket slot with an as-yet-undetermined participant
        // is exactly the case most likely to have a partial/missing `team`
        // sub-object on ESPN's side. Falling back to {} here means a
        // missing team object degrades to the existing `?? 'Home'`/`'Away'`
        // fallback further below for just that one field, instead of
        // throwing and losing the entire event's other fields (kickoff
        // time, status, score) for this sync cycle.
        const homeTeam = (home.team as Record<string, unknown>) ?? {};
        const awayTeam = (away.team as Record<string, unknown>) ?? {};

        const matchStatus = mapEspnStatus(statusName, period, state);
        const espnClock = (status?.displayClock as string | undefined);
        const displayClock = buildDisplayClock(statusName, state, espnClock, period);

        // Extract per-period linescores from ESPN
        // linescores[0] = 1H goals, linescores[1] = 2H goals, linescores[2] = ET1, linescores[3] = ET2
        const homeLinescores = (home.linescores as Record<string, unknown>[] | undefined) ?? [];
        const awayLinescores = (away.linescores as Record<string, unknown>[] | undefined) ?? [];

        const parsePeriodScore = (ls: Record<string, unknown>[], period: number): number | null => {
          const item = ls[period];
          if (!item) return null;
          const v = item.value ?? item.displayValue;
          if (v === undefined || v === null) return null;
          const n = parseInt(String(v), 10);
          return isNaN(n) ? null : n;
        };

        const htHome = parsePeriodScore(homeLinescores, 0); // 1H goals
        const htAway = parsePeriodScore(awayLinescores, 0);
        // Record HT scores once match is past 1H (HT, 2H, ET, FT)
        const htAvailable = ['HT', '2H', 'FT', 'ET1', 'ET2', 'AET', 'PEN'].includes(matchStatus) && htHome !== null && htAway !== null;

        // Detect ET and penalties from linescores — works even when ESPN finalises
        // a 2-leg knockout tie with STATUS_RESULT_OF_LEG (which maps to 'FT').
        // linescores[0]=1H, [1]=2H, [2]=ET1, [3]=ET2, [4]=shootout
        const hasET1Linescore =
          parsePeriodScore(homeLinescores, 2) !== null ||
          parsePeriodScore(awayLinescores, 2) !== null;
        const hasShootoutLinescore =
          parsePeriodScore(homeLinescores, 4) !== null ||
          parsePeriodScore(awayLinescores, 4) !== null;

        // Final (post-ET) score as parsed from the scoreboard.
        const homeScoreVal = parseScore(home.score as string, state);
        const awayScoreVal = parseScore(away.score as string, state);

        // Penalty shootout score lives directly on the scoreboard competitor as
        // `shootoutScore` (e.g. Switzerland 4 – Colombia 3). This is the PRIMARY
        // source — ESPN's fifa.world omits per-period linescores entirely, so the
        // old linescores[4] read always came back null and penalties were lost.
        const shootoutOf = (c: Record<string, unknown>): number | null => {
          const v = c.shootoutScore;
          if (v === undefined || v === null) return null;
          const n = parseInt(String(v), 10);
          return isNaN(n) ? null : n;
        };
        const homeShootout = shootoutOf(home);
        const awayShootout = shootoutOf(away);

        // Regulation score = 1H + 2H goals (only relevant for ET/PEN matches)
        // Stored so predictions can be scored on the 90-minute result, not the ET/penalty result.
        // NOTE: ESPN uses STATUS_FINAL_PEN (not STATUS_FINAL_PK) for soccer shootouts.
        let wentToPenalties =
          statusName === 'STATUS_FINAL_PK' ||
          statusName === 'STATUS_FINAL_PEN' ||
          statusName === 'STATUS_FULL_PEN' ||
          statusName === 'STATUS_SHOOTOUT' ||
          matchStatus === 'PEN' ||
          hasShootoutLinescore ||
          homeShootout !== null || awayShootout !== null; // shootoutScore present → pens

        let isExtraTime =
          ['ET1', 'ET2', 'AET', 'PEN'].includes(matchStatus) ||
          ['STATUS_FINAL_AET', 'STATUS_FINAL_PK', 'STATUS_FINAL_PEN', 'STATUS_FULL_ET', 'STATUS_FULL_PEN'].includes(statusName) ||
          hasET1Linescore ||
          wentToPenalties; // a shootout always follows extra time

        let regulationHome: number | null = null;
        let regulationAway: number | null = null;
        // Prefer the explicit shootoutScore; fall back to any linescores[4] value.
        let penHome: number | null = homeShootout ?? parsePeriodScore(homeLinescores, 4);
        let penAway: number | null = awayShootout ?? parsePeriodScore(awayLinescores, 4);

        if (isExtraTime) {
          const h2Home = parsePeriodScore(homeLinescores, 1); // 2H goals
          const h2Away = parsePeriodScore(awayLinescores, 1);
          if (htHome !== null && h2Home !== null && htAway !== null && h2Away !== null) {
            regulationHome = htHome + h2Home;
            regulationAway = htAway + h2Away;
          } else {
            // ESPN (esp. fifa.world) frequently omits per-period linescores, so we
            // can't split out the true 90' score. Fall back to the final ES/ET
            // score so the FRONTEND still flags the match as AET/PEN — it keys the
            // "went to extra time" badge off `regulation_home != null`. Scoring
            // already falls back to home/away_score per rule 4.7, so points are
            // unchanged by this (regulation == final score here).
            regulationHome = homeScoreVal;
            regulationAway = awayScoreVal;
          }
        }

        // Fallback to event summary endpoint for any finished ET/PK match where the
        // scoreboard linescores were missing or incomplete.
        // Cases covered:
        //   1. STATUS_RESULT_OF_LEG — scoreboard omits linescores for 2-leg historical finals
        //   2. STATUS_FINAL_AET / STATUS_FINAL_PK — linescores sometimes absent for
        //      recently-finished matches (ESPN lag). Without this fallback the backend
        //      would store regulation_home=null and show the match as a plain FT result.
        const needsSummaryFallback =
          (statusName === 'STATUS_RESULT_OF_LEG' && !isExtraTime) ||
          (isExtraTime && matchStatus === 'FT' && regulationHome === null);

        if (needsSummaryFallback) {
          try {
            const details = await fetchMatchLinescoreDetails(`espn_${event.id}`, leagueId);
            if (details) {
              if (details.went_to_penalties) wentToPenalties = true;
              if (details.regulation_home !== null) {
                regulationHome = details.regulation_home;
                regulationAway = details.regulation_away;
                isExtraTime = true;
              }
              if (details.penalty_home !== null) {
                penHome = details.penalty_home;
                penAway = details.penalty_away;
              }
            }
          } catch {
            // summary fetch failed — continue with scoreboard data
          }
        }

        // Extract corners from ESPN statistics (only available for finished/in-progress matches)
        const homeCorners = getStat(home, 'wonCorners');
        const awayCorners = getStat(away, 'wonCorners');
        const cornersTotal = homeCorners !== null && awayCorners !== null
          ? homeCorners + awayCorners
          : null;

        const homeRedCards = getStat(home, 'redCards');
        const awayRedCards = getStat(away, 'redCards');

        // V4 Sprint 29 — yellow cards, a genuinely new extraction (never
        // read anywhere in this codebase before). Field name is a best-
        // effort guess (parallel construction to the confirmed 'redCards'),
        // unverifiable from this sandbox — degrades to null gracefully via
        // the same getStat() helper if ESPN doesn't expose it.
        const homeYellowCards = getStat(home, 'yellowCards');
        const awayYellowCards = getStat(away, 'yellowCards');

        matches.push({
          external_id: `espn_${event.id}`,
          league_id: leagueId,
          league_name: leagueName,
          home_team: (homeTeam.displayName as string) ?? 'Home',
          away_team: (awayTeam.displayName as string) ?? 'Away',
          home_team_badge: (homeTeam.logo as string) ?? null,
          away_team_badge: (awayTeam.logo as string) ?? null,
          kickoff_time: new Date(comp.date as string).toISOString(),
          status: matchStatus,
          home_score: homeScoreVal,
          away_score: awayScoreVal,
          halftime_home: htAvailable ? htHome : null,
          halftime_away: htAvailable ? htAway : null,
          season: (data.leagues?.[0]?.season?.displayName as string) ?? null,
          // V6 Sprint 48 — `round` was a real matches column silently
          // hardcoded to null since it was added; never actually captured.
          // ESPN's scoreboard event competitions typically carry a
          // `notes[]` array with a free-text round headline ("Round of
          // 16", "Quarterfinal", "Final", "Group Stage - Matchday 3") —
          // this codebase has never verified that field shape before, so
          // it's read defensively (string check, never assumed present)
          // and degrades to null exactly like every other best-effort
          // ESPN field (yellowCards, athlete.headshot) if the shape is
          // ever wrong or absent. Feeds pointsEngine.ts's knockout
          // round-depth bonus — see that file's header comment for why
          // this replaced a hand-authored static bracket file instead.
          round: extractRoundName(comp),
          display_clock: displayClock,
          corners_total: cornersTotal,
          regulation_home: regulationHome,
          regulation_away: regulationAway,
          went_to_penalties: wentToPenalties,
          penalty_home: wentToPenalties ? penHome : null,
          penalty_away: wentToPenalties ? penAway : null,
          red_cards_home: homeRedCards,
          red_cards_away: awayRedCards,
          home_stats_raw: (home.statistics as Record<string, unknown>[] | undefined) ?? null,
          away_stats_raw: (away.statistics as Record<string, unknown>[] | undefined) ?? null,
          home_corners: homeCorners,
          away_corners: awayCorners,
          home_yellow_cards: homeYellowCards,
          away_yellow_cards: awayYellowCards,
        });
      } catch (err) {
        // Was logger.debug — typically invisible in production (Render's
        // default log level). A single event's parse failure here means
        // that match's row silently never gets upserted this cycle (its
        // previous, possibly stale, DB row is left untouched) — elevated
        // to warn with the actual error so a recurring failure for one
        // specific match is diagnosable instead of silent forever.
        logger.warn(`[ESPN] Skipped event ${(event as Record<string, unknown>).id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    logger.info(`[ESPN][debug] ${slug}: parsed ${matches.length}/${events.length} events into DB rows for ${dateRange}`);
    return matches;
  } catch (err) {
    logger.error(`[ESPN] Failed to fetch ${slug}: ${err}`);
    return [];
  }
}

export async function fetchLeagueMatches(
  leagueId: number,
  daysBack = 7,
  daysAhead = 14,
): Promise<DBMatchWithClock[]> {
  const slug = LEAGUE_ESPN_MAP[leagueId];
  if (!slug) {
    logger.warn(`[ESPN] No slug for league ${leagueId}, skipping`);
    return [];
  }

  const now = new Date();
  const from = new Date(now.getTime() - daysBack * 86_400_000);
  const to = new Date(now.getTime() + daysAhead * 86_400_000);
  const dateRange = `${formatDate(from)}-${formatDate(to)}`;

  // World Cup 2026 has exactly 104 total matches (72 group + 16 R32 + 8 R16
  // + 4 QF + 2 SF + 1 third-place + 1 final — confirmed against
  // lib/worldCup2026.ts's own match labels, which run 1-104). With
  // daysBack=45/daysAhead=90 for league 4480, once the tournament reaches
  // its later rounds the date-range query genuinely spans all ~102-104
  // scheduled events. `limit=100` silently truncated ESPN's response at
  // exactly 100 — the LAST couple of chronologically-latest events (the
  // 3rd-place match and the Final) never appeared in `data.events` at all,
  // on every single sync, forever, once the total crossed 100. This was a
  // real, live bug: a user confirmed ESPN's own data already had the real
  // qualified teams while our synced rows stayed stuck on ESPN's original
  // bracket-slot placeholder names ("S1"/"S2") — a forced re-sync didn't
  // help, because the truncation happens identically on every request, not
  // a one-time staleness gap. 250 gives real headroom over any single
  // league's real match count (World Cup is the largest by far) with
  // negligible payload cost.
  const baseUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?limit=250&dates=${dateRange}`;

  // Hotfix — European qualifier/playoff-round fixtures missing from the
  // UPCOMING feed for UCL/UEL/UECL during July/August. This codebase's own
  // sandbox has no outbound access to ESPN's API at all (confirmed via a
  // direct request returning a policy-level 403 from this environment's
  // own proxy, not a transient failure) — so the exact shape of ESPN's
  // default (no explicit seasontype) date-range response for these 3
  // leagues' qualifying rounds could not be independently verified before
  // shipping this. Rather than guess at a theory this sandbox can't test,
  // this adds an explicit, ADDITIONAL request with the real, standard
  // ESPN `seasontype=1` parameter — strictly additive, never replacing the
  // existing default request. Any event both requests happen to return is
  // naturally deduped below by ESPN's own event id, matching the DB's own
  // upsert-by-external_id key (matchSync.ts) exactly — so this is safe
  // regardless of which theory about ESPN's default behavior turns out to
  // be correct: worst case it's one harmless extra request per sync cycle
  // for exactly these 3 leagues, best case it recovers genuinely missing
  // qualifying-round fixtures. The `[ESPN][qualifiers]` log line below
  // gives real, ground-truth visibility into which case it actually is,
  // the next time a live production sync cycle runs — no manual probing
  // needed, since this environment's sync already runs against real ESPN
  // data continuously and independently of this sandbox.
  const urls = [baseUrl];
  if (LEAGUES_WITH_QUALIFYING_ROUNDS.has(leagueId)) {
    urls.push(`${baseUrl}&seasontype=1`);
  }

  const byExternalId = new Map<string, DBMatchWithClock>();
  for (const oneUrl of urls) {
    const parsed = await fetchOneScoreboardWindow(oneUrl, slug, leagueId, dateRange);
    for (const m of parsed) byExternalId.set(m.external_id, m);
  }

  const matches = Array.from(byExternalId.values());
  if (urls.length > 1) {
    logger.info(
      `[ESPN][qualifiers] league=${leagueId} slug=${slug}: merged ${urls.length} season-type requests → ${matches.length} unique matches (range=${dateRange})`,
    );
  }
  return matches;
}
