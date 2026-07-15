// Football leagues from TheSportsDB (free tier)
// V4 Sprint 24 — `nameHe` is the single source of truth for Hebrew league
// names (extends this existing array rather than a parallel leagues.json
// dictionary, which would drift the same way COIN_COSTS/migration-040 or
// the OKLCH tokens already warn against elsewhere in this codebase). Names
// favor how Israeli football media/fans actually say them — transliterated
// proper nouns where that's the real usage (פרימייר ליג, לה ליגה), the
// quintessential slang short-forms for the two biggest tournaments (מונדיאל,
// יורו — not the literal "גביע העולם"/"אליפות אירופה"), and the standard
// broadcast terms elsewhere (ליגת האלופות, קופה דל ריי). Directional, not
// final — a native-speaker pass can refine any entry without touching the
// lookup mechanism.
export const FOOTBALL_LEAGUES = [
  // Top 5 European leagues
  { id: 4328, name: 'Premier League',    nameHe: 'פרימייר ליג',       country: 'England', badge: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', espnLogoId: 23 },
  { id: 4335, name: 'La Liga',           nameHe: 'לה ליגה',           country: 'Spain',   badge: '🇪🇸', espnLogoId: 15 },
  { id: 4331, name: 'Bundesliga',        nameHe: 'בונדסליגה',         country: 'Germany', badge: '🇩🇪', espnLogoId: 10 },
  { id: 4332, name: 'Serie A',           nameHe: 'הליגה האיטלקית',    country: 'Italy',   badge: '🇮🇹', espnLogoId: 12 },
  { id: 4334, name: 'Ligue 1',           nameHe: 'ליג 1',             country: 'France',  badge: '🇫🇷', espnLogoId: 9  },
  // European club competitions
  { id: 4346, name: 'Champions League',  nameHe: 'ליגת האלופות',      country: 'Europe',  badge: '⭐', espnLogoId: 2    },
  { id: 4399, name: 'Europa League',     nameHe: 'ליגת אירופה',       country: 'Europe',  badge: '🌍', espnLogoId: 2310  },
  { id: 4877, name: 'Conference League', nameHe: 'ליגת הקונפרנס',     country: 'Europe',  badge: '🔵', espnLogoId: 20296 },
  // Domestic cups
  { id: 9001, name: 'FA Cup',            nameHe: 'גביע ה-FA',         country: 'England', badge: '🏆', espnLogoId: 40 },
  { id: 9002, name: 'League Cup',        nameHe: 'גביע הליגה',        country: 'England', badge: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', espnLogoId: 41 },
  { id: 9003, name: 'Copa del Rey',      nameHe: 'קופה דל ריי',       country: 'Spain',   badge: '👑', espnLogoId: 80 },
  // International
  { id: 4480, name: 'World Cup',              nameHe: 'מונדיאל',              country: 'World',  badge: '🌎', espnLogoId: 4    },
  { id: 5000, name: 'World Cup Qualifiers',   nameHe: 'מוקדמות המונדיאל',     country: 'Europe', badge: '🏆', espnLogoId: null },
  { id: 4467, name: 'Euro Championship',      nameHe: 'יורו',                 country: 'Europe', badge: '🇪🇺', espnLogoId: null },
  { id: 4635, name: 'Nations League',         nameHe: 'ליגת האומות',          country: 'Europe', badge: '🏅', espnLogoId: 2395 },
  { id: 4396, name: 'International Friendlies', nameHe: 'משחקי ידידות',       country: 'World', badge: '🌐', espnLogoId: 53 },
] as const;

export type LeagueId = typeof FOOTBALL_LEAGUES[number]['id'];

/**
 * V4 Sprint 24 — resolves a league's display name by id, preferring
 * FOOTBALL_LEAGUES.nameHe over the raw `matches.league_name` DB column when
 * lang is 'he'. Looking up by the stable internal league_id (rather than
 * trying to translate whatever string ESPN happened to sync into
 * league_name) sidesteps the same normalization risk team names have —
 * league_id is a small, fixed, already-canonical key. Falls back to
 * `fallbackName` (the raw league_name) when the id isn't in our list or
 * lang is 'en', never blank.
 */
export function tLeagueName(leagueId: number | null | undefined, fallbackName: string, lang: 'en' | 'he'): string {
  if (lang !== 'he') return fallbackName;
  const league = FOOTBALL_LEAGUES.find(l => l.id === leagueId);
  return league?.nameHe ?? fallbackName;
}

// Points system
export const POINTS = {
  TIER1_OUTCOME: 3,
  TIER2_EXACT_SCORE: 7,
  TIER2_EXACT_BONUS: 3, // when exact score outcome matches too
  TIER3_CORNERS: 4,
  TIER5_BTTS: 2,
  TIER6_OVER_UNDER: 3,
} as const;

// Coin costs mirror the max points achievable per tier.
// Placing a prediction costs = sum of tiers you're betting on.
// Correct tiers return 2× points earned back as coins.
export const COIN_COSTS = {
  RESULT_ONLY: 3,      // just predicted_outcome (no score)
  SCORE: 10,           // predicted_home+away  = result(3) + exact(7)
  CORNERS: 4,
  BTTS: 2,
  OVER_UNDER: 3,
  JOIN_BONUS: 120,
  DAILY_BONUS: 30,
  MAX_PER_MATCH: 19,
} as const;

/** Calculate the coin cost for a given prediction input. */
export function calcPredictionCost(data: {
  predicted_outcome?: 'H' | 'D' | 'A' | null;
  predicted_home_score?: number | null;
  predicted_away_score?: number | null;
  predicted_corners?: string | null;
  predicted_btts?: boolean | null;
  predicted_over_under?: string | null;
}): number {
  let cost = 0;
  const hasScore = data.predicted_home_score != null && data.predicted_away_score != null;
  if (hasScore) cost += COIN_COSTS.SCORE;
  else if (data.predicted_outcome != null) cost += COIN_COSTS.RESULT_ONLY;
  if (data.predicted_corners != null) cost += COIN_COSTS.CORNERS;
  if (data.predicted_btts != null) cost += COIN_COSTS.BTTS;
  if (data.predicted_over_under != null) cost += COIN_COSTS.OVER_UNDER;
  return cost;
}

// Match status labels
export const MATCH_STATUS_LABEL: Record<string, string> = {
  NS: 'Upcoming',
  '1H': 'Live',
  HT: 'Half Time',
  '2H': 'Live',
  FT: 'Full Time',
  ET1: 'Extra Time',
  ET2: 'Extra Time',
  AET: 'After ET',
  PEN: 'Penalties',
  PST: 'Postponed',
  CANC: 'Cancelled',
};

export const LIVE_STATUSES = ['1H', 'HT', '2H', 'ET1', 'ET2', 'PEN'];
export const FINISHED_STATUSES = ['FT', 'PST', 'CANC'];

// Map our internal league IDs → ESPN league slugs (mirrors backend espn.ts)
export const LEAGUE_ESPN_SLUG: Record<number, string> = {
  4328: 'eng.1',            // Premier League
  4335: 'esp.1',            // La Liga
  4331: 'ger.1',            // Bundesliga
  4332: 'ita.1',            // Serie A
  4334: 'fra.1',            // Ligue 1
  4346: 'uefa.champions',   // Champions League
  4399: 'uefa.europa',      // Europa League
  4877: 'uefa.europa.conf', // Conference League
  9001: 'eng.fa',           // FA Cup
  9002: 'eng.league_cup',   // League Cup (Carabao)
  9003: 'esp.copa_del_rey', // Copa del Rey
  4396: 'fifa.friendly',    // International Friendlies
  4635: 'uefa.nations',     // UEFA Nations League
  5000: 'uefa.worldq',      // UEFA World Cup Qualifiers
  4480: 'fifa.world',       // FIFA World Cup 2026 — live now (still custom-view in Stats Hub)
};

// App routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  LEADERBOARD: '/leaderboard',
  LOCKER_ROOM: '/locker-room',
  STATS: '/stats',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  AUTH_CALLBACK: '/auth/callback',
  ADMIN: '/admin',
} as const;
