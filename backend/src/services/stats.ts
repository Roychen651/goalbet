/**
 * League Stats — standings + top scorers/assists from ESPN.
 *
 * Standings: https://site.web.api.espn.com/apis/v2/sports/soccer/{slug}/standings
 * Leaders:   https://site.web.api.espn.com/apis/site/v2/sports/soccer/{slug}/statistics?season={year}
 *
 * Both endpoints are free, no key required. Results are cached in-memory for 5 min
 * so the Stats page stays fast and we never hammer ESPN.
 */

import { logger } from '../lib/logger';
import { espnGet } from '../lib/espnHttp';
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
  // V4 Sprint 27 — best-effort ESPN athlete headshot URL. This sandbox cannot
  // reach ESPN's API to verify the real field name/shape (site.web.api.espn.com
  // is 403'd on the outbound CONNECT tunnel here), so this reads the
  // conventional `athlete.headshot.href` shape used elsewhere in ESPN's site
  // API family, with graceful null fallback. EntityBadge already renders a
  // gradient-initials fallback for any null/broken URL — a wrong guess here
  // degrades silently, it never breaks the UI.
  photo: string | null;
  value: number;
  matches: number | null;
  displayValue: string;
  // V5 Sprint 55 — populated ONLY on `discipline` rows. `value` there is a
  // weighted composite (see combineDisciplineLists — red counts double a
  // yellow, a stated modeling choice, never a raw ESPN number), so these
  // two real counts are carried alongside it for the frontend to render
  // honestly instead of showing the composite as if it were a card count.
  yellowCards?: number;
  redCards?: number;
}

export interface LeagueLeaders {
  scorers: LeaderRow[];
  assists: LeaderRow[];
  // V4 Sprint 27 — "Discipline" category. V5 Sprint 55 — now blends BOTH
  // yellowCardsLeaders and a best-effort redCardsLeaders node into one
  // combined, re-sorted list (red card weighted 2x a yellow — a stated
  // modeling choice, not a real ESPN-provided composite score) rather than
  // giving red cards their own near-always-empty tab. Same graceful-null
  // pattern as scorers/assists throughout.
  discipline: LeaderRow[];
  // V5 Sprint 55 — season-long clean-sheet leaders (goalkeepers). NOT
  // derived from getTeamForm()'s last-5-matches window below — that would
  // dishonestly label a 5-match sample as a season leaderboard. Sourced
  // from ESPN's own statistics endpoint (best-effort node name, same
  // unverifiable-from-this-sandbox caveat as every other best-effort field
  // in this file), gracefully empty when the endpoint doesn't expose it.
  goalkeepers: LeaderRow[];
}

// V5 Sprint 55 — home/away standings split. ESPN's soccer /standings
// endpoint sometimes exposes secondary standings variants inside the same
// `children[]` array as the primary "Total" table (e.g. entries tagged
// "Home"/"Away" by name/type) — this sandbox cannot reach ESPN to confirm
// the exact tagging convention, so parseHomeAwaySplits() below is a
// best-effort, name-matching heuristic. When ESPN doesn't expose this
// shape for a given league, both arrays come back empty and the frontend
// simply never renders the home/away toggle — never a fabricated split.
export interface HomeAwaySplits {
  home: StandingsRow[];
  away: StandingsRow[];
}

