// V7 Sprint 52 — "The Monte Carlo Web Worker Engine"
//
// Runs a 50,000-iteration bivariate-independent Poisson simulation of a
// match's exact score, entirely off the main thread. Every heavy
// computation (lambda derivation, sampling, grid tally) lives in this
// file and is exported as PLAIN, PURE functions — testable directly with
// a Node script (no postMessage/Worker plumbing needed to verify the
// math) — with a thin `self.onmessage` wrapper at the bottom being the
// only browser-Worker-specific code.
//
// DATA SOURCE — corrected against this codebase's real schema before any
// of this was written (see CLAUDE.md §66): there is no xG field anywhere
// in this app (ESPN's soccer feed has never exposed it here — same gap
// already documented for `data.predictor`, §34). The real, honest lambda
// input is each team's own recent scoring rate — `oracle_stats.home/away.
// avg_goals_scored/avg_goals_conceded` (migration 067, extending the
// existing Sprint 33 Analytics Oracle compute-once cache in place). This
// worker reads ONLY numbers that are already sitting on the match row —
// zero new network calls from this feature.
//
// MIN_SAMPLE_SIZE mirrors the exact floor already used throughout this
// codebase for Oracle-derived stats (ScoutReportPanel.tsx, H2HModal.tsx,
// PredictorArchetypeBadge.tsx) — a team with fewer than 3 resolved
// matches in its recent-form window doesn't get a fabricated-looking
// simulation; the hook (Commit 2) checks this before ever posting a
// SIMULATE request.
export const MIN_SAMPLE_SIZE = 3;

// A fixed, NAMED model constant — not derived from any per-match data.
// Real football home-advantage estimates commonly cluster in the
// 1.10–1.15x range for goals scored; 1.12 is a stated, documented
// assumption, the same honesty this codebase already applies to
// GroupDistributionChart's modeled Gaussian curve (§30) — never implied
// to be empirically fit from this app's own (comparatively tiny) dataset.
export const HOME_ADVANTAGE = 1.12;

// Referee-strictness dampening is capped tightly (±5%) because the
// real-world correlation between a referee's card average and a match's
// total goal output is weak and indirect at best — this is a minor,
// bounded nudge, never a primary driver of the model. `null` (referee
// unknown — the common case for an NS match; matches.referee_name is
// only ever populated at FT resolution, scoreUpdater.ts, no backfill)
// means "no adjustment," never a fabricated neutral referee.
export const REFEREE_DAMPENING_MIN = 0.95;
export const REFEREE_DAMPENING_MAX = 1.0;

// Scores are bucketed 0..4 per side plus a "5+" catch-all at index 5 —
// bounds the grid to a fixed 6x6=36 cells regardless of how a rare
// blowout sample lands, keeping the postMessage payload small and the
// UI (Commit 3, exactly 3 cells) trivially indexable.
export const GRID_SIZE = 6;
const GRID_CAP = GRID_SIZE - 1;

export const DEFAULT_ITERATIONS = 50_000;

export interface TeamGoalInput {
  homeAvgScored: number | null;
  homeAvgConceded: number | null;
  awayAvgScored: number | null;
  awayAvgConceded: number | null;
  /** 0.95–1.0, or null when the match's referee isn't known yet (the common NS case). */
  refereeDampening: number | null;
}

export interface Lambdas {
  lambdaHome: number;
  lambdaAway: number;
}

export interface ScoreProbability {
  home: number;
  away: number;
  pct: number;
}

export interface SimulationResult {
  grid: number[][];
  top3: ScoreProbability[];
  lambdaHome: number;
  lambdaAway: number;
  iterations: number;
}

/**
 * Derives both teams' expected-goals (lambda) from their own recent
 * scoring/conceding averages — the standard attack/defense blend used by
 * simplified Poisson football models: a team's expected goals in this
 * match are the average of (their own scoring rate) and (the opponent's
 * conceding rate). HOME_ADVANTAGE and refereeDampening are applied on
 * top as named, bounded, documented adjustments — never silently folded
 * in as if they were derived from data.
 */
