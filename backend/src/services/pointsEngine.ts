// GoalBet Points Engine — pure functions, zero side effects
//
// Scoring per match (max 19 pts):
//   Tier 1 — Full-time outcome (H/D/A):       3 pts
//   Tier 2 — Exact score:                     7 pts  (stacks with tier1 → 10 pts total)
//   Tier 3 — Corners (≤9 / 10 / ≥11):         4 pts
//   Tier 5 — Both Teams to Score:             2 pts
//   Tier 6 — Over/Under 2.5 goals:            3 pts

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
}

export interface PointsBreakdown {
  tier1_outcome: number;      // 0 or 3
  tier2_exact_score: number;  // 0 or 7
  tier3_corners: number;      // 0 or 4
  tier5_btts: number;         // 0 or 2
  tier6_over_under: number;   // 0 or 3
  total: number;              // max 19
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

  breakdown.total =
    breakdown.tier1_outcome +
    breakdown.tier2_exact_score +
    breakdown.tier3_corners +
    breakdown.tier5_btts +
    breakdown.tier6_over_under;

  return breakdown;
}
