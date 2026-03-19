import axios from 'axios';
import { logger } from '../lib/logger';

// TheSportsDB free tier uses API key "3"
const BASE_URL = 'https://www.thesportsdb.com/api/v1/json/3';

// Rate limiter — 100 calls/day free tier
// We cap at 90 to keep a buffer
const DAILY_LIMIT = 90;
let dailyCallCount = 0;
let lastResetDate = new Date().toDateString();

function checkRateLimit(): void {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    dailyCallCount = 0;
    lastResetDate = today;
    logger.info(`[SportsDB] Daily rate limit counter reset`);
  }
  if (dailyCallCount >= DAILY_LIMIT) {
    throw new Error(`TheSportsDB daily rate limit reached (${DAILY_LIMIT} calls). Try again tomorrow.`);
  }
}

async function fetchWithRateLimit<T>(url: string): Promise<T> {
  checkRateLimit();
  try {
    const response = await axios.get<T>(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'GoalBet/1.0 (friend group prediction game)' },
    });
    dailyCallCount++;
    logger.debug(`[SportsDB] API call #${dailyCallCount}/${DAILY_LIMIT}: ${url}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      logger.warn('[SportsDB] Rate limited by API (429), pausing calls for this request');
      throw new Error('TheSportsDB rate limit exceeded');
    }
    throw error;
  }
}

export interface SportsDBEvent {
  idEvent: string;
  idLeague: string;
  strLeague: string;
  strHomeTeam: string;
  strAwayTeam: string;
  strHomeTeamBadge?: string;
  strAwayTeamBadge?: string;
  dateEvent: string;
  strTime: string | null;
  strStatus: string | null;
  intHomeScore: string | null;
  intAwayScore: string | null;
  intHomeScoreHalf: string | null;
  intAwayScoreHalf: string | null;
  strSeason: string | null;
  intRound: string | null;
}

export interface SportsDBLeague {
  idLeague: string;
  strLeague: string;
  strSport: string;
  strLeagueAlternate?: string;
  intFormedYear?: string;
  strCountry?: string;
  strBadge?: string;
}

export interface DBMatch {
  external_id: string;
  league_id: number;
  league_name: string;
  home_team: string;
  away_team: string;
  home_team_badge: string | null;
  away_team_badge: string | null;
  kickoff_time: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  halftime_home: number | null;
  halftime_away: number | null;
  season: string | null;
  round: string | null;
  corners_total: number | null;
  // Set only when match went to ET/penalties — stores the 90-minute score for correct prediction scoring
  regulation_home: number | null;
  regulation_away: number | null;
  went_to_penalties: boolean;
  // Penalty shootout score (only set when went_to_penalties = true)
  penalty_home: number | null;
  penalty_away: number | null;
}

// Map TheSportsDB status strings to our status codes
function mapStatus(strStatus: string | null): string {
  if (!strStatus) return 'NS';
  const s = strStatus.toLowerCase().trim();
  if (s === 'match finished' || s === 'ft' || s === 'aet' || s === 'pen') return 'FT';
  if (s === 'half time' || s === 'ht') return 'HT';
  if (s === 'in progress' || s === 'live' || s === '1h') return '1H';
  if (s === '2h') return '2H';
  if (s === 'postponed' || s === 'pst') return 'PST';
  if (s === 'cancelled' || s === 'canc' || s === 'canceled') return 'CANC';
  if (s === 'not started' || s === 'ns' || s === '') return 'NS';
  return 'NS';
}

// Parse score safely — returns null for upcoming matches, 0 is valid for finished matches
function parseScore(val: string | null, status: string): number | null {
  if (val === null || val === undefined || val === '') return null;
  const parsed = parseInt(val, 10);
  if (isNaN(parsed)) return null;
  // Only trust 0 if match is not "Not Started"
  if (parsed === 0 && status === 'NS') return null;
  return parsed;
}

export function transformEvent(event: SportsDBEvent): DBMatch {
  const status = mapStatus(event.strStatus);

  // Combine date + time carefully
  let kickoffTime: string;
  try {
    const timeStr = event.strTime || '12:00:00+00:00';
    // Some entries have timezone already, some don't
    const combined = `${event.dateEvent}T${timeStr}`;
    kickoffTime = new Date(combined).toISOString();
  } catch {
    kickoffTime = new Date(`${event.dateEvent}T12:00:00Z`).toISOString();
  }

  return {
    external_id: event.idEvent,
    league_id: parseInt(event.idLeague, 10),
    league_name: event.strLeague,
    home_team: event.strHomeTeam,
    away_team: event.strAwayTeam,
    home_team_badge: event.strHomeTeamBadge || null,
    away_team_badge: event.strAwayTeamBadge || null,
    kickoff_time: kickoffTime,
    status,
    home_score: parseScore(event.intHomeScore, status),
    away_score: parseScore(event.intAwayScore, status),
    halftime_home: parseScore(event.intHomeScoreHalf, status),
    halftime_away: parseScore(event.intAwayScoreHalf, status),
    season: event.strSeason || null,
    round: event.intRound || null,
    corners_total: null,
    regulation_home: null,
    regulation_away: null,
    went_to_penalties: false,
    penalty_home: null,
    penalty_away: null,
  };
}

// Cached league list (only fetched once per process lifetime)
let cachedLeagues: SportsDBLeague[] | null = null;

export async function getAllFootballLeagues(): Promise<SportsDBLeague[]> {
  if (cachedLeagues) return cachedLeagues;

  const data = await fetchWithRateLimit<{ leagues: SportsDBLeague[] | null }>(
    `${BASE_URL}/all_leagues.php`
  );

  const leagues = (data.leagues || []).filter(l => l.strSport === 'Soccer');
  cachedLeagues = leagues;
  logger.info(`[SportsDB] Loaded ${leagues.length} football leagues`);
  return leagues;
}

export async function getNextEvents(leagueId: number): Promise<DBMatch[]> {
  const data = await fetchWithRateLimit<{ events: SportsDBEvent[] | null }>(
    `${BASE_URL}/eventsnextleague.php?id=${leagueId}`
  );
  if (!data.events) return [];
  return data.events.map(transformEvent);
}

export async function getPastEvents(leagueId: number): Promise<DBMatch[]> {
  const data = await fetchWithRateLimit<{ events: SportsDBEvent[] | null }>(
    `${BASE_URL}/eventspastleague.php?id=${leagueId}`
  );
  if (!data.events) return [];
  return data.events.map(transformEvent);
}

export async function getSeasonEvents(leagueId: number, season: string): Promise<DBMatch[]> {
  const data = await fetchWithRateLimit<{ events: SportsDBEvent[] | null }>(
    `${BASE_URL}/eventsseason.php?id=${leagueId}&s=${season}`
  );
  if (!data.events) return [];
  return data.events.map(transformEvent);
}

export function getRemainingCallsToday(): number {
  const today = new Date().toDateString();
  if (today !== lastResetDate) return DAILY_LIMIT;
  return Math.max(0, DAILY_LIMIT - dailyCallCount);
}