export interface StatsResponse {
  leagueId: number;
  slug: string;
  season: number;
  cachedAt: string;
  standings: StandingsRow[];
  homeAwaySplits: HomeAwaySplits | null;
  leaders: LeagueLeaders | null;
  // V5 Sprint 55 — per-team rank delta since the last time this league's
  // standings genuinely changed (a real matchday occurred, not just a
  // cache-tick). See computeRankChanges() below for the honest limitation.
  rankChanges: Record<string, number> | null; // teamId -> delta (positive = moved up)
  // V5 Sprint 55 hotfix — true when `standings` is the FALLBACK table (the
  // most recently completed season), not the requested current season.
  // Real, live-reported confusion: a new UEFA cup season's league-phase
  // table has no rows for weeks after qualifying rounds begin (see the
  // fallback comment on getLeagueStats() below), so the fallback silently
  // showed last season's completed final table with nothing in the UI
  // indicating it wasn't current. The frontend renders an explicit label
  // whenever this is true — never a silent "looks current" table.
  isFallbackSeason: boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
type CacheEntry = { data: StatsResponse; expiresAt: number };
const cache = new Map<number, CacheEntry>();

// V5 Sprint 55 Commit 2 — a deliberately lightweight, in-memory-only
// position-change tracker. No new DB table: a real historical-standings
// snapshot system is a legitimate, larger feature this "stats page
// redesign" sprint doesn't need to carry. Honest limitation, stated
// plainly: this Map lives in the Node process's memory only — Render's
// free tier sleeps after ~15 min idle, so a cold start wipes it and the
// very first computeRankChanges() call after any restart correctly
// returns null (no baseline to diff against yet) rather than fabricating
// a "no change" or a wrong delta. The next real matchday after that
// restart re-establishes a fresh, honest baseline.
interface RankSnapshotEntry { rank: number; gp: number }
const previousStandingsSnapshots = new Map<number, Map<string, RankSnapshotEntry>>();

// Deliberately gated on `gp` (games played) actually changing for at least
// one team before treating anything as "changed" — a naive diff-every-
// cache-tick approach would almost always show zero movement (ranks don't
// move within a random 5-minute window) and could show a spurious delta if
// ESPN's rank field briefly flickers mid-fetch for an unrelated reason.
// Gating on gp is the closest honest proxy available for "did a real
// matchday actually happen since we last looked," without needing to know
// the exact fixture schedule.
function computeRankChanges(leagueId: number, currentRows: StandingsRow[]): Record<string, number> | null {
  const previous = previousStandingsSnapshots.get(leagueId);

  const currentSnapshot = new Map<string, RankSnapshotEntry>();
  for (const row of currentRows) {
    if (!row.team.id) continue;
    currentSnapshot.set(row.team.id, { rank: row.rank, gp: row.gp });
  }

  if (!previous) {
    // First time seeing this league this process lifetime (or since the
    // last cold start) — establish the baseline, nothing to diff yet.
    previousStandingsSnapshots.set(leagueId, currentSnapshot);
    return null;
  }

  const realMatchdayHappened = currentRows.some(row => {
    const prevEntry = row.team.id ? previous.get(row.team.id) : undefined;
    return prevEntry != null && prevEntry.gp !== row.gp;
  });

  if (!realMatchdayHappened) {
    // Nothing meaningful changed since the last real snapshot — leave the
    // stored baseline untouched so a FUTURE real matchday still diffs
    // against the correct pre-matchday state, not this no-op tick.
    return null;
  }

  const changes: Record<string, number> = {};
  for (const row of currentRows) {
    if (!row.team.id) continue;
    const prevEntry = previous.get(row.team.id);
    if (!prevEntry) continue; // not in the previous snapshot — no honest delta to show
    const delta = prevEntry.rank - row.rank; // positive = moved up (lower rank number is better)
    if (delta !== 0) changes[row.team.id] = delta;
  }

  previousStandingsSnapshots.set(leagueId, currentSnapshot);
  return Object.keys(changes).length > 0 ? changes : null;
}

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

// Extracted the moment a second real consumer (the home/away variant parse
// below) needed the identical entries[]-to-StandingsRow[] mapping — the
// same "extract on the second real consumer" precedent this codebase
// applies elsewhere (lib/espnEvents.ts, teamNameUtils.ts). Every line here
// is unchanged from what fetchStandings() used to do inline.
function mapStandingsEntries(entries: Record<string, unknown>[]): StandingsRow[] {
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

// Best-effort scan of ESPN's `children[]` array for secondary standings
// variants tagged as home/away splits — unverifiable from this sandbox
// (see the LeaderRow.photo comment above), so this only matches on an
// obvious name/type substring rather than assuming a specific field. Any
// child that doesn't match either pattern (the overwhelming common case:
// ESPN usually returns only the one "Total" table) is simply ignored —
// this never throws and never fabricates a split that isn't really there.
function parseHomeAwaySplits(children: Record<string, unknown>[]): HomeAwaySplits | null {
  let home: StandingsRow[] = [];
  let away: StandingsRow[] = [];

  for (const child of children) {
    const label = String((child.name ?? child.type ?? child.abbreviation ?? '')).toLowerCase();
    const standingsNode = child.standings as Record<string, unknown> | undefined;
    const entries = (standingsNode?.entries as Record<string, unknown>[] | undefined) ?? [];
    if (entries.length === 0) continue;

    if (label.includes('home')) home = mapStandingsEntries(entries);
    else if (label.includes('away') || label.includes('road')) away = mapStandingsEntries(entries);
  }

  if (home.length === 0 && away.length === 0) return null;
  return { home, away };
}

// Exported — V7 Sprint 56 archive follow-up: `seasonArchive.ts` reuses this
// exact function (never a second, independently-written ESPN standings
// fetch) to snapshot a just-completed season's final table. Same
// "extract/export on the second real consumer" precedent this codebase
// already applies elsewhere.
export async function fetchStandings(slug: string, season: number): Promise<{ rows: StandingsRow[]; homeAwaySplits: HomeAwaySplits | null }> {
  // Hotfix — this endpoint previously had NO season param at all, while its
  // sibling fetchLeaders() call (below) always has, using the exact same
  // currentSeason() value. Reported live: Stats still showed last season's
  // FINAL Champions League table well into the new season's qualifying
  // window — consistent with ESPN's own undocumented default for a
  // season-less /standings request lagging behind a genuinely new season
  // whose league-phase table has no rows yet (only pre-season qualifiers
  // have played, which don't populate the 36-team league table). This
  // sandbox cannot verify ESPN's real response shape for this endpoint
  // (see the LeaderRow.photo comment above for why), so rather than guess
  // at ESPN's default behavior, this makes the two already-adjacent calls
  // in this same file internally consistent — reusing the identical
  // `season` value fetchLeaders() already proves out, never a second,
  // independently-computed one. If ESPN's /standings endpoint ignores an
  // explicit season param, this is a harmless no-op; if it honors it
  // (a common, standard ESPN site-API parameter), it fixes the stale
  // table. Either way, showing an honestly-empty table for a season with
  // no league-phase matches yet is more correct than silently showing a
  // finished, unrelated season's final standings.
  const url = `https://site.web.api.espn.com/apis/v2/sports/soccer/${slug}/standings?season=${season}`;
  const data = await espnGet<any>(url, { timeout: 10_000, headers: { 'User-Agent': 'GoalBet/1.0' } });

  // Primary league table usually sits at children[0].standings.entries
  const children = (data?.children as Record<string, unknown>[] | undefined) ?? [];
  const first = children[0] as Record<string, unknown> | undefined;
  const standingsNode = (first?.standings ?? data?.standings) as Record<string, unknown> | undefined;
  const entries = (standingsNode?.entries as Record<string, unknown>[] | undefined) ?? [];

  const rows = mapStandingsEntries(entries);
  // V5 Sprint 55 — scan the REMAINING children (index 1+) for a home/away
  // variant, if ESPN happens to expose one for this league. Zero extra HTTP
  // requests — reuses the exact same response this function already fetched.
  const homeAwaySplits = parseHomeAwaySplits(children.slice(1));

  return { rows, homeAwaySplits };
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

    const headshot = (athlete.headshot as Record<string, unknown> | undefined);

    rows.push({
      rank: idx + 1,
      athleteId: String(athlete.id ?? ''),
      name: String(athlete.displayName ?? athlete.shortName ?? 'Unknown'),
      shortName: String(athlete.shortName ?? athlete.displayName ?? 'Unknown'),
      teamName: team.displayName ? String(team.displayName) : team.name ? String(team.name) : null,
      teamLogo: String(team.logo ?? '') || pickLogo(team.logos as Record<string, unknown>[] | undefined),
      photo: (headshot?.href ? String(headshot.href) : null),
      value: Number.isFinite(value) ? value : 0,
      matches: parseMatches(displayValue),
      displayValue,
    });
  });
  return rows.slice(0, 10);
}

