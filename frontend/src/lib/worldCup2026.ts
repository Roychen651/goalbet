// Static FIFA World Cup 2026 structure — used by the Stats Hub to render the
// "Route to the Trophy" bracket. Team slots default to TBD; we only mark the
// three host nations since those placements were confirmed by FIFA pre-draw
// (Mexico → A1 · Canada → B1 · USA → D1).
//
// Format: 48 teams · 12 groups of 4 · Round of 32 · R16 · QF · SF · Final.

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
  home: string;
  away: string;
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
  hosts: [
    { code: 'USA', flag: '🇺🇸', name: 'United States' },
    { code: 'CAN', flag: '🇨🇦', name: 'Canada' },
    { code: 'MEX', flag: '🇲🇽', name: 'Mexico' },
  ],
  opening: {
    date: '2026-06-11',
    venue: 'Estadio Azteca',
    city: 'Mexico City',
  },
  final: {
    date: '2026-07-19',
    venue: 'MetLife Stadium',
    city: 'New Jersey',
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
  { id: 'R32-1',  home: '1A',     away: '3[C/E/F]' },
  { id: 'R32-2',  home: '1C',     away: '3[D/E/F]' },
  { id: 'R32-3',  home: '1E',     away: '2F'        },
  { id: 'R32-4',  home: '1G',     away: '2H'        },
  { id: 'R32-5',  home: '1B',     away: '3[A/D/E/F]' },
  { id: 'R32-6',  home: '1D',     away: '2E'        },
  { id: 'R32-7',  home: '1F',     away: '2C'        },
  { id: 'R32-8',  home: '1H',     away: '2G'        },
  { id: 'R32-9',  home: '1I',     away: '3[B/E/H/L]' },
  { id: 'R32-10', home: '1K',     away: '3[A/D/G/J]' },
  { id: 'R32-11', home: '1L',     away: '2I'        },
  { id: 'R32-12', home: '1J',     away: '2K'        },
  { id: 'R32-13', home: '2A',     away: '2D'        },
  { id: 'R32-14', home: '2B',     away: '2L'        },
  { id: 'R32-15', home: '2J',     away: '3[B/E/F/I]' },
  { id: 'R32-16', home: '2K',     away: '3[D/E/I/L]' },
];

export const WC2026_R16: WCKnockoutMatch[] = [
  { id: 'R16-1', home: 'W R32-1',  away: 'W R32-2'  },
  { id: 'R16-2', home: 'W R32-3',  away: 'W R32-4'  },
  { id: 'R16-3', home: 'W R32-5',  away: 'W R32-6'  },
  { id: 'R16-4', home: 'W R32-7',  away: 'W R32-8'  },
  { id: 'R16-5', home: 'W R32-9',  away: 'W R32-10' },
  { id: 'R16-6', home: 'W R32-11', away: 'W R32-12' },
  { id: 'R16-7', home: 'W R32-13', away: 'W R32-14' },
  { id: 'R16-8', home: 'W R32-15', away: 'W R32-16' },
];

export const WC2026_QF: WCKnockoutMatch[] = [
  { id: 'QF-1', home: 'W R16-1', away: 'W R16-2' },
  { id: 'QF-2', home: 'W R16-3', away: 'W R16-4' },
  { id: 'QF-3', home: 'W R16-5', away: 'W R16-6' },
  { id: 'QF-4', home: 'W R16-7', away: 'W R16-8' },
];

export const WC2026_SF: WCKnockoutMatch[] = [
  { id: 'SF-1', home: 'W QF-1', away: 'W QF-2' },
  { id: 'SF-2', home: 'W QF-3', away: 'W QF-4' },
];

export const WC2026_THIRD: WCKnockoutMatch = {
  id: '3RD', home: 'L SF-1', away: 'L SF-2',
};

export const WC2026_FINAL: WCKnockoutMatch = {
  id: 'FINAL', home: 'W SF-1', away: 'W SF-2',
};
