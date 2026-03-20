// Football leagues from TheSportsDB (free tier)
export const FOOTBALL_LEAGUES = [
  // Top 5 European leagues
  { id: 4328, name: 'Premier League', country: 'England', badge: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', espnLogoId: 23 },
  { id: 4335, name: 'La Liga', country: 'Spain', badge: '🇪🇸', espnLogoId: 87 },
  { id: 4331, name: 'Bundesliga', country: 'Germany', badge: '🇩🇪', espnLogoId: 10 },
  { id: 4332, name: 'Serie A', country: 'Italy', badge: '🇮🇹', espnLogoId: 12 },
  { id: 4334, name: 'Ligue 1', country: 'France', badge: '🇫🇷', espnLogoId: 9 },
  // European club competitions
  { id: 4346, name: 'Champions League', country: 'Europe', badge: '⭐', espnLogoId: 2 },
  { id: 4399, name: 'Europa League', country: 'Europe', badge: '🌍', espnLogoId: 600 },
  { id: 4877, name: 'Conference League', country: 'Europe', badge: '🔵', espnLogoId: 2310 },
  // International
  { id: 4480, name: 'World Cup', country: 'World', badge: '🌎', espnLogoId: 4 },
  { id: 4467, name: 'Euro Championship', country: 'Europe', badge: '🇪🇺', espnLogoId: null },
  { id: 4635, name: 'Nations League', country: 'Europe', badge: '🏅', espnLogoId: null },
  // Other European leagues
  { id: 4354, name: 'Israeli Premier League', country: 'Israel', badge: '🇮🇱', espnLogoId: null },
  { id: 4337, name: 'Eredivisie', country: 'Netherlands', badge: '🇳🇱', espnLogoId: 11 },
  { id: 4338, name: 'Süper Lig', country: 'Turkey', badge: '🇹🇷', espnLogoId: 89 },
  { id: 4330, name: 'Scottish Premiership', country: 'Scotland', badge: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', espnLogoId: 41 },
  // Americas
  { id: 4344, name: 'MLS', country: 'USA', badge: '🇺🇸', espnLogoId: 19 },
  { id: 4351, name: 'Brazilian Série A', country: 'Brazil', badge: '🇧🇷', espnLogoId: 83 },
  { id: 4350, name: 'Argentine Primera', country: 'Argentina', badge: '🇦🇷', espnLogoId: 37 },
] as const;

export type LeagueId = typeof FOOTBALL_LEAGUES[number]['id'];

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
  4328: 'eng.1',
  4335: 'esp.1',
  4331: 'ger.1',
  4332: 'ita.1',
  4334: 'fra.1',
  4346: 'uefa.champions',
  4399: 'uefa.europa',
  4877: 'uefa.europa.conf',
  4337: 'ned.1',
  4338: 'tur.1',
  4330: 'sco.1',
  4344: 'usa.1',
  4351: 'bra.1',
  4350: 'arg.1',
};

// App routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  LEADERBOARD: '/leaderboard',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  AUTH_CALLBACK: '/auth/callback',
} as const;
