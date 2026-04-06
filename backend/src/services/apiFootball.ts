/**
 * API-Football (api-sports.io) — free tier, 100 requests/day
 * Used ONLY for Israeli Premier League (league 271 / our ID 4354)
 * because ESPN's isr.1 endpoint only covers the 2024-25 season.
 *
 * Endpoint: https://v3.football.api-sports.io/fixtures
 * Auth header: x-apisports-key: <API_FOOTBALL_KEY env var>
 */

import axios from 'axios';
import { logger } from '../lib/logger';
import { DBMatch } from './sportsdb';
import { DBMatchWithClock } from './espn';

const BASE_URL = 'https://v3.football.api-sports.io';

// Israeli Premier League identifiers in API-Football
const APF_LEAGUE_ID = 271;
const APF_SEASON    = 2025; // 2025-26 season

// Our internal league ID — the only league this module handles
export const ISRAELI_LEAGUE_ID = 4354;

// ── Status mapping ────────────────────────────────────────────────────────────
function mapStatus(short: string, elapsed: number | null): string {
  switch (short) {
    case 'NS':
    case 'TBD':
      return 'NS';
    case '1H':
    case 'LIVE':
      return '1H';
    case 'HT':
    case 'BT': // break time between ET halves
      return 'HT';
    case '2H':
      return '2H';
    case 'ET':
      // elapsed > 105 = safely in ET2
      return elapsed !== null && elapsed > 105 ? 'ET2' : 'ET1';
    case 'P':
      return 'PEN';
    case 'FT':
    case 'AWD':
    case 'WO':
      return 'FT';
    case 'AET': // after extra time (no pens)
      return 'FT';
    case 'PEN': // after penalty shootout
      return 'FT';
    case 'PST':
    case 'SUSP':
    case 'INT':
      return 'PST';
    case 'CANC':
    case 'ABD':
      return 'CANC';
    default:
      return 'NS';
  }
}

function formatDateISO(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ── Minimal response type ─────────────────────────────────────────────────────
interface ApfFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null };
  };
  league: { round: string | null; season: number };
  teams: {
    home: { name: string };
    away: { name: string };
  };
  goals: { home: number | null; away: number | null };
  score: {
    halftime:  { home: number | null; away: number | null };
    fulltime:  { home: number | null; away: number | null }; // 90-min only
    extratime: { home: number | null; away: number | null };
    penalty:   { home: number | null; away: number | null };
  };
}

// ── Mapper ────────────────────────────────────────────────────────────────────
function mapFixture(f: ApfFixture): DBMatchWithClock {
  const short   = f.fixture.status.short;
  const elapsed = f.fixture.status.elapsed;
  const status  = mapStatus(short, elapsed);

  const wentToET  = ['AET', 'PEN'].includes(short);
  const wentToPen = short === 'PEN';

  // goals.home = final score incl. ET goals; score.fulltime = 90-min regulation score
  const homeScore = f.goals.home;
  const awayScore = f.goals.away;

  let regulationHome: number | null = null;
  let regulationAway: number | null = null;
  if (wentToET && f.score.fulltime.home !== null) {
    regulationHome = f.score.fulltime.home;
    regulationAway = f.score.fulltime.away;
  }

  let displayClock: string | null = null;
  if (status === 'HT') {
    displayClock = 'HT';
  } else if (elapsed !== null && ['1H', '2H', 'ET1', 'ET2'].includes(status)) {
    displayClock = `${elapsed}'`;
  }

  return {
    external_id:       `apf_${f.fixture.id}`,
    league_id:         ISRAELI_LEAGUE_ID,
    league_name:       'Israeli Premier League',
    home_team:         f.teams.home.name,
    away_team:         f.teams.away.name,
    home_team_badge:   null,
    away_team_badge:   null,
    kickoff_time:      f.fixture.date,
    status,
    home_score:        homeScore,
    away_score:        awayScore,
    halftime_home:     f.score.halftime.home,
    halftime_away:     f.score.halftime.away,
    season:            String(f.league.season),
    round:             f.league.round ?? null,
    corners_total:     null,
    regulation_home:   regulationHome,
    regulation_away:   regulationAway,
    went_to_penalties: wentToPen,
    penalty_home:      wentToPen ? f.score.penalty.home : null,
    penalty_away:      wentToPen ? f.score.penalty.away : null,
    red_cards_home:    null,
    red_cards_away:    null,
    display_clock:     displayClock,
  } satisfies DBMatch & DBMatchWithClock;
}

// ── Core fetch ─────────────────────────────────────────────────────────────────
async function fetchFixtures(params: Record<string, string | number>): Promise<DBMatchWithClock[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) {
    logger.warn('[apiFootball] API_FOOTBALL_KEY not set — skipping Israeli league');
    return [];
  }

  try {
    const { data } = await axios.get(`${BASE_URL}/fixtures`, {
      params,
      headers: { 'x-apisports-key': key, 'User-Agent': 'GoalBet/1.0' },
      timeout: 10_000,
    });

    const fixtures: ApfFixture[] = data?.response ?? [];
    logger.debug(`[apiFootball] ${fixtures.length} fixtures (params: ${JSON.stringify(params)})`);
    return fixtures.map(mapFixture);
  } catch (err) {
    logger.error('[apiFootball] Fetch failed:', err);
    return [];
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Fetch fixtures for a date window — called by matchSync ~2-3×/day.
 */
export async function fetchIsraeliLeagueMatches(
  daysBack = 7,
  daysAhead = 42,
): Promise<DBMatchWithClock[]> {
  const now  = new Date();
  const from = new Date(now.getTime() - daysBack  * 86_400_000);
  const to   = new Date(now.getTime() + daysAhead * 86_400_000);
  return fetchFixtures({ league: APF_LEAGUE_ID, season: APF_SEASON, from: formatDateISO(from), to: formatDateISO(to) });
}

/**
 * Fetch recent + live fixtures for score resolution — called by scoreUpdater,
 * but rate-limited externally to at most once per 5 minutes.
 */
export async function fetchIsraeliLiveScores(
  daysBack = 3,
  daysAhead = 1,
): Promise<DBMatchWithClock[]> {
  const now  = new Date();
  const from = new Date(now.getTime() - daysBack  * 86_400_000);
  const to   = new Date(now.getTime() + daysAhead * 86_400_000);
  return fetchFixtures({ league: APF_LEAGUE_ID, season: APF_SEASON, from: formatDateISO(from), to: formatDateISO(to) });
}
