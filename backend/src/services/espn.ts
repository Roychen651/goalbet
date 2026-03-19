/**
 * ESPN Public API — free, no key, no registration
 * https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/scoreboard
 */

import axios from 'axios';
import { logger } from '../lib/logger';
import { DBMatch } from './sportsdb';

export type DBMatchWithClock = DBMatch & {
  display_clock: string | null;
  // Regulation-time (90 min) scores — set only when match went to ET or penalties.
  // home_score/away_score will reflect the final result (including ET goals).
  regulation_home: number | null;
  regulation_away: number | null;
  // True when the match was decided by a penalty shootout (STATUS_FINAL_PK).
  went_to_penalties: boolean;
};

// Map our internal TheSportsDB league IDs → ESPN league slugs
export const LEAGUE_ESPN_MAP: Record<number, string> = {
  4328: 'eng.1',           // Premier League
  4335: 'esp.1',           // La Liga
  4331: 'ger.1',           // Bundesliga
  4332: 'ita.1',           // Serie A
  4334: 'fra.1',           // Ligue 1
  4346: 'uefa.champions',  // Champions League
  4399: 'uefa.europa',     // Europa League
  4877: 'uefa.europa.conf',// Conference League
  4337: 'ned.1',           // Eredivisie
  4338: 'tur.1',           // Süper Lig
  4330: 'sco.1',           // Scottish Premiership
  4344: 'usa.1',           // MLS
  4351: 'bra.1',           // Brazilian Série A
  4350: 'arg.1',           // Argentine Primera
  // Israeli Premier League (4354) has no ESPN coverage — skipped
};

