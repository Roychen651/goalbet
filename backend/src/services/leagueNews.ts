/**
 * League News — "The Pulse Feed" (V4 Sprint 27).
 *
 * https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/news
 *
 * Free, no key required, JSON (not RSS/XML — no parsing library needed).
 * This sandbox cannot reach ESPN directly to confirm the exact response
 * shape (see stats.ts's LeaderRow.photo comment for the same constraint),
 * so field extraction below follows the well-established ESPN site-API
 * news-article convention (headline/description/images/links.web.href)
 * used across every ESPN sport, with full graceful degradation — a wrong
 * field-name guess just produces fewer/emptier cards, never a crash.
 *
 * Results are cached in-memory for 15 minutes, matching this sprint's
 * caching mandate for every statistics-adjacent query.
 */

import axios from 'axios';
import { logger } from '../lib/logger';
import { LEAGUE_ESPN_MAP } from './espn';

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

const CACHE_TTL_MS = 15 * 60 * 1000;
type CacheEntry = { data: LeagueNewsResponse; expiresAt: number };
const cache = new Map<number, CacheEntry>();

function pickImage(images: Record<string, unknown>[] | undefined): string | null {
  if (!images || images.length === 0) return null;
  const first = images[0];
  return typeof first.url === 'string' ? first.url : null;
}

function mapArticle(raw: Record<string, unknown>): NewsArticle | null {
  const headline = String(raw.headline ?? raw.title ?? '').trim();
  if (!headline) return null;

  const links = raw.links as Record<string, unknown> | undefined;
  const web = links?.web as Record<string, unknown> | undefined;
  const link = typeof web?.href === 'string' ? web.href : (typeof raw.link === 'string' ? raw.link : null);

  return {
    id: String(raw.id ?? raw.guid ?? headline),
    headline,
    description: typeof raw.description === 'string' && raw.description.trim() ? raw.description.trim() : null,
    imageUrl: pickImage(raw.images as Record<string, unknown>[] | undefined),
    link,
    publishedAt: typeof raw.published === 'string' ? raw.published : (typeof raw.lastModified === 'string' ? raw.lastModified : null),
  };
}

export async function getLeagueNews(leagueId: number): Promise<LeagueNewsResponse | null> {
  const slug = LEAGUE_ESPN_MAP[leagueId];
  if (!slug) return null;

  const now = Date.now();
  const hit = cache.get(leagueId);
  if (hit && hit.expiresAt > now) return hit.data;

  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/news`;

  try {
    const { data } = await axios.get(url, { timeout: 10_000, headers: { 'User-Agent': 'GoalBet/1.0' } });
    const rawArticles = (data?.articles as Record<string, unknown>[] | undefined) ?? [];

    const articles = rawArticles
      .map(mapArticle)
      .filter((a): a is NewsArticle => a !== null)
      .slice(0, 8);

    if (articles.length === 0) return null;

    const response: LeagueNewsResponse = {
      leagueId,
      slug,
      cachedAt: new Date().toISOString(),
      articles,
    };

    cache.set(leagueId, { data: response, expiresAt: now + CACHE_TTL_MS });
    return response;
  } catch (err) {
    logger.debug(`[leagueNews] fetch failed for ${slug}: ${err}`);
    return null;
  }
}
