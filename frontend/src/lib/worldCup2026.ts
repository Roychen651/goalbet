// Static FIFA World Cup 2026 structure — drives the Stats Hub "Route to the
// Trophy" view. 48 teams · 12 groups of 4 · R32 · R16 · QF · SF · 3rd · Final
// (104 matches across 16 cities in USA/Canada/Mexico). Reflects the final
// draw (2025-12-05) + the six intercontinental playoff winners resolved
// 2026-03-31. Only Iraq's slot retains a placeholder because FIFA lists it
// as "IC Path 2 Winner" in some schedules; teams listed here match the
// published groups.

import type { TranslationKey } from './i18n';

export interface WCTeam {
  code: string;
  name: string;
  flag: string;
  host?: boolean;
}

export interface WCGroup {
  id: string;
  teams: WCTeam[];
}

export type WCMatchday = 1 | 2 | 3;

export interface WCGroupMatch {
  id: string;           // "M-1" … "M-72"
  number: number;       // 1 … 72
  group: string;        // 'A' … 'L'
  matchday: WCMatchday; // 1 | 2 | 3
  home: WCTeam;
  away: WCTeam;
  date: string;         // ISO yyyy-mm-dd
  venueId: string;      // -> WC2026_STADIUMS[].id
}

export interface WCKnockoutMatch {
  id: string;
  label: string;        // "73" style numbering per FIFA schedule
  home: string;
  away: string;
  date: string;         // ISO yyyy-mm-dd
  venueId?: string;
}

export interface WCStadium {
  id: string;
  name: string;
  city: string;
  countryCode: 'USA' | 'CAN' | 'MEX';
  countryFlag: string;
  capacity: number;
  role?: 'opening' | 'final' | 'semifinal' | 'third' | 'quarterfinal';
}

export interface WCPhase {
  id: string;
  labelKey: TranslationKey;
  startDate: string;
  endDate: string;
  matches: number;
}

/* ═══════════════════════ TEAMS ═══════════════════════ */

