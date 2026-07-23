// V7 Sprint 56 — "The Knockout Path": a display-only knockout-stage
// classifier for the Stats Hub's new dynamic bracket view.
//
// DELIBERATELY a separate function from pointsEngine.ts's
// `classifyKnockoutRound()` (V6 Sprint 48) — that function feeds the
// round-depth COIN/POINTS bonus and is narrowly scoped to exactly the 4
// stages that bonus pays out on (r16/qf/sf/final). Reusing or mutating it
// for a display feature would risk regressing a scoring-critical path for
// an unrelated UI concern. This classifier is broader on purpose: it also
// recognizes the new UEFA "Swiss model" play-off round (the extra
// pre-Round-of-16 knockout tie introduced when the competitions moved from
// a straight group stage to a single league phase) as its own stage, which
// the scoring classifier has no reason to know about (no separate bonus
// tier exists for it — it's folded into the base per-match points like any
// other match).
//
// Same "unverified field, honest degradation" discipline as every other
// best-effort ESPN-derived classifier in this codebase (yellowCards,
// referee name, athlete.headshot, classifyKnockoutRound itself): reads
// `matches.round`'s free-text headline defensively and returns null for
// anything unrecognized (league-phase/matchday rows, 3rd-place playoffs,
// or a genuinely unexpected string) — never throws, never guesses.
export type BracketStage = 'playoff' | 'r16' | 'qf' | 'sf' | 'final';

export const BRACKET_STAGE_ORDER: BracketStage[] = ['playoff', 'r16', 'qf', 'sf', 'final'];

export function classifyBracketStage(roundName: string | null | undefined): BracketStage | null {
  if (!roundName) return null;
  const s = roundName.toLowerCase();
  // Checked first, same as classifyKnockoutRound() — a 3rd-place playoff
  // contains the substring "playoff" too, so it must be excluded before
  // the broad playoff check below ever runs.
  if (s.includes('third') || s.includes('3rd')) return null;
  if (s.includes('semi')) return 'sf';
  if (s.includes('quarter')) return 'qf';
  if (s.includes('final')) return 'final'; // checked after semi/quarter — both substrings contain "final"
  if (s.includes('round of 16') || s.includes('last 16') || s.includes('r16') || s.includes('1/8')) return 'r16';
  // The new Swiss-model pre-R16 tie. ESPN's real headline text for this
  // stage has never been verified from this sandbox (no outbound ESPN
  // access here — the same standing limitation already noted for every
  // other best-effort field in this codebase), so this matches every
  // plausible spelling rather than one guessed literal.
  if (s.includes('play-off') || s.includes('playoff') || s.includes('play off')) return 'playoff';
  return null; // league phase / matchday / group stage / anything else — not a knockout stage
}

// i18n key per stage — both EN and HE variants live in lib/i18n.ts.
export const BRACKET_STAGE_LABEL_KEY: Record<BracketStage, string> = {
  playoff: 'bracketStagePlayoff',
  r16: 'bracketStageR16',
  qf: 'bracketStageQF',
  sf: 'bracketStageSF',
  final: 'bracketStageFinal',
};
