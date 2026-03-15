/**
 * ESPN Public API — free, no key, no registration
 * https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/scoreboard
 */

import axios from 'axios';
import { logger } from '../lib/logger';
import { DBMatch } from './sportsdb';

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

function mapEspnStatus(statusName: string, period: number): string {
  switch (statusName) {
    case 'STATUS_FINAL':
    case 'STATUS_FULL_TIME':
    case 'STATUS_FULL_PEN':
    case 'STATUS_FULL_ET':
      return 'FT';
    case 'STATUS_HALFTIME':
      return 'HT';
    case 'STATUS_IN_PROGRESS':
      return period <= 1 ? '1H' : '2H';
    case 'STATUS_POSTPONED':
      return 'PST';
    case 'STATUS_CANCELED':
    case 'STATUS_CANCELLED':
      return 'CANC';
    default:
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

export async function fetchLeagueMatches(
  leagueId: number,
  daysBack = 7,
  daysAhead = 14,
): Promise<DBMatch[]> {
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
    const matches: DBMatch[] = [];

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

        const matchStatus = mapEspnStatus(statusName, period);

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
          halftime_home: null, // not available in ESPN scoreboard
          halftime_away: null,
          season: (data.leagues?.[0]?.season?.displayName as string) ?? null,
          round: null,
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
