import { useEffect, useState } from 'react';

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
}

export interface LeagueLeaders {
  scorers: LeaderRow[];
  assists: LeaderRow[];
  discipline: LeaderRow[];
}

export interface StatsResponse {
  leagueId: number;
  slug: string;
  season: number;
  cachedAt: string;
  standings: StandingsRow[];
  leaders: LeagueLeaders | null;
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

export function useLeagueStats(leagueId: number | null) {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (leagueId == null) {
      setData(null);
      return;
    }
    if (!BACKEND_URL) {
      setError('Backend URL not configured');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    fetch(`${BACKEND_URL}/api/stats/${leagueId}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) return null;
          throw new Error(`HTTP ${res.status}`);
        }
        return (await res.json()) as StatsResponse;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
      })
      .catch((err) => {
        if (cancelled) return;
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message);
        setData(null);
      })
      .finally(() => {
        clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [leagueId]);

  return { data, loading, error };
}

// V4 Sprint 27 — Interactive Team Sheets. Deliberately lazy: only called when
// a standings row is actually expanded (teamId non-null), never prefetched
// for the whole table. A tiny in-memory module cache (15 min, matching this
// sprint's caching mandate) means re-collapsing/re-expanding the same row —
// or a second row for a team someone already looked at — costs zero extra
// requests. This hand-rolled shape mirrors useLeagueStats above and will be
// folded into a real useQuery alongside it in Commit 4.
const TEAM_FORM_CACHE_TTL_MS = 15 * 60 * 1000;
const teamFormCache = new Map<string, { data: TeamFormResponse; expiresAt: number }>();

export function useTeamForm(leagueId: number | null, teamId: string | null) {
  const [data, setData] = useState<TeamFormResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (leagueId == null || !teamId) {
      setData(null);
      return;
    }
    if (!BACKEND_URL) {
      setError('Backend URL not configured');
      return;
    }

    const cacheKey = `${leagueId}:${teamId}`;
    const cached = teamFormCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setData(cached.data);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    fetch(`${BACKEND_URL}/api/stats/${leagueId}/team/${teamId}/form`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) return null;
          throw new Error(`HTTP ${res.status}`);
        }
        return (await res.json()) as TeamFormResponse;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        if (json) teamFormCache.set(cacheKey, { data: json, expiresAt: Date.now() + TEAM_FORM_CACHE_TTL_MS });
      })
      .catch((err) => {
        if (cancelled) return;
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message);
        setData(null);
      })
      .finally(() => {
        clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [leagueId, teamId]);

  return { data, loading, error };
}

// V4 Sprint 27 — The Pulse Feed. Lazy: enabled only decides whether this hook
// actually fetches, so a caller can mount it unconditionally and simply pass
// `enabled={newsCardsScrolledIntoView}` (or similar) without restructuring
// around conditional hook calls. 15-min cache, same shape as useTeamForm.
const NEWS_CACHE_TTL_MS = 15 * 60 * 1000;
const newsCache = new Map<number, { data: LeagueNewsResponse; expiresAt: number }>();

export function useLeagueNews(leagueId: number | null, enabled: boolean) {
  const [data, setData] = useState<LeagueNewsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (leagueId == null || !enabled) {
      return;
    }
    if (!BACKEND_URL) {
      setError('Backend URL not configured');
      return;
    }

    const cached = newsCache.get(leagueId);
    if (cached && cached.expiresAt > Date.now()) {
      setData(cached.data);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    fetch(`${BACKEND_URL}/api/stats/${leagueId}/news`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) return null;
          throw new Error(`HTTP ${res.status}`);
        }
        return (await res.json()) as LeagueNewsResponse;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        if (json) newsCache.set(leagueId, { data: json, expiresAt: Date.now() + NEWS_CACHE_TTL_MS });
      })
      .catch((err) => {
        if (cancelled) return;
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message);
        setData(null);
      })
      .finally(() => {
        clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [leagueId, enabled]);

  return { data, loading, error };
}