// V5 Sprint 55 — merges yellow-card and red-card leader lists into one
// "Discipline" list, keyed by athleteId (falling back to name for any
// player ESPN's red-card node happens to key differently). A red card
// counts double a yellow toward the sort order — a stated modeling
// choice, not a real ESPN-provided composite score — so a player who's
// been sent off ranks appropriately above one with only yellows. The real
// yellow/red counts are carried on the row (see LeaderRow.yellowCards/
// redCards) so the frontend renders honest numbers, never the composite.
function combineDisciplineLists(yellow: LeaderRow[], red: LeaderRow[]): LeaderRow[] {
  const byAthlete = new Map<string, LeaderRow & { yellows: number; reds: number }>();

  for (const row of yellow) {
    const key = row.athleteId || row.name;
    byAthlete.set(key, { ...row, yellows: row.value, reds: 0 });
  }
  for (const row of red) {
    const key = row.athleteId || row.name;
    const existing = byAthlete.get(key);
    if (existing) existing.reds = row.value;
    else byAthlete.set(key, { ...row, yellows: 0, reds: row.value });
  }

  const combined = Array.from(byAthlete.values()).map(r => ({
    ...r,
    value: r.yellows + r.reds * 2,
    yellowCards: r.yellows,
    redCards: r.reds,
  }));
  combined.sort((a, b) => b.value - a.value);
  return combined.slice(0, 10).map((row, idx) => ({ ...row, rank: idx + 1 }));
}

