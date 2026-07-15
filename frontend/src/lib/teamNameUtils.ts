// V4 Sprint 24 — shared normalization primitive, extracted out of
// WorldCupBracket.tsx's local normTeam()/TEAM_ALIASES the moment a second
// consumer (the Hebrew team-name dictionary, dictionaries/teamsHe.ts) needed
// the exact same lowercase/de-accent/alpha-only folding. WorldCupBracket.tsx
// keeps its own national-team alias table (Turkiye->Turkey etc.) locally —
// only the normalization function itself moved, so a club-team alias table
// (Man City -> Manchester City) and the WC national-team table never collide.
export function normalizeTeamName(name: string, aliases: Record<string, string> = {}): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z]/g, '');
  return aliases[base] ?? base;
}
