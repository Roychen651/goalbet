// GoalBet Points Engine — pure functions, zero side effects
//
// Scoring per match (max 19 pts + streak bonus):
//   Tier 1 — Full-time outcome (H/D/A):       3 pts
//   Tier 2 — Exact score:                     7 pts  (stacks with tier1 → 10 pts total)
//   Tier 3 — Half-time result:                4 pts
//   Tier 5 — Both Teams to Score:             2 pts
//   Tier 6 — Over/Under 2.5 goals:            3 pts
//   Streak  — 3+ correct in a row:           +2 pts bonus

export interface MatchResult {
  home_score: number;
  away_score: number;
  halftime_home: number | null;
  halftime_away: number | null;
}

export interface PredictionInput {
  predicted_outcome: 'H' | 'D' | 'A' | null;
  predicted_home_score: number | null;
  predicted_away_score: number | null;
  predicted_halftime_outcome: 'H' | 'D' | 'A' | null;
  predicted_halftime_home: number | null;
  predicted_halftime_away: number | null;
  predicted_btts: boolean | null;
  predicted_over_under: 'over' | 'under' | null;
}

export interface PointsBreakdown {
  tier1_outcome: number;      // 0 or 3
  tier2_exact_score: number;  // 0 or 7
  tier3_halftime: number;     // 0 or 4
  tier5_btts: number;         // 0 or 2
  tier6_over_under: number;   // 0 or 3
  total: number;              // max 19 before streak bonus
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
    tier3_halftime: 0,
    tier5_btts: 0,
    tier6_over_under: 0,
    total: 0,
    correct_prediction: false,
  };

  const actualOutcome = deriveOutcome(match.home_score, match.away_score);
  const totalGoals = match.home_score + match.away_score;
  const actualBTTS = match.home_score > 0 && match.away_score > 0;

  // ── Tier 1: Full-time outcome (3 pts) ────────────────────────────────────
  // Awarded when:
  //   a) user explicitly predicted outcome AND it's correct, OR
  //   b) user predicted exact score correctly AND did not predict a conflicting outcome
  //      (e.g. predicting 3-2 score with no outcome = implies Home win → 3+7 = 10 pts)
  //      (e.g. predicting 3-2 score with outcome=Away = explicit wrong call → 7 pts only)
  const outcomeCorrect =
    prediction.predicted_outcome !== null && prediction.predicted_outcome === actualOutcome;

  const exactScoreCorrect =
    prediction.predicted_home_score !== null &&
    prediction.predicted_away_score !== null &&
    prediction.predicted_home_score === match.home_score &&
    prediction.predicted_away_score === match.away_score;

  // Only credit implied outcome from score when user did NOT explicitly predict a different (wrong) outcome
  const impliedOutcomeFromScore =
    exactScoreCorrect &&
    (prediction.predicted_outcome === null || prediction.predicted_outcome === actualOutcome);

  if (outcomeCorrect || impliedOutcomeFromScore) {
    breakdown.tier1_outcome = 3;
    breakdown.correct_prediction = true;
  }

  // ── Tier 2: Exact score (+7 pts stacked on top of tier 1) ────────────────
  // Gives 7 EXTRA points when exact score is correct.
  // Combined with tier1, getting exact score right = 3 + 7 = 10 pts.
  if (exactScoreCorrect) {
    breakdown.tier2_exact_score = 7;
    breakdown.correct_prediction = true;
  }

  // ── Tier 3: Half-time result (4 pts) ─────────────────────────────────────
  if (
    prediction.predicted_halftime_outcome !== null &&
    match.halftime_home !== null &&
    match.halftime_away !== null
  ) {
    const actualHT = deriveOutcome(match.halftime_home, match.halftime_away);
    if (prediction.predicted_halftime_outcome === actualHT) {
      breakdown.tier3_halftime = 4;
      breakdown.correct_prediction = true;
    }
  }

  // ── Tier 5: Both Teams to Score (2 pts) ──────────────────────────────────
  if (prediction.predicted_btts !== null && prediction.predicted_btts === actualBTTS) {
    breakdown.tier5_btts = 2;
    breakdown.correct_prediction = true;
  }

  // ── Tier 6: Over/Under 2.5 goals (3 pts) ─────────────────────────────────
  if (prediction.predicted_over_under !== null) {
    const isOver = totalGoals > 2.5;
    if (
      (prediction.predicted_over_under === 'over' && isOver) ||
      (prediction.predicted_over_under === 'under' && !isOver)
    ) {
      breakdown.tier6_over_under = 3;
      breakdown.correct_prediction = true;
    }
  }

  breakdown.total =
    breakdown.tier1_outcome +
    breakdown.tier2_exact_score +
    breakdown.tier3_halftime +
    breakdown.tier5_btts +
    breakdown.tier6_over_under;

  return breakdown;
}

// Streak bonus: +2 pts when the result of this prediction would reach 3+ in a row.
// currentStreak is the streak BEFORE this prediction.
// When currentStreak >= 2, a correct prediction makes it 3+ → bonus applies.
export function applyStreakBonus(basePoints: number, currentStreak: number): number {
  if (currentStreak >= 2 && basePoints > 0) {
    return basePoints + 2;
  }
  return basePoints;
}