// Exported for the same reason as fetchStandings() above.
export async function fetchLeaders(slug: string, season: number): Promise<LeagueLeaders | null> {
  const url = `https://site.web.api.espn.com/apis/site/v2/sports/soccer/${slug}/statistics?season=${season}`;
  try {
    const data = await espnGet<any>(url, { timeout: 10_000, headers: { 'User-Agent': 'GoalBet/1.0' } });
    const stats = (data?.stats as Record<string, unknown>[] | undefined) ?? [];
    if (stats.length === 0) return null;

    const goalsNode = stats.find(s => s.name === 'goalsLeaders') ?? stats[0];
    const assistsNode = stats.find(s => s.name === 'assistsLeaders');
    // V4 Sprint 27 — "Discipline" (most-carded players). Best-effort node
    // name guess (unverifiable from this sandbox, see the LeaderRow.photo
    // comment above for why) — gracefully returns an empty array via
    // mapLeaderList(undefined) if ESPN doesn't expose this node for a given
    // league/season, never throws. V5 Sprint 55 — now also tries a
    // red-cards node (equally unverifiable, parallel-construction guess to
    // the already-confirmed-live yellowCardsLeaders name) and blends both.
    const yellowNode = stats.find(s => s.name === 'yellowCardsLeaders');
    const redNode = stats.find(s => s.name === 'redCardsLeaders');
    // V5 Sprint 55 — season-long clean-sheet/goalkeeper leaders. This one
    // is a genuinely weaker guess than the others above: unlike
    // yellow->red (a confirmed sibling to model from), there's no prior
    // confirmed ESPN node name in this codebase's history to lean on for a
    // clean-sheet leaderboard. Two candidate names are tried in order;
    // first one that returns real rows wins. If neither exists for this
    // league/season, goalkeepers comes back empty and the frontend simply
    // never renders that leaders category — same graceful degradation as
    // every other best-effort field here.
    const gkNode = stats.find(s => s.name === 'cleanSheetsLeaders') ?? stats.find(s => s.name === 'shutoutsLeaders');

    const scorers = mapLeaderList(goalsNode?.leaders as Record<string, unknown>[] | undefined);
    const assists = mapLeaderList(assistsNode?.leaders as Record<string, unknown>[] | undefined);
    const yellowLeaders = mapLeaderList(yellowNode?.leaders as Record<string, unknown>[] | undefined);
    const redLeaders = mapLeaderList(redNode?.leaders as Record<string, unknown>[] | undefined);
    const discipline = combineDisciplineLists(yellowLeaders, redLeaders);
    const goalkeepers = mapLeaderList(gkNode?.leaders as Record<string, unknown>[] | undefined);

    if (scorers.length === 0 && assists.length === 0 && discipline.length === 0 && goalkeepers.length === 0) return null;
    return { scorers, assists, discipline, goalkeepers };
  } catch (err) {
    logger.debug(`[stats] leaders fetch failed for ${slug}: ${err}`);
    return null;
  }
}

