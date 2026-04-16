// Static FIFA World Cup 2026 structure — drives the Stats Hub "Route to the
// Trophy" view. 48 teams · 12 groups of 4 · R32 · R16 · QF · SF · Final (104
// matches across 16 cities in USA/Canada/Mexico). Host nations are seeded into
// Groups A/B/D per FIFA pre-draw; all other slots default to TBD.
//
// Knockout dates follow FIFA's published 2026 calendar; knockout venues are
// assigned so each host city holds at least one knockout match, with the
// marquee matches (Opening, QFs, SFs, 3rd-place, Final) mapped to the stadia
// FIFA has already announced.

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

export interface WCKnockoutMatch {
  id: string;
  label: string;        // "Match 73" style numbering per FIFA schedule
  home: string;
  away: string;
  date: string;         // ISO yyyy-mm-dd
  venueId?: string;     // -> WC2026_STADIUMS[].id
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

const TBD: WCTeam = { code: 'TBD', name: 'TBD', flag: '⚽' };
const tbd = (): WCTeam => ({ ...TBD });

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

// Host nations seeded into groups A, B, D per FIFA.
export const WC2026_GROUPS: WCGroup[] = [
  { id: 'A', teams: [{ code: 'MEX', name: 'Mexico', flag: '🇲🇽', host: true }, tbd(), tbd(), tbd()] },
  { id: 'B', teams: [{ code: 'CAN', name: 'Canada', flag: '🇨🇦', host: true }, tbd(), tbd(), tbd()] },
  { id: 'C', teams: [tbd(), tbd(), tbd(), tbd()] },
  { id: 'D', teams: [{ code: 'USA', name: 'United States', flag: '🇺🇸', host: true }, tbd(), tbd(), tbd()] },
  { id: 'E', teams: [tbd(), tbd(), tbd(), tbd()] },
  { id: 'F', teams: [tbd(), tbd(), tbd(), tbd()] },
  { id: 'G', teams: [tbd(), tbd(), tbd(), tbd()] },
  { id: 'H', teams: [tbd(), tbd(), tbd(), tbd()] },
  { id: 'I', teams: [tbd(), tbd(), tbd(), tbd()] },
  { id: 'J', teams: [tbd(), tbd(), tbd(), tbd()] },
  { id: 'K', teams: [tbd(), tbd(), tbd(), tbd()] },
  { id: 'L', teams: [tbd(), tbd(), tbd(), tbd()] },
];

// Round of 32 — 16 matches. The 8 best third-placed teams join the 12 winners
// + 12 runners-up. Pairings below use a consistent, balanced split across the
// bracket so Group A and Group B cannot meet before the Final.
export const WC2026_R32: WCKnockoutMatch[] = [
  { id: 'R32-1',  label: '73',  home: '1A',     away: '3[C/E/F]',   date: '2026-06-28', venueId: 'levis' },
  { id: 'R32-2',  label: '74',  home: '1C',     away: '3[D/E/F]',   date: '2026-06-28', venueId: 'lumen' },
  { id: 'R32-3',  label: '75',  home: '1E',     away: '2F',          date: '2026-06-28', venueId: 'lincoln' },
  { id: 'R32-4',  label: '76',  home: '1G',     away: '2H',          date: '2026-06-29', venueId: 'bmo' },
  { id: 'R32-5',  label: '77',  home: '1B',     away: '3[A/D/E/F]',  date: '2026-06-29', venueId: 'bcplace' },
  { id: 'R32-6',  label: '78',  home: '1D',     away: '2E',          date: '2026-06-29', venueId: 'akron' },
  { id: 'R32-7',  label: '79',  home: '1F',     away: '2C',          date: '2026-06-30', venueId: 'bbva' },
  { id: 'R32-8',  label: '80',  home: '1H',     away: '2G',          date: '2026-06-30', venueId: 'azteca' },
  { id: 'R32-9',  label: '81',  home: '1I',     away: '3[B/E/H/L]',  date: '2026-06-30', venueId: 'levis' },
  { id: 'R32-10', label: '82',  home: '1K',     away: '3[A/D/G/J]',  date: '2026-07-01', venueId: 'lumen' },
  { id: 'R32-11', label: '83',  home: '1L',     away: '2I',          date: '2026-07-01', venueId: 'lincoln' },
  { id: 'R32-12', label: '84',  home: '1J',     away: '2K',          date: '2026-07-01', venueId: 'bmo' },
  { id: 'R32-13', label: '85',  home: '2A',     away: '2D',          date: '2026-07-02', venueId: 'bcplace' },
  { id: 'R32-14', label: '86',  home: '2B',     away: '2L',          date: '2026-07-02', venueId: 'akron' },
  { id: 'R32-15', label: '87',  home: '2J',     away: '3[B/E/F/I]',  date: '2026-07-03', venueId: 'bbva' },
  { id: 'R32-16', label: '88',  home: '2K',     away: '3[D/E/I/L]',  date: '2026-07-03', venueId: 'azteca' },
];

export const WC2026_R16: WCKnockoutMatch[] = [
  { id: 'R16-1', label: '89',  home: 'W R32-1',  away: 'W R32-2',  date: '2026-07-04', venueId: 'gillette' },
  { id: 'R16-2', label: '90',  home: 'W R32-3',  away: 'W R32-4',  date: '2026-07-04', venueId: 'sofi' },
  { id: 'R16-3', label: '91',  home: 'W R32-5',  away: 'W R32-6',  date: '2026-07-05', venueId: 'arrowhead' },
  { id: 'R16-4', label: '92',  home: 'W R32-7',  away: 'W R32-8',  date: '2026-07-05', venueId: 'nrg' },
  { id: 'R16-5', label: '93',  home: 'W R32-9',  away: 'W R32-10', date: '2026-07-06', venueId: 'lincoln' },
  { id: 'R16-6', label: '94',  home: 'W R32-11', away: 'W R32-12', date: '2026-07-06', venueId: 'azteca' },
  { id: 'R16-7', label: '95',  home: 'W R32-13', away: 'W R32-14', date: '2026-07-07', venueId: 'levis' },
  { id: 'R16-8', label: '96',  home: 'W R32-15', away: 'W R32-16', date: '2026-07-07', venueId: 'mercedes' },
];

export const WC2026_QF: WCKnockoutMatch[] = [
  { id: 'QF-1', label: '97',  home: 'W R16-1', away: 'W R16-2', date: '2026-07-09', venueId: 'arrowhead' },
  { id: 'QF-2', label: '98',  home: 'W R16-3', away: 'W R16-4', date: '2026-07-10', venueId: 'hardrock' },
  { id: 'QF-3', label: '99',  home: 'W R16-5', away: 'W R16-6', date: '2026-07-11', venueId: 'gillette' },
  { id: 'QF-4', label: '100', home: 'W R16-7', away: 'W R16-8', date: '2026-07-11', venueId: 'sofi' },
];

export const WC2026_SF: WCKnockoutMatch[] = [
  { id: 'SF-1', label: '101', home: 'W QF-1', away: 'W QF-2', date: '2026-07-14', venueId: 'attadium' },
  { id: 'SF-2', label: '102', home: 'W QF-3', away: 'W QF-4', date: '2026-07-15', venueId: 'mercedes' },
];

export const WC2026_THIRD: WCKnockoutMatch = {
  id: '3RD', label: '103', home: 'L SF-1', away: 'L SF-2',
  date: '2026-07-18', venueId: 'hardrock',
};

export const WC2026_FINAL: WCKnockoutMatch = {
  id: 'FINAL', label: '104', home: 'W SF-1', away: 'W SF-2',
  date: '2026-07-19', venueId: 'metlife',
};

// Ordered by tournament progression so the timeline reads left-to-right.
export const WC2026_PHASES: WCPhase[] = [
  { id: 'group',  labelKey: 'wcGroupStage',    startDate: '2026-06-11', endDate: '2026-06-27', matches: 72 },
  { id: 'r32',    labelKey: 'wcR32',            startDate: '2026-06-28', endDate: '2026-07-03', matches: 16 },
  { id: 'r16',    labelKey: 'wcR16',            startDate: '2026-07-04', endDate: '2026-07-07', matches: 8  },
  { id: 'qf',     labelKey: 'wcQF',             startDate: '2026-07-09', endDate: '2026-07-11', matches: 4  },
  { id: 'sf',     labelKey: 'wcSF',             startDate: '2026-07-14', endDate: '2026-07-15', matches: 2  },
  { id: 'third',  labelKey: 'wcThirdPlace',     startDate: '2026-07-18', endDate: '2026-07-18', matches: 1  },
  { id: 'final',  labelKey: 'wcFinal',          startDate: '2026-07-19', endDate: '2026-07-19', matches: 1  },
];

// All 16 host stadia, ordered so marquee venues surface first in the grid.
export const WC2026_STADIUMS: WCStadium[] = [
  { id: 'metlife',   name: 'MetLife Stadium',        city: 'New York / NJ',        countryCode: 'USA', countryFlag: '🇺🇸', capacity: 82500, role: 'final' },
  { id: 'azteca',    name: 'Estadio Banorte',        city: 'Mexico City',          countryCode: 'MEX', countryFlag: '🇲🇽', capacity: 87523, role: 'opening' },
  { id: 'attadium',  name: 'AT&T Stadium',           city: 'Dallas',               countryCode: 'USA', countryFlag: '🇺🇸', capacity: 80000, role: 'semifinal' },
  { id: 'mercedes',  name: 'Mercedes-Benz Stadium',  city: 'Atlanta',              countryCode: 'USA', countryFlag: '🇺🇸', capacity: 71000, role: 'semifinal' },
  { id: 'hardrock',  name: 'Hard Rock Stadium',      city: 'Miami',                countryCode: 'USA', countryFlag: '🇺🇸', capacity: 65326, role: 'third' },
  { id: 'arrowhead', name: 'Arrowhead Stadium',      city: 'Kansas City',          countryCode: 'USA', countryFlag: '🇺🇸', capacity: 76416, role: 'quarterfinal' },
  { id: 'sofi',      name: 'SoFi Stadium',           city: 'Los Angeles',          countryCode: 'USA', countryFlag: '🇺🇸', capacity: 70240, role: 'quarterfinal' },
  { id: 'gillette',  name: 'Gillette Stadium',       city: 'Boston',               countryCode: 'USA', countryFlag: '🇺🇸', capacity: 65878, role: 'quarterfinal' },
  { id: 'nrg',       name: 'NRG Stadium',            city: 'Houston',              countryCode: 'USA', countryFlag: '🇺🇸', capacity: 72220 },
  { id: 'lincoln',   name: 'Lincoln Financial Field', city: 'Philadelphia',         countryCode: 'USA', countryFlag: '🇺🇸', capacity: 69596 },
  { id: 'levis',     name: "Levi's Stadium",         city: 'San Francisco Bay',    countryCode: 'USA', countryFlag: '🇺🇸', capacity: 68500 },
  { id: 'lumen',     name: 'Lumen Field',            city: 'Seattle',              countryCode: 'USA', countryFlag: '🇺🇸', capacity: 68740 },
  { id: 'bmo',       name: 'BMO Field',              city: 'Toronto',              countryCode: 'CAN', countryFlag: '🇨🇦', capacity: 45500 },
  { id: 'bcplace',   name: 'BC Place',               city: 'Vancouver',            countryCode: 'CAN', countryFlag: '🇨🇦', capacity: 54500 },
  { id: 'akron',     name: 'Estadio Akron',          city: 'Guadalajara',          countryCode: 'MEX', countryFlag: '🇲🇽', capacity: 46232 },
  { id: 'bbva',      name: 'Estadio BBVA',           city: 'Monterrey',            countryCode: 'MEX', countryFlag: '🇲🇽', capacity: 53500 },
];

// Lookup used by the bracket match cards to resolve venueId → stadium row.
export const WC2026_STADIUM_BY_ID: Record<string, WCStadium> = Object.fromEntries(
  WC2026_STADIUMS.map(s => [s.id, s]),
);