const T = {
  MEX: { code: 'MEX', name: 'Mexico',             flag: '🇲🇽', host: true },
  RSA: { code: 'RSA', name: 'South Africa',       flag: '🇿🇦' },
  KOR: { code: 'KOR', name: 'South Korea',        flag: '🇰🇷' },
  CZE: { code: 'CZE', name: 'Czech Republic',     flag: '🇨🇿' },

  CAN: { code: 'CAN', name: 'Canada',             flag: '🇨🇦', host: true },
  BIH: { code: 'BIH', name: 'Bosnia & Herzegovina', flag: '🇧🇦' },
  QAT: { code: 'QAT', name: 'Qatar',              flag: '🇶🇦' },
  SUI: { code: 'SUI', name: 'Switzerland',        flag: '🇨🇭' },

  BRA: { code: 'BRA', name: 'Brazil',             flag: '🇧🇷' },
  MAR: { code: 'MAR', name: 'Morocco',            flag: '🇲🇦' },
  HAI: { code: 'HAI', name: 'Haiti',              flag: '🇭🇹' },
  SCO: { code: 'SCO', name: 'Scotland',           flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },

  USA: { code: 'USA', name: 'United States',      flag: '🇺🇸', host: true },
  PAR: { code: 'PAR', name: 'Paraguay',           flag: '🇵🇾' },
  AUS: { code: 'AUS', name: 'Australia',          flag: '🇦🇺' },
  TUR: { code: 'TUR', name: 'Türkiye',            flag: '🇹🇷' },

  GER: { code: 'GER', name: 'Germany',            flag: '🇩🇪' },
  CUW: { code: 'CUW', name: 'Curaçao',            flag: '🇨🇼' },
  CIV: { code: 'CIV', name: 'Ivory Coast',        flag: '🇨🇮' },
  ECU: { code: 'ECU', name: 'Ecuador',            flag: '🇪🇨' },

  NED: { code: 'NED', name: 'Netherlands',        flag: '🇳🇱' },
  JPN: { code: 'JPN', name: 'Japan',              flag: '🇯🇵' },
  SWE: { code: 'SWE', name: 'Sweden',             flag: '🇸🇪' },
  TUN: { code: 'TUN', name: 'Tunisia',            flag: '🇹🇳' },

  ESP: { code: 'ESP', name: 'Spain',              flag: '🇪🇸' },
  CPV: { code: 'CPV', name: 'Cape Verde',         flag: '🇨🇻' },
  KSA: { code: 'KSA', name: 'Saudi Arabia',       flag: '🇸🇦' },
  URU: { code: 'URU', name: 'Uruguay',            flag: '🇺🇾' },

  BEL: { code: 'BEL', name: 'Belgium',            flag: '🇧🇪' },
  EGY: { code: 'EGY', name: 'Egypt',              flag: '🇪🇬' },
  IRN: { code: 'IRN', name: 'Iran',               flag: '🇮🇷' },
  NZL: { code: 'NZL', name: 'New Zealand',        flag: '🇳🇿' },

  FRA: { code: 'FRA', name: 'France',             flag: '🇫🇷' },
  SEN: { code: 'SEN', name: 'Senegal',            flag: '🇸🇳' },
  IRQ: { code: 'IRQ', name: 'Iraq',               flag: '🇮🇶' },
  NOR: { code: 'NOR', name: 'Norway',             flag: '🇳🇴' },

  ARG: { code: 'ARG', name: 'Argentina',          flag: '🇦🇷' },
  ALG: { code: 'ALG', name: 'Algeria',            flag: '🇩🇿' },
  AUT: { code: 'AUT', name: 'Austria',            flag: '🇦🇹' },
  JOR: { code: 'JOR', name: 'Jordan',             flag: '🇯🇴' },

  ENG: { code: 'ENG', name: 'England',            flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  CRO: { code: 'CRO', name: 'Croatia',            flag: '🇭🇷' },
  GHA: { code: 'GHA', name: 'Ghana',              flag: '🇬🇭' },
  PAN: { code: 'PAN', name: 'Panama',             flag: '🇵🇦' },

  POR: { code: 'POR', name: 'Portugal',           flag: '🇵🇹' },
  COD: { code: 'COD', name: 'DR Congo',           flag: '🇨🇩' },
  UZB: { code: 'UZB', name: 'Uzbekistan',         flag: '🇺🇿' },
  COL: { code: 'COL', name: 'Colombia',           flag: '🇨🇴' },
} as const satisfies Record<string, WCTeam>;

/* ═══════════════════════ META ═══════════════════════ */

export const WC2026_INFO = {
  name: 'FIFA World Cup 2026',
  startDate: '2026-06-11',
  endDate: '2026-07-19',
  totalTeams: 48,
  totalMatches: 104,
  hostCities: 16,
  totalDays: 39,
  hosts: [
    { code: 'USA', flag: '🇺🇸', name: 'United States' },
    { code: 'CAN', flag: '🇨🇦', name: 'Canada' },
    { code: 'MEX', flag: '🇲🇽', name: 'Mexico' },
  ],
  opening: {
    date: '2026-06-11',
    venue: 'Estadio Banorte',
    city: 'Mexico City',
    stadiumId: 'azteca',
  },
  final: {
    date: '2026-07-19',
    venue: 'MetLife Stadium',
    city: 'New York / New Jersey',
    stadiumId: 'metlife',
  },
} as const;

/* ═══════════════════════ GROUPS ═══════════════════════ */

export const WC2026_GROUPS: WCGroup[] = [
  { id: 'A', teams: [T.MEX, T.RSA, T.KOR, T.CZE] },
  { id: 'B', teams: [T.CAN, T.BIH, T.QAT, T.SUI] },
  { id: 'C', teams: [T.BRA, T.MAR, T.HAI, T.SCO] },
  { id: 'D', teams: [T.USA, T.PAR, T.AUS, T.TUR] },
  { id: 'E', teams: [T.GER, T.CUW, T.CIV, T.ECU] },
  { id: 'F', teams: [T.NED, T.JPN, T.SWE, T.TUN] },
  { id: 'G', teams: [T.ESP, T.CPV, T.KSA, T.URU] },
  { id: 'H', teams: [T.BEL, T.EGY, T.IRN, T.NZL] },
  { id: 'I', teams: [T.FRA, T.SEN, T.IRQ, T.NOR] },
  { id: 'J', teams: [T.ARG, T.ALG, T.AUT, T.JOR] },
  { id: 'K', teams: [T.ENG, T.CRO, T.GHA, T.PAN] },
  { id: 'L', teams: [T.POR, T.COD, T.UZB, T.COL] },
];

/* ═══════════════════════ GROUP FIXTURES (1-72) ═══════════════════════ */

const gm = (
  number: number, group: string, matchday: WCMatchday,
  home: WCTeam, away: WCTeam, date: string, venueId: string,
): WCGroupMatch => ({ id: `M-${number}`, number, group, matchday, home, away, date, venueId });

export const WC2026_GROUP_MATCHES: WCGroupMatch[] = [
  // ── Matchday 1 ── 2026-06-11 → 2026-06-17 ──
  gm(1,  'A', 1, T.MEX, T.RSA, '2026-06-11', 'azteca'),
  gm(2,  'A', 1, T.KOR, T.CZE, '2026-06-11', 'akron'),
  gm(3,  'B', 1, T.CAN, T.BIH, '2026-06-12', 'bmo'),
  gm(4,  'D', 1, T.USA, T.PAR, '2026-06-12', 'sofi'),
  gm(5,  'C', 1, T.HAI, T.SCO, '2026-06-13', 'gillette'),
  gm(6,  'D', 1, T.AUS, T.TUR, '2026-06-13', 'bcplace'),
  gm(7,  'C', 1, T.BRA, T.MAR, '2026-06-13', 'metlife'),
  gm(8,  'B', 1, T.QAT, T.SUI, '2026-06-13', 'levis'),
  gm(9,  'E', 1, T.CIV, T.ECU, '2026-06-14', 'lincoln'),
  gm(10, 'E', 1, T.GER, T.CUW, '2026-06-14', 'nrg'),
  gm(11, 'F', 1, T.NED, T.JPN, '2026-06-14', 'attadium'),
  gm(12, 'F', 1, T.SWE, T.TUN, '2026-06-14', 'bbva'),
  gm(13, 'G', 1, T.KSA, T.URU, '2026-06-15', 'hardrock'),
  gm(14, 'G', 1, T.ESP, T.CPV, '2026-06-15', 'mercedes'),
  gm(15, 'H', 1, T.IRN, T.NZL, '2026-06-15', 'sofi'),
  gm(16, 'H', 1, T.BEL, T.EGY, '2026-06-15', 'lumen'),
  gm(17, 'I', 1, T.FRA, T.SEN, '2026-06-16', 'metlife'),
  gm(18, 'I', 1, T.IRQ, T.NOR, '2026-06-16', 'gillette'),
  gm(19, 'J', 1, T.ARG, T.ALG, '2026-06-16', 'arrowhead'),
  gm(20, 'J', 1, T.AUT, T.JOR, '2026-06-16', 'levis'),
  gm(21, 'K', 1, T.GHA, T.PAN, '2026-06-17', 'bmo'),
  gm(22, 'K', 1, T.ENG, T.CRO, '2026-06-17', 'attadium'),
  gm(23, 'L', 1, T.POR, T.COD, '2026-06-17', 'nrg'),
  gm(24, 'L', 1, T.UZB, T.COL, '2026-06-17', 'azteca'),

  // ── Matchday 2 ── 2026-06-18 → 2026-06-23 ──
  gm(25, 'A', 2, T.CZE, T.RSA, '2026-06-18', 'mercedes'),
  gm(26, 'B', 2, T.SUI, T.BIH, '2026-06-18', 'sofi'),
  gm(27, 'B', 2, T.CAN, T.QAT, '2026-06-18', 'bcplace'),
  gm(28, 'A', 2, T.MEX, T.KOR, '2026-06-18', 'akron'),
  gm(29, 'C', 2, T.BRA, T.HAI, '2026-06-19', 'lincoln'),
  gm(30, 'C', 2, T.SCO, T.MAR, '2026-06-19', 'gillette'),
  gm(31, 'D', 2, T.TUR, T.PAR, '2026-06-19', 'levis'),
  gm(32, 'D', 2, T.USA, T.AUS, '2026-06-19', 'lumen'),
  gm(33, 'E', 2, T.GER, T.CIV, '2026-06-20', 'bmo'),
  gm(34, 'E', 2, T.ECU, T.CUW, '2026-06-20', 'arrowhead'),
  gm(35, 'F', 2, T.NED, T.SWE, '2026-06-20', 'nrg'),
  gm(36, 'F', 2, T.TUN, T.JPN, '2026-06-20', 'bbva'),
  gm(37, 'G', 2, T.URU, T.CPV, '2026-06-21', 'hardrock'),
  gm(38, 'G', 2, T.ESP, T.KSA, '2026-06-21', 'mercedes'),
  gm(39, 'H', 2, T.BEL, T.IRN, '2026-06-21', 'sofi'),
  gm(40, 'H', 2, T.NZL, T.EGY, '2026-06-21', 'bcplace'),
  gm(41, 'I', 2, T.NOR, T.SEN, '2026-06-22', 'metlife'),
  gm(42, 'I', 2, T.FRA, T.IRQ, '2026-06-22', 'lincoln'),
  gm(43, 'J', 2, T.ARG, T.AUT, '2026-06-22', 'attadium'),
  gm(44, 'J', 2, T.JOR, T.ALG, '2026-06-22', 'levis'),
  gm(45, 'K', 2, T.ENG, T.GHA, '2026-06-23', 'gillette'),
  gm(46, 'K', 2, T.PAN, T.CRO, '2026-06-23', 'bmo'),
  gm(47, 'L', 2, T.POR, T.UZB, '2026-06-23', 'nrg'),
  gm(48, 'L', 2, T.COL, T.COD, '2026-06-23', 'akron'),

  // ── Matchday 3 ── 2026-06-24 → 2026-06-27 ──
  gm(49, 'C', 3, T.SCO, T.BRA, '2026-06-24', 'hardrock'),
  gm(50, 'C', 3, T.MAR, T.HAI, '2026-06-24', 'mercedes'),
  gm(51, 'B', 3, T.SUI, T.CAN, '2026-06-24', 'bcplace'),
  gm(52, 'B', 3, T.BIH, T.QAT, '2026-06-24', 'lumen'),
  gm(53, 'A', 3, T.CZE, T.MEX, '2026-06-24', 'azteca'),
  gm(54, 'A', 3, T.RSA, T.KOR, '2026-06-24', 'bbva'),
  gm(55, 'E', 3, T.CUW, T.CIV, '2026-06-25', 'lincoln'),
  gm(56, 'E', 3, T.ECU, T.GER, '2026-06-25', 'metlife'),
  gm(57, 'F', 3, T.JPN, T.SWE, '2026-06-25', 'attadium'),
  gm(58, 'F', 3, T.TUN, T.NED, '2026-06-25', 'arrowhead'),
  gm(59, 'D', 3, T.TUR, T.USA, '2026-06-25', 'sofi'),
  gm(60, 'D', 3, T.PAR, T.AUS, '2026-06-25', 'levis'),
  gm(61, 'I', 3, T.NOR, T.FRA, '2026-06-26', 'gillette'),
  gm(62, 'I', 3, T.SEN, T.IRQ, '2026-06-26', 'bmo'),
  gm(63, 'H', 3, T.EGY, T.IRN, '2026-06-26', 'lumen'),
  gm(64, 'H', 3, T.NZL, T.BEL, '2026-06-26', 'bcplace'),
  gm(65, 'G', 3, T.CPV, T.KSA, '2026-06-26', 'nrg'),
  gm(66, 'G', 3, T.URU, T.ESP, '2026-06-26', 'akron'),
  gm(67, 'K', 3, T.PAN, T.ENG, '2026-06-27', 'metlife'),
  gm(68, 'K', 3, T.CRO, T.GHA, '2026-06-27', 'lincoln'),
  gm(69, 'J', 3, T.ALG, T.AUT, '2026-06-27', 'arrowhead'),
  gm(70, 'J', 3, T.JOR, T.ARG, '2026-06-27', 'attadium'),
  gm(71, 'L', 3, T.COL, T.POR, '2026-06-27', 'hardrock'),
  gm(72, 'L', 3, T.COD, T.UZB, '2026-06-27', 'mercedes'),
];

/* ═══════════════════════ KNOCKOUTS ═══════════════════════ */
//
// Slot labels follow FIFA's published bracket template: "1A" = Group A winner,
// "2B" = Group B runner-up, "3[…]" = one of the 8 best third-placed teams
// from the listed groups, "W 73" = winner of match 73. These resolve once
// group standings are known; until then the cards surface the schedule
// (date + venue) and the qualifier slot.

export const WC2026_R32: WCKnockoutMatch[] = [
  { id: 'R32-1',  label: '73', home: '1A', away: '2B',           date: '2026-06-28', venueId: 'sofi' },
  { id: 'R32-2',  label: '74', home: '1C', away: '3[D/E/F/J]',    date: '2026-06-29', venueId: 'gillette' },
  { id: 'R32-3',  label: '75', home: '1F', away: '2I',            date: '2026-06-29', venueId: 'bbva' },
  { id: 'R32-4',  label: '76', home: '1E', away: '3[A/B/F/I]',    date: '2026-06-29', venueId: 'nrg' },
  { id: 'R32-5',  label: '77', home: '1B', away: '3[A/C/D/G]',    date: '2026-06-30', venueId: 'metlife' },
  { id: 'R32-6',  label: '78', home: '1D', away: '2F',            date: '2026-06-30', venueId: 'attadium' },
  { id: 'R32-7',  label: '79', home: '1G', away: '2E',            date: '2026-06-30', venueId: 'azteca' },
  { id: 'R32-8',  label: '80', home: '1H', away: '3[C/E/H/L]',    date: '2026-07-01', venueId: 'mercedes' },
  { id: 'R32-9',  label: '81', home: '1I', away: '2L',            date: '2026-07-01', venueId: 'levis' },
  { id: 'R32-10', label: '82', home: '1K', away: '2J',            date: '2026-07-01', venueId: 'lumen' },
  { id: 'R32-11', label: '83', home: '1L', away: '3[B/E/F/K]',    date: '2026-07-02', venueId: 'bmo' },
  { id: 'R32-12', label: '84', home: '1J', away: '2K',            date: '2026-07-02', venueId: 'sofi' },
  { id: 'R32-13', label: '85', home: '2A', away: '2D',            date: '2026-07-02', venueId: 'bcplace' },
  { id: 'R32-14', label: '86', home: '2C', away: '2H',            date: '2026-07-03', venueId: 'hardrock' },
  { id: 'R32-15', label: '87', home: '2G', away: '3[B/E/H/L]',    date: '2026-07-03', venueId: 'arrowhead' },
  { id: 'R32-16', label: '88', home: '1G', away: '3[A/B/I/J]',    date: '2026-07-03', venueId: 'attadium' },
];

export const WC2026_R16: WCKnockoutMatch[] = [
  { id: 'R16-1', label: '89', home: 'W 73', away: 'W 74', date: '2026-07-04', venueId: 'lincoln' },
  { id: 'R16-2', label: '90', home: 'W 75', away: 'W 76', date: '2026-07-04', venueId: 'nrg' },
  { id: 'R16-3', label: '91', home: 'W 77', away: 'W 78', date: '2026-07-05', venueId: 'metlife' },
  { id: 'R16-4', label: '92', home: 'W 79', away: 'W 80', date: '2026-07-05', venueId: 'azteca' },
  { id: 'R16-5', label: '93', home: 'W 81', away: 'W 82', date: '2026-07-06', venueId: 'attadium' },
  { id: 'R16-6', label: '94', home: 'W 83', away: 'W 84', date: '2026-07-06', venueId: 'lumen' },
  { id: 'R16-7', label: '95', home: 'W 85', away: 'W 86', date: '2026-07-07', venueId: 'mercedes' },
  { id: 'R16-8', label: '96', home: 'W 87', away: 'W 88', date: '2026-07-07', venueId: 'bcplace' },
];

export const WC2026_QF: WCKnockoutMatch[] = [
  { id: 'QF-1', label: '97',  home: 'W 89', away: 'W 90', date: '2026-07-09', venueId: 'gillette' },
  { id: 'QF-2', label: '98',  home: 'W 91', away: 'W 92', date: '2026-07-10', venueId: 'sofi' },
  { id: 'QF-3', label: '99',  home: 'W 93', away: 'W 94', date: '2026-07-11', venueId: 'hardrock' },
  { id: 'QF-4', label: '100', home: 'W 95', away: 'W 96', date: '2026-07-11', venueId: 'arrowhead' },
];

export const WC2026_SF: WCKnockoutMatch[] = [
  { id: 'SF-1', label: '101', home: 'W 97', away: 'W 98',  date: '2026-07-14', venueId: 'attadium' },
  { id: 'SF-2', label: '102', home: 'W 99', away: 'W 100', date: '2026-07-15', venueId: 'mercedes' },
];

export const WC2026_THIRD: WCKnockoutMatch = {
  id: '3RD', label: '103', home: 'L 101', away: 'L 102',
  date: '2026-07-18', venueId: 'hardrock',
};

export const WC2026_FINAL: WCKnockoutMatch = {
  id: 'FINAL', label: '104', home: 'W 101', away: 'W 102',
  date: '2026-07-19', venueId: 'metlife',
};

/* ═══════════════════════ PHASES ═══════════════════════ */

export const WC2026_PHASES: WCPhase[] = [
  { id: 'group',  labelKey: 'wcGroupStage',    startDate: '2026-06-11', endDate: '2026-06-27', matches: 72 },
  { id: 'r32',    labelKey: 'wcR32',            startDate: '2026-06-28', endDate: '2026-07-03', matches: 16 },
  { id: 'r16',    labelKey: 'wcR16',            startDate: '2026-07-04', endDate: '2026-07-07', matches: 8  },
  { id: 'qf',     labelKey: 'wcQF',             startDate: '2026-07-09', endDate: '2026-07-11', matches: 4  },
  { id: 'sf',     labelKey: 'wcSF',             startDate: '2026-07-14', endDate: '2026-07-15', matches: 2  },
  { id: 'third',  labelKey: 'wcThirdPlace',     startDate: '2026-07-18', endDate: '2026-07-18', matches: 1  },
  { id: 'final',  labelKey: 'wcFinal',          startDate: '2026-07-19', endDate: '2026-07-19', matches: 1  },
];

/* ═══════════════════════ STADIUMS ═══════════════════════ */

export const WC2026_STADIUMS: WCStadium[] = [
  { id: 'metlife',   name: 'MetLife Stadium',        city: 'New York / NJ',       countryCode: 'USA', countryFlag: '🇺🇸', capacity: 82500, role: 'final' },
  { id: 'azteca',    name: 'Estadio Banorte',        city: 'Mexico City',         countryCode: 'MEX', countryFlag: '🇲🇽', capacity: 87523, role: 'opening' },
  { id: 'attadium',  name: 'AT&T Stadium',           city: 'Dallas',              countryCode: 'USA', countryFlag: '🇺🇸', capacity: 80000, role: 'semifinal' },
  { id: 'mercedes',  name: 'Mercedes-Benz Stadium',  city: 'Atlanta',             countryCode: 'USA', countryFlag: '🇺🇸', capacity: 71000, role: 'semifinal' },
  { id: 'hardrock',  name: 'Hard Rock Stadium',      city: 'Miami',               countryCode: 'USA', countryFlag: '🇺🇸', capacity: 65326, role: 'third' },
  { id: 'arrowhead', name: 'Arrowhead Stadium',      city: 'Kansas City',         countryCode: 'USA', countryFlag: '🇺🇸', capacity: 76416, role: 'quarterfinal' },
  { id: 'sofi',      name: 'SoFi Stadium',           city: 'Los Angeles',         countryCode: 'USA', countryFlag: '🇺🇸', capacity: 70240, role: 'quarterfinal' },
  { id: 'gillette',  name: 'Gillette Stadium',       city: 'Boston',              countryCode: 'USA', countryFlag: '🇺🇸', capacity: 65878, role: 'quarterfinal' },
  { id: 'nrg',       name: 'NRG Stadium',            city: 'Houston',             countryCode: 'USA', countryFlag: '🇺🇸', capacity: 72220 },
  { id: 'lincoln',   name: 'Lincoln Financial Field', city: 'Philadelphia',        countryCode: 'USA', countryFlag: '🇺🇸', capacity: 69596 },
  { id: 'levis',     name: "Levi's Stadium",         city: 'San Francisco Bay',   countryCode: 'USA', countryFlag: '🇺🇸', capacity: 68500 },
  { id: 'lumen',     name: 'Lumen Field',            city: 'Seattle',             countryCode: 'USA', countryFlag: '🇺🇸', capacity: 68740 },
  { id: 'bmo',       name: 'BMO Field',              city: 'Toronto',             countryCode: 'CAN', countryFlag: '🇨🇦', capacity: 45500 },
  { id: 'bcplace',   name: 'BC Place',               city: 'Vancouver',           countryCode: 'CAN', countryFlag: '🇨🇦', capacity: 54500 },
  { id: 'akron',     name: 'Estadio Akron',          city: 'Guadalajara',         countryCode: 'MEX', countryFlag: '🇲🇽', capacity: 46232 },
  { id: 'bbva',      name: 'Estadio BBVA',           city: 'Monterrey',           countryCode: 'MEX', countryFlag: '🇲🇽', capacity: 53500 },
];

export const WC2026_STADIUM_BY_ID: Record<string, WCStadium> = Object.fromEntries(
  WC2026_STADIUMS.map(s => [s.id, s]),
);