function mapEspnStatus(statusName: string, period: number, state: string): string {
  switch (statusName) {
    case 'STATUS_FINAL':
    case 'STATUS_FULL_TIME':
    case 'STATUS_FULL_PEN':
    case 'STATUS_FULL_ET':
    case 'STATUS_FINAL_AET':
    case 'STATUS_FINAL_PK':
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

/**
 * Fetch full per-period linescores from the ESPN event summary endpoint.
 * Returns halftime, regulation (90-min), ET info and penalty detection.
 * Used as a fallback for STATUS_RESULT_OF_LEG knockout-tie matches where
 * the scoreboard endpoint returns empty linescores.
 */
async function fetchMatchLinescoreDetails(
  externalId: string,
  leagueId: number,
): Promise<{
  halftime_home: number | null;
  halftime_away: number | null;
  regulation_home: number | null;
  regulation_away: number | null;
  went_to_penalties: boolean;
} | null> {
  const slug = LEAGUE_ESPN_MAP[leagueId];
  if (!slug) return null;
  const eventId = externalId.replace(/^espn_/, '');
  if (!eventId || !/^\d+$/.test(eventId)) return null;

  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${eventId}`;
  try {
    const { data } = await axios.get(url, { timeout: 8_000, headers: { 'User-Agent': 'GoalBet/1.0' } });

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
    const pkHome = getIdx(home, 4);   // shootout (null if no pens)
    const pkAway = getIdx(away, 4);

    const hasET = et1Home !== null || et1Away !== null;
    const hasPK = pkHome !== null || pkAway !== null;

    let regulationHome: number | null = null;
    let regulationAway: number | null = null;
    if (hasET && htHome !== null && h2Home !== null && htAway !== null && h2Away !== null) {
      regulationHome = htHome + h2Home;
      regulationAway = htAway + h2Away;
    }

    return { halftime_home: htHome, halftime_away: htAway, regulation_home: regulationHome, regulation_away: regulationAway, went_to_penalties: hasPK };
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
    const { data } = await axios.get(url, {
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

  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?limit=100&dates=${dateRange}`;

  try {
    const { data } = await axios.get(url, {
      timeout: 10_000,
      headers: { 'User-Agent': 'GoalBet/1.0' },
    });

    const events: unknown[] = data.events ?? [];
    if (events.length === 0) {
      logger.debug(`[ESPN] No events for ${slug} (${dateRange})`);
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
        if (!home || !away) continue;

        const status = comp.status as Record<string, unknown>;
        const statusType = status?.type as Record<string, unknown>;
        const statusName = (statusType?.name as string) ?? 'STATUS_SCHEDULED';
        const period = (status?.period as number) ?? 1;
        const state = (statusType?.state as string) ?? 'pre';

        const homeTeam = home.team as Record<string, unknown>;
        const awayTeam = away.team as Record<string, unknown>;

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

        // Regulation score = 1H + 2H goals (only relevant for ET/PEN matches)
        // Stored so predictions can be scored on the 90-minute result, not the ET/penalty result.
        let wentToPenalties =
          statusName === 'STATUS_FINAL_PK' ||
          statusName === 'STATUS_FULL_PEN' ||
          matchStatus === 'PEN' ||
          hasShootoutLinescore; // detect from linescores for STATUS_RESULT_OF_LEG finishes

        let isExtraTime =
          ['ET1', 'ET2', 'AET', 'PEN'].includes(matchStatus) ||
          ['STATUS_FINAL_AET', 'STATUS_FINAL_PK', 'STATUS_FULL_ET', 'STATUS_FULL_PEN'].includes(statusName) ||
          hasET1Linescore; // detect from linescores for STATUS_RESULT_OF_LEG finishes

        let regulationHome: number | null = null;
        let regulationAway: number | null = null;

        if (isExtraTime) {
          const h2Home = parsePeriodScore(homeLinescores, 1); // 2H goals
          const h2Away = parsePeriodScore(awayLinescores, 1);
          if (htHome !== null && h2Home !== null && htAway !== null && h2Away !== null) {
            regulationHome = htHome + h2Home;
            regulationAway = htAway + h2Away;
          }
        }

        // STATUS_RESULT_OF_LEG: ESPN finalises 2-leg knockout ties with this status but the
        // scoreboard endpoint often omits linescores for historical matches. Fall back to the
        // event summary endpoint which reliably includes per-period linescore data.
        if (statusName === 'STATUS_RESULT_OF_LEG' && !isExtraTime) {
          try {
            const details = await fetchMatchLinescoreDetails(`espn_${event.id}`, leagueId);
            if (details) {
              if (details.went_to_penalties) wentToPenalties = true;
              if (details.regulation_home !== null) {
                regulationHome = details.regulation_home;
                regulationAway = details.regulation_away;
                isExtraTime = true;
              }
            }
          } catch {
            // summary fetch failed — continue with scoreboard data
          }
        }

        // Extract corners from ESPN statistics (only available for finished/in-progress matches)
        const getStat = (competitor: Record<string, unknown>, name: string): number | null => {
          const stats = (competitor.statistics as Record<string, unknown>[] | undefined) ?? [];
          const s = stats.find(st => st.name === name);
          if (!s) return null;
          const v = parseInt(String(s.displayValue ?? s.value ?? ''), 10);
          return isNaN(v) ? null : v;
        };
        const homeCorners = getStat(home, 'wonCorners');
        const awayCorners = getStat(away, 'wonCorners');
        const cornersTotal = homeCorners !== null && awayCorners !== null
          ? homeCorners + awayCorners
          : null;

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
          home_score: parseScore(home.score as string, state),
          away_score: parseScore(away.score as string, state),
          halftime_home: htAvailable ? htHome : null,
          halftime_away: htAvailable ? htAway : null,
          season: (data.leagues?.[0]?.season?.displayName as string) ?? null,
          round: null,
          display_clock: displayClock,
          corners_total: cornersTotal,
          regulation_home: regulationHome,
          regulation_away: regulationAway,
          went_to_penalties: wentToPenalties,
        });
      } catch (err) {
        logger.debug(`[ESPN] Skipped event ${(event as Record<string, unknown>).id}: ${err}`);
      }
    }

    logger.debug(`[ESPN] ${slug}: fetched ${matches.length} matches for ${dateRange}`);
    return matches;
  } catch (err) {
    logger.error(`[ESPN] Failed to fetch ${slug}: ${err}`);
    return [];
  }
}
