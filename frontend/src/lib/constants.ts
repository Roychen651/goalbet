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

// App routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  LEADERBOARD: '/leaderboard',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  AUTH_CALLBACK: '/auth/callback',
} as const;
