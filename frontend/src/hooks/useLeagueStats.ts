import { useQuery } from '@tanstack/react-query';

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
  // V4 Sprint 27 — best-effort ESPN athlete headshot URL, may be null.
  // EntityBadge's built-in gradient-initials fallback covers a missing/broken
  // photo, so this is never a hard requirement on the render side.
  photo: string | null;
  value: number;
  matches: number | null;
  displayValue: string;
  // V5 Sprint 55 — populated ONLY on `discipline` rows. `value` there is a
  // weighted composite (red counts double a yellow — a stated modeling
  // choice, never a raw ESPN number); these two real counts are what the
  // UI actually renders, never the composite.
  yellowCards?: number;
  redCards?: number;
}

export interface LeagueLeaders {
  scorers: LeaderRow[];
  assists: LeaderRow[];
  discipline: LeaderRow[];
  // V5 Sprint 55 — season-long clean-sheet leaders. May legitimately be
  // empty (ESPN doesn't reliably expose this for every league/season) —
  // the frontend hides this category entirely when it is, same as every
  // other leader category already does.
  goalkeepers: LeaderRow[];
}

// V5 Sprint 55 — best-effort home/away standings split. Both arrays are
// empty (never fabricated) when ESPN doesn't expose a home/away variant
// for a given league — the frontend hides the toggle entirely in that case.
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
  // V5 Sprint 55 — teamId -> rank delta since the last real matchday this
  // backend process observed (positive = moved up). null whenever there's
  // no honest baseline yet (first fetch since a cold start, or no real
  // matchday has happened since) — see stats.ts's computeRankChanges() for
  // the full design and its stated in-memory/cold-start limitation.
  rankChanges: Record<string, number> | null;
}

// V4 Sprint 27 — Interactive Team Sheets
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
  matches: TeamFormMatch[];
  form: ('W' | 'D' | 'L')[];
  cornersPerMatch: number | null;
  cardsPerMatch: number | null;
  cleanSheets: number;
  cachedAt: string;
}

// V4 Sprint 27 — The Pulse Feed
export interface NewsArticle {
  id: string;
  headline: string;
  description: string | null;
  imageUrl: string | null;
  link: string | null;
  publishedAt: string | null;
}

export interface LeagueNewsResponse {
  leagueId: number;
  slug: string;
  cachedAt: string;
  articles: NewsArticle[];
}

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? '';

// V4 Sprint 27 Commit 4 — every statistics query on the Stats -> Leagues tab
// shares this exact 15-minute staleTime/gcTime. This data (ESPN standings,
// leaders, team form, news) moves at the pace of match rounds and news
// cycles, not live scores — a 15-min cache means switching between the
// Leagues/My Arena sub-tabs, or re-expanding a standings row already looked
// at, costs zero extra requests, while still catching up within one
// realistic browsing session. Deliberately outside AppShell's auto-sync
// (rule 4.3) for the same reason useStatsArena's 2-min staleTime already is.
const STATS_STALE_TIME_MS = 15 * 60 * 1000;
const STATS_GC_TIME_MS = 15 * 60 * 1000;

async function fetchJson<T>(path: string, signal: AbortSignal): Promise<T | null> {
  const res = await fetch(`${BACKEND_URL}${path}`, { signal });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export function useLeagueStats(leagueId: number | null) {
  const query = useQuery<StatsResponse | null>({
    queryKey: ['leagueStats', leagueId],
    queryFn: ({ signal }) => fetchJson<StatsResponse>(`/api/stats/${leagueId}`, signal),
    enabled: leagueId != null && !!BACKEND_URL,
    staleTime: STATS_STALE_TIME_MS,
    gcTime: STATS_GC_TIME_MS,
  });

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  };
}

// V4 Sprint 27 — Interactive Team Sheets. `enabled` only turns true once a
// standings row is actually expanded (teamId non-null) — never prefetched
// for the whole table. The shared 15-min staleTime means re-collapsing/
// re-expanding the same row, or a second row for a team someone already
// looked at, costs zero extra requests — TanStack Query's own cache now
// does what Commit 2's hand-rolled module Map did, so that Map is gone.
export function useTeamForm(leagueId: number | null, teamId: string | null) {
  const query = useQuery<TeamFormResponse | null>({
    queryKey: ['leagueTeamForm', leagueId, teamId],
    queryFn: ({ signal }) => fetchJson<TeamFormResponse>(`/api/stats/${leagueId}/team/${teamId}/form`, signal),
    enabled: leagueId != null && !!teamId && !!BACKEND_URL,
    staleTime: STATS_STALE_TIME_MS,
    gcTime: STATS_GC_TIME_MS,
  });

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  };
}

// V4 Sprint 27 — The Pulse Feed. `enabled` gates on the Leagues sub-tab
// actually being open (not World Cup's custom view, not My Arena) — true
// lazy loading, matching this sprint's mandate, now expressed as a real
// TanStack `enabled` flag instead of a hand-rolled `if (!active) return`.
export function useLeagueNews(leagueId: number | null, enabled: boolean) {
  const query = useQuery<LeagueNewsResponse | null>({
    queryKey: ['leagueNews', leagueId],
    queryFn: ({ signal }) => fetchJson<LeagueNewsResponse>(`/api/stats/${leagueId}/news`, signal),
    enabled: enabled && leagueId != null && !!BACKEND_URL,
    staleTime: STATS_STALE_TIME_MS,
    gcTime: STATS_GC_TIME_MS,
  });

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  };
}