// Exported — `seasonArchive.ts` derives "the most recently completed
// season" as `currentSeason() - 1`, the EXACT value getLeagueStats()'s own
// fallback path above already treats as "the most recent table ESPN has
// fully populated." Reusing this one function is what guarantees the two
// never drift into disagreeing about which season just ended.
export function currentSeason(): number {
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

  let [standingsResult, leaders] = await Promise.all([
    fetchStandings(slug, season).catch(err => {
      logger.error(`[stats] standings fetch failed for ${slug} season=${season}: ${err}`);
      return { rows: [] as StandingsRow[], homeAwaySplits: null as HomeAwaySplits | null };
    }),
    fetchLeaders(slug, season),
  ]);
  let { rows: standings, homeAwaySplits } = standingsResult;

  // Fallback — the current season's table can genuinely have zero rows for
  // a real reason: a new UEFA cup season's league-phase table has no
  // entries until its first league-phase matchday, weeks after qualifying
  // rounds begin (currentSeason() already rolled over to the new year the
  // moment July starts). Rather than show nothing, fall back one season so
  // the page always shows the most recent table ESPN has actually
  // populated — the moment the new season's table gets real rows, the
  // primary (non-fallback) fetch above picks it up automatically on the
  // next 5-min cache expiry, with zero code change needed.
  let effectiveSeason = season;
  let isFallbackSeason = false;
  if (standings.length === 0) {
    const fallbackSeason = season - 1;
    const fallback = await fetchStandings(slug, fallbackSeason).catch(err => {
      logger.error(`[stats] fallback standings fetch failed for ${slug} season=${fallbackSeason}: ${err}`);
      return { rows: [] as StandingsRow[], homeAwaySplits: null as HomeAwaySplits | null };
    });
    if (fallback.rows.length > 0) {
      logger.info(`[stats] ${slug}: season=${season} standings empty, using season=${fallbackSeason} fallback (${fallback.rows.length} rows)`);
      standings = fallback.rows;
      homeAwaySplits = fallback.homeAwaySplits;
      effectiveSeason = fallbackSeason;
      isFallbackSeason = true;
    }
  }

  if (standings.length === 0 && !leaders) return null;

  // V5 Sprint 55 Commit 2 — see computeRankChanges()'s own header comment
  // for the honest in-memory-only, gp-gated design and its stated
  // Render-cold-start limitation.
  const rankChanges = computeRankChanges(leagueId, standings);

  const data: StatsResponse = {
    leagueId,
    slug,
    season: effectiveSeason,
    cachedAt: new Date().toISOString(),
    standings,
    homeAwaySplits,
    leaders,
    rankChanges,
    isFallbackSeason,
  };

  cache.set(leagueId, { data, expiresAt: now + CACHE_TTL_MS });
  return data;
}

// ─── V4 Sprint 27 — Interactive Team Sheets: per-team form + recent-match stats ───
//
// Deliberately reuses the SAME scoreboard endpoint + `competitor.statistics[]`
// field names (`wonCorners`, `redCards`) already proven live in espn.ts's
// match-sync pipeline, rather than guessing at a brand-new, unverified
// `teams/{id}/schedule` endpoint shape — this sandbox cannot reach ESPN
// directly to check one (see the LeaderRow.photo comment above), so reusing
// an endpoint this codebase already depends on in production is the lower-risk
// choice. `yellowCards` is the one genuinely unverified field name here
// (parallel construction to the confirmed `redCards`); it degrades to null
// gracefully via the same `getStat()` helper if ESPN doesn't expose it.

export interface TeamFormMatch {
  eventId: string;
  date: string;
  opponent: string;
  opponentLogo: string | null;
  isHome: boolean;
  teamScore: number;
  opponentScore: number;
  result: 'W' | 'D' | 'L';
  corners: number | null;
  cards: number | null;
  cleanSheet: boolean;
}

export interface TeamFormResponse {
  teamId: string;
  leagueId: number;
  matches: TeamFormMatch[]; // newest-first, up to 5
  form: ('W' | 'D' | 'L')[]; // oldest -> newest, for left-to-right reading
  cornersPerMatch: number | null;
  cardsPerMatch: number | null;
  cleanSheets: number;
  cachedAt: string;
}

const TEAM_FORM_CACHE_TTL_MS = 15 * 60 * 1000; // Sprint 27's 15-minute caching mandate
type TeamFormCacheEntry = { data: TeamFormResponse; expiresAt: number };
const teamFormCache = new Map<string, TeamFormCacheEntry>();

