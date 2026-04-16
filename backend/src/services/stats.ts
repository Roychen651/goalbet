/**
 * League Stats — standings + top scorers/assists from ESPN.
 *
 * Standings: https://site.web.api.espn.com/apis/v2/sports/soccer/{slug}/standings
 * Leaders:   https://site.web.api.espn.com/apis/site/v2/sports/soccer/{slug}/statistics?season={year}
 *
 * Both endpoints are free, no key required. Results are cached in-memory for 5 min
 * so the Stats page stays fast and we never hammer ESPN.
 */

import axios from 'axios';
import { logger } from '../lib/logger';
import { LEAGUE_ESPN_MAP } from './espn';

export interface StandingsRow {
  rank: number;
  team: {
    id: string;
    name: string;
    shortName: string;
    abbreviation: string;
    logo: string | null;
  };
  gp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export interface LeaderRow {
  rank: number;
  athleteId: string;
  name: string;
  shortName: string;
  teamName: string | null;
  teamLogo: string | null;
  value: number;
  matches: number | null;
  displayValue: string;
}

export interface StatsResponse {
  leagueId: number;
  slug: string;
  season: number;
  cachedAt: string;
  standings: StandingsRow[];
  leaders: { scorers: LeaderRow[]; assists: LeaderRow[] } | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
type CacheEntry = { data: StatsResponse; expiresAt: number };
const cache = new Map<number, CacheEntry>();

function statValue(stats: Record<string, unknown>[] | undefined, name: string): number {
  const s = stats?.find(x => x.name === name);
  if (!s) return 0;
  const v = typeof s.value === 'number' ? s.value : parseFloat(String(s.value ?? s.displayValue ?? '0'));
  return Number.isFinite(v) ? v : 0;
}

function pickLogo(logos: Record<string, unknown>[] | undefined): string | null {
  if (!logos || logos.length === 0) return null;
  const def = logos.find(l => {
    const rel = l.rel as string[] | undefined;
    return Array.isArray(rel) && rel.includes('default');
  });
  return String((def ?? logos[0]).href ?? '') || null;
}

async function fetchStandings(slug: string): Promise<StandingsRow[]> {
  const url = `https://site.web.api.espn.com/apis/v2/sports/soccer/${slug}/standings`;
  const { data } = await axios.get(url, { timeout: 10_000, headers: { 'User-Agent': 'GoalBet/1.0' } });

  // Primary league table usually sits at children[0].standings.entries
  const children = (data?.children as Record<string, unknown>[] | undefined) ?? [];
  const first = children[0] as Record<string, unknown> | undefined;
  const standingsNode = (first?.standings ?? data?.standings) as Record<string, unknown> | undefined;
  const entries = (standingsNode?.entries as Record<string, unknown>[] | undefined) ?? [];

  const rows: StandingsRow[] = [];
  for (const entry of entries) {
    const team = (entry.team as Record<string, unknown>) ?? {};
    const stats = (entry.stats as Record<string, unknown>[] | undefined) ?? [];
    const note = (entry.note as Record<string, unknown> | undefined);

    const rank = statValue(stats, 'rank') || (typeof note?.rank === 'number' ? (note.rank as number) : 0);

    rows.push({
      rank,
      team: {
        id: String(team.id ?? ''),
        name: String(team.displayName ?? team.name ?? ''),
        shortName: String(team.shortDisplayName ?? team.name ?? team.displayName ?? ''),
        abbreviation: String(team.abbreviation ?? '').toUpperCase(),
        logo: pickLogo(team.logos as Record<string, unknown>[] | undefined),
      },
      gp: statValue(stats, 'gamesPlayed'),
      w: statValue(stats, 'wins'),
      d: statValue(stats, 'ties'),
      l: statValue(stats, 'losses'),
      gf: statValue(stats, 'pointsFor'),
      ga: statValue(stats, 'pointsAgainst'),
      gd: statValue(stats, 'pointDifferential'),
      points: statValue(stats, 'points'),
    });
  }

  rows.sort((a, b) => (a.rank || 999) - (b.rank || 999));
  return rows;
}

function parseMatches(displayValue: string): number | null {
  const m = displayValue.match(/Matches:\s*(\d+)/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

function mapLeaderList(list: Record<string, unknown>[] | undefined): LeaderRow[] {
  if (!list) return [];
  const rows: LeaderRow[] = [];
  list.forEach((entry, idx) => {
    const athlete = (entry.athlete as Record<string, unknown> | undefined) ?? {};
    const team = (athlete.team as Record<string, unknown> | undefined) ?? (entry.team as Record<string, unknown> | undefined) ?? {};
    const displayValue = String(entry.displayValue ?? '');
    const value = typeof entry.value === 'number' ? entry.value : parseFloat(String(entry.value ?? '0'));

    rows.push({
      rank: idx + 1,
      athleteId: String(athlete.id ?? ''),
      name: String(athlete.displayName ?? athlete.shortName ?? 'Unknown'),
      shortName: String(athlete.shortName ?? athlete.displayName ?? 'Unknown'),
      teamName: team.displayName ? String(team.displayName) : team.name ? String(team.name) : null,
      teamLogo: String(team.logo ?? '') || pickLogo(team.logos as Record<string, unknown>[] | undefined),
      value: Number.isFinite(value) ? value : 0,
      matches: parseMatches(displayValue),
      displayValue,
    });
  });
  return rows.slice(0, 10);
}

async function fetchLeaders(slug: string, season: number): Promise<{ scorers: LeaderRow[]; assists: LeaderRow[] } | null> {
  const url = `https://site.web.api.espn.com/apis/site/v2/sports/soccer/${slug}/statistics?season=${season}`;
  try {
    const { data } = await axios.get(url, { timeout: 10_000, headers: { 'User-Agent': 'GoalBet/1.0' } });
    const stats = (data?.stats as Record<string, unknown>[] | undefined) ?? [];
    if (stats.length === 0) return null;

    const goalsNode = stats.find(s => s.name === 'goalsLeaders') ?? stats[0];
    const assistsNode = stats.find(s => s.name === 'assistsLeaders');

    const scorers = mapLeaderList(goalsNode?.leaders as Record<string, unknown>[] | undefined);
    const assists = mapLeaderList(assistsNode?.leaders as Record<string, unknown>[] | undefined);

    if (scorers.length === 0 && assists.length === 0) return null;
    return { scorers, assists };
  } catch (err) {
    logger.debug(`[stats] leaders fetch failed for ${slug}: ${err}`);
    return null;
  }
}

function currentSeason(): number {
  // ESPN labels a European season by its start year (e.g. 2025-26 = 2025).
  // Season starts ~August; before that we're still in the previous season.
  const now = new Date();
  const y = now.getUTCFullYear();
  return now.getUTCMonth() >= 6 ? y : y - 1;
}

export async function getLeagueStats(leagueId: number): Promise<StatsResponse | null> {
  const slug = LEAGUE_ESPN_MAP[leagueId];
  if (!slug) return null;

  const now = Date.now();
  const hit = cache.get(leagueId);
  if (hit && hit.expiresAt > now) return hit.data;

  const season = currentSeason();

  const [standings, leaders] = await Promise.all([
    fetchStandings(slug).catch(err => {
      logger.error(`[stats] standings fetch failed for ${slug}: ${err}`);
      return [] as StandingsRow[];
    }),
    fetchLeaders(slug, season),
  ]);

  if (standings.length === 0 && !leaders) return null;

  const data: StatsResponse = {
    leagueId,
    slug,
    season,
    cachedAt: new Date().toISOString(),
    standings,
    leaders,
  };

  cache.set(leagueId, { data, expiresAt: now + CACHE_TTL_MS });
  return data;
}