export function deriveLambdas(input: TeamGoalInput): Lambdas {
  const {
    homeAvgScored,
    homeAvgConceded,
    awayAvgScored,
    awayAvgConceded,
    refereeDampening,
  } = input;

  if (
    homeAvgScored == null ||
    homeAvgConceded == null ||
    awayAvgScored == null ||
    awayAvgConceded == null
  ) {
    throw new Error('deriveLambdas: all four goal averages must be present — caller must gate on MIN_SAMPLE_SIZE first');
  }

  const dampening = refereeDampening ?? 1.0;
  const clampedDampening = Math.min(REFEREE_DAMPENING_MAX, Math.max(REFEREE_DAMPENING_MIN, dampening));

  const lambdaHomeRaw = (homeAvgScored + awayAvgConceded) / 2;
  const lambdaAwayRaw = (awayAvgScored + homeAvgConceded) / 2;

  // Floor at a small epsilon — a team with a genuine 0.00 recent scoring
  // average (real, if rare) must never produce a zero-mean Poisson, which
  // would degenerate the whole grid onto (0, awayGoals).
  const lambdaHome = Math.max(0.05, lambdaHomeRaw * HOME_ADVANTAGE * clampedDampening);
  const lambdaAway = Math.max(0.05, lambdaAwayRaw * clampedDampening);

  return { lambdaHome, lambdaAway };
}

/**
 * Knuth's algorithm — simple, exact, and cheap for the small lambda range
 * (typically 0.3–3.5) football goal counts live in. `rng` is injectable
 * purely so a deterministic test can assert convergence without relying
 * on Math.random(); production calls omit it.
 */
export function poissonSample(lambda: number, rng: () => number = Math.random): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

/**
 * Runs the full 50,000-iteration simulation and tallies the results into
 * a bounded 6x6 grid. Pure function — no I/O, no postMessage — callable
 * directly from a plain Node script for verification.
 */
export function simulateExactScores(
  lambdaHome: number,
  lambdaAway: number,
  iterations: number = DEFAULT_ITERATIONS,
  rng: () => number = Math.random
): { grid: number[][]; top3: ScoreProbability[] } {
  const grid: number[][] = Array.from({ length: GRID_SIZE }, () => new Array(GRID_SIZE).fill(0));

  for (let i = 0; i < iterations; i++) {
    const h = Math.min(poissonSample(lambdaHome, rng), GRID_CAP);
    const a = Math.min(poissonSample(lambdaAway, rng), GRID_CAP);
    grid[h][a]++;
  }

  const cells: ScoreProbability[] = [];
  for (let h = 0; h < GRID_SIZE; h++) {
    for (let a = 0; a < GRID_SIZE; a++) {
      if (grid[h][a] === 0) continue;
      cells.push({ home: h, away: a, pct: (grid[h][a] / iterations) * 100 });
    }
  }
  cells.sort((x, y) => y.pct - x.pct);

  return { grid, top3: cells.slice(0, 3) };
}

export function runSimulation(input: TeamGoalInput, iterations: number = DEFAULT_ITERATIONS): SimulationResult {
  const { lambdaHome, lambdaAway } = deriveLambdas(input);
  const { grid, top3 } = simulateExactScores(lambdaHome, lambdaAway, iterations);
  return { grid, top3, lambdaHome, lambdaAway, iterations };
}

// ─── Browser Worker wrapper — the only non-pure part of this file ───────
// Guarded so this module can still be imported (for its pure exports) by
// a Node verification script without `self` existing.
if (typeof self !== 'undefined' && typeof (self as any).onmessage !== 'undefined') {
  self.onmessage = (e: MessageEvent) => {
    const { requestId, input, iterations } = e.data as {
      requestId: string;
      input: TeamGoalInput;
      iterations?: number;
    };
    try {
      const result = runSimulation(input, iterations ?? DEFAULT_ITERATIONS);
      (self as unknown as Worker).postMessage({ type: 'RESULT', requestId, result });
    } catch (err) {
      (self as unknown as Worker).postMessage({
        type: 'ERROR',
        requestId,
        message: err instanceof Error ? err.message : 'Unknown simulation error',
      });
    }
  };
}