function getCompetitorStat(competitor: Record<string, unknown>, name: string): number | null {
  const stats = (competitor.statistics as Record<string, unknown>[] | undefined) ?? [];
  const s = stats.find(st => st.name === name);
  if (!s) return null;
  const v = parseInt(String(s.displayValue ?? s.value ?? ''), 10);
  return isNaN(v) ? null : v;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatEspnDate(d: Date): string {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

export async function getTeamForm(leagueId: number, teamId: string): Promise<TeamFormResponse | null> {
  const slug = LEAGUE_ESPN_MAP[leagueId];
  if (!slug) return null;

  const cacheKey = `${leagueId}:${teamId}`;
  const now = Date.now();
  const hit = teamFormCache.get(cacheKey);
  if (hit && hit.expiresAt > now) return hit.data;

  const to = new Date();
  const from = new Date(to.getTime() - 60 * 86_400_000); // 60-day lookback — enough for ≥5 played matches even for continental teams with sparser fixture lists
  const dateRange = `${formatEspnDate(from)}-${formatEspnDate(to)}`;
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?limit=200&dates=${dateRange}`;

  try {
    const data = await espnGet<any>(url, { timeout: 10_000, headers: { 'User-Agent': 'GoalBet/1.0' } });
    const events = (data?.events as Record<string, unknown>[] | undefined) ?? [];

    const teamMatches: TeamFormMatch[] = [];
    for (const event of events) {
      const comp = (event.competitions as Record<string, unknown>[] | undefined)?.[0];
      if (!comp) continue;

      const status = comp.status as Record<string, unknown> | undefined;
      const statusType = status?.type as Record<string, unknown> | undefined;
      const state = (statusType?.state as string | undefined) ?? 'pre';
      if (state !== 'post') continue; // only finished matches count toward form — same 'post' state espn.ts already trusts

      const competitors = (comp.competitors as Record<string, unknown>[] | undefined) ?? [];
      const home = competitors.find(c => c.homeAway === 'home');
      const away = competitors.find(c => c.homeAway === 'away');
      if (!home || !away) continue;

      const homeTeam = (home.team as Record<string, unknown>) ?? {};
      const awayTeam = (away.team as Record<string, unknown>) ?? {};
      const isHome = String(homeTeam.id ?? '') === teamId;
      const isAway = String(awayTeam.id ?? '') === teamId;
      if (!isHome && !isAway) continue;

      const homeScore = parseInt(String(home.score ?? '0'), 10) || 0;
      const awayScore = parseInt(String(away.score ?? '0'), 10) || 0;
      const teamScore = isHome ? homeScore : awayScore;
      const opponentScore = isHome ? awayScore : homeScore;
      const opponentTeam = isHome ? awayTeam : homeTeam;
      const teamCompetitor = (isHome ? home : away) as Record<string, unknown>;

      const matchResult: 'W' | 'D' | 'L' = teamScore > opponentScore ? 'W' : teamScore < opponentScore ? 'L' : 'D';
      const corners = getCompetitorStat(teamCompetitor, 'wonCorners');
      const redCards = getCompetitorStat(teamCompetitor, 'redCards');
      const yellowCards = getCompetitorStat(teamCompetitor, 'yellowCards');
      const cards = redCards !== null || yellowCards !== null ? (redCards ?? 0) + (yellowCards ?? 0) : null;

      teamMatches.push({
        eventId: String(event.id ?? ''),
        date: String(comp.date ?? ''),
        opponent: String(opponentTeam.displayName ?? opponentTeam.name ?? ''),
        opponentLogo: pickLogo(opponentTeam.logos as Record<string, unknown>[] | undefined) ?? (String(opponentTeam.logo ?? '') || null),
        isHome,
        teamScore,
        opponentScore,
        result: matchResult,
        corners,
        cards,
        cleanSheet: opponentScore === 0,
      });
    }

    teamMatches.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest-first
    const last5 = teamMatches.slice(0, 5);

    const cornersValues = last5.map(m => m.corners).filter((v): v is number => v !== null);
    const cardsValues = last5.map(m => m.cards).filter((v): v is number => v !== null);

    const response: TeamFormResponse = {
      teamId,
      leagueId,
      matches: last5,
      form: [...last5].reverse().map(m => m.result),
      cornersPerMatch: cornersValues.length > 0 ? cornersValues.reduce((a, b) => a + b, 0) / cornersValues.length : null,
      cardsPerMatch: cardsValues.length > 0 ? cardsValues.reduce((a, b) => a + b, 0) / cardsValues.length : null,
      cleanSheets: last5.filter(m => m.cleanSheet).length,
      cachedAt: new Date().toISOString(),
    };

    teamFormCache.set(cacheKey, { data: response, expiresAt: now + TEAM_FORM_CACHE_TTL_MS });
    return response;
  } catch (err) {
    logger.debug(`[stats] team form fetch failed for ${slug}/${teamId}: ${err}`);
    return null;
  }
}
