// GoalBet Points Engine — pure functions, zero side effects
//
// Scoring per match (max 19 pts before any parlay bonus):
//   Tier 1 — Full-time outcome (H/D/A):       3 pts
//   Tier 2 — Exact score:                     7 pts  (stacks with tier1 → 10 pts total)
//   Tier 3 — Corners (≤9 / 10 / ≥11):         4 pts
//   Tier 5 — Both Teams to Score:             2 pts
//   Tier 6 — Over/Under 2.5 goals:            3 pts
//
// V5 Sprint 34 — "The Prediction Matrix" (same-match parlays). ADDITIVE
// ONLY: every tier above is still scored independently and unconditionally,
// exactly as it always has been, regardless of is_parlay. A parlay chains
// 2-3 of a prediction's OWN tiers (by the canonical keys 'result'/'score'/
// 'corners'/'btts'/'ou' — the same keys frontend/src/lib/utils.ts's
// calcBreakdown() already emits, reused rather than duplicated); if every
// linked tier is individually correct, a compounding bonus is added ON TOP
// of what those tiers already earn. It never reduces or zeroes out a tier's
// own score — see CLAUDE.md §49 for why (coins_bet is already spent
// per-tier independent of chaining; clawing back an individually-correct
// tier's points because a different linked tier missed would be punitive,
// not lucrative).

export type ParlayTierKey = 'result' | 'score' | 'corners' | 'btts' | 'ou';

export interface MatchResult {
  home_score: number;
  away_score: number;
  corners_total: number | null;
}

export interface PredictionInput {
  predicted_outcome: 'H' | 'D' | 'A' | null;
  predicted_home_score: number | null;
  predicted_away_score: number | null;
  predicted_corners: 'under9' | 'ten' | 'over11' | null;
  predicted_btts: boolean | null;
  predicted_over_under: 'over' | 'under' | null;
  is_parlay?: boolean | null;
  parlay_linked_tiers?: ParlayTierKey[] | null;
}

export interface PointsBreakdown {
  tier1_outcome: number;      // 0 or 3
  tier2_exact_score: number;  // 0 or 7
  tier3_corners: number;      // 0 or 4
  tier5_btts: number;         // 0 or 2
  tier6_over_under: number;   // 0 or 3
  parlay_bonus: number;       // 0 unless is_parlay and every linked tier hit
  total: number;              // base tiers + parlay_bonus
  correct_prediction: boolean;
}

export function deriveOutcome(homeScore: number, awayScore: number): 'H' | 'D' | 'A' {
  if (homeScore > awayScore) return 'H';
  if (homeScore < awayScore) return 'A';
  return 'D';
}

export function calculatePoints(prediction: PredictionInput, match: MatchResult): PointsBreakdown {
  const breakdown: PointsBreakdown = {
    tier1_outcome: 0,
    tier2_exact_score: 0,
    tier3_corners: 0,
    tier5_btts: 0,
    tier6_over_under: 0,
    parlay_bonus: 0,
    total: 0,
    correct_prediction: false,
  };

  const actualOutcome = deriveOutcome(match.home_score, match.away_score);
  const totalGoals = match.home_score + match.away_score;
  const actualBTTS = match.home_score > 0 && match.away_score > 0;

  // ── Tier 1: Full-time outcome (3 pts) ────────────────────────────────────
  const outcomeCorrect =
    prediction.predicted_outcome !== null && prediction.predicted_outcome === actualOutcome;

  const exactScoreCorrect =
    prediction.predicted_home_score !== null &&
    prediction.predicted_away_score !== null &&
    prediction.predicted_home_score === match.home_score &&
    prediction.predicted_away_score === match.away_score;

  const impliedOutcomeFromScore =
    exactScoreCorrect &&
    (prediction.predicted_outcome === null || prediction.predicted_outcome === actualOutcome);

  if (outcomeCorrect || impliedOutcomeFromScore) {
    breakdown.tier1_outcome = 3;
    breakdown.correct_prediction = true;
  }

  // ── Tier 2: Exact score (+7 pts stacked on top of tier 1) ────────────────
  if (exactScoreCorrect) {
    breakdown.tier2_exact_score = 7;
  }

  // ── Tier 3: Corners (≤9 / 10 / ≥11 = 4 pts) ─────────────────────────────
  if (prediction.predicted_corners !== null && match.corners_total !== null) {
    const actualBucket: 'under9' | 'ten' | 'over11' =
      match.corners_total <= 9 ? 'under9' :
      match.corners_total === 10 ? 'ten' : 'over11';
    if (prediction.predicted_corners === actualBucket) {
      breakdown.tier3_corners = 4;
    }
  }

  // ── Tier 5: Both Teams to Score (2 pts) ──────────────────────────────────
  if (prediction.predicted_btts !== null && prediction.predicted_btts === actualBTTS) {
    breakdown.tier5_btts = 2;
  }

  // ── Tier 6: Over/Under 2.5 goals (3 pts) ─────────────────────────────────
  if (prediction.predicted_over_under !== null) {
    const isOver = totalGoals > 2.5;
    if (
      (prediction.predicted_over_under === 'over' && isOver) ||
      (prediction.predicted_over_under === 'under' && !isOver)
    ) {
      breakdown.tier6_over_under = 3;
    }
  }

  // ── V5 Sprint 34: Parlay bonus (additive only — never a reduction) ───────
  // Every tier above has already been scored unconditionally by this point.
  // If is_parlay and every linked tier's own base score is nonzero (i.e.
  // individually correct), add a compounding bonus on top:
  //   linkedBaseSum = sum of the linked tiers' own base point values
  //   bonus         = ROUND(linkedBaseSum * 0.25 * (k - 1))     k = 2 or 3
  // "Sum of base weights of CORRECT tiers" collapses to "sum of ALL linked
  // tiers' base weights" here because the bonus only ever fires when every
  // linked tier is correct — that's the qualifying condition, not a
  // separate partial-credit case. A single incorrect linked tier means the
  // bonus is exactly 0; the tiers themselves keep whatever they already
  // earned above, completely unaffected.
  if (prediction.is_parlay && prediction.parlay_linked_tiers && prediction.parlay_linked_tiers.length >= 2) {
    const tierScore: Record<ParlayTierKey, number> = {
      result:  breakdown.tier1_outcome,
      score:   breakdown.tier2_exact_score,
      corners: breakdown.tier3_corners,
      btts:    breakdown.tier5_btts,
      ou:      breakdown.tier6_over_under,
    };

    const k = prediction.parlay_linked_tiers.length;
    const allLinkedCorrect = prediction.parlay_linked_tiers.every((key) => tierScore[key] > 0);

    if (allLinkedCorrect) {
      const linkedBaseSum = prediction.parlay_linked_tiers.reduce((sum, key) => sum + tierScore[key], 0);
      breakdown.parlay_bonus = Math.round(linkedBaseSum * 0.25 * (k - 1));
    }
  }

  breakdown.total =
    breakdown.tier1_outcome +
    breakdown.tier2_exact_score +
    breakdown.tier3_corners +
    breakdown.tier5_btts +
    breakdown.tier6_over_under +
    breakdown.parlay_bonus;

  return breakdown;
}
