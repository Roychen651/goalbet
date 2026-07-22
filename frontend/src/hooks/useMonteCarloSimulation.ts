import { useEffect, useRef, useState } from 'react';
import type { Match } from '../lib/supabase';
import {
  MIN_SAMPLE_SIZE,
  DEFAULT_ITERATIONS,
  type TeamGoalInput,
  type SimulationResult,
  type ScoreProbability,
} from '../workers/monteCarloWorker';

// V7 Sprint 52 — "The Monte Carlo Web Worker Engine"
//
// SCOPE NOTE, stated plainly rather than silently dropped: this hook does
// NOT fetch get_referee_strictness() (migration 061). Wiring it in would
// add a second async network dependency (fire only when match.referee_name
// happens to be set — which, per scoreUpdater.ts, only ever happens at FT
// resolution, so it's a rare edge case for the NS matches this simulator
// actually runs on) for a capped ±5% adjustment the worker already treats
// as fully optional. The approved blueprint's "zero new network calls"
// promise is honored literally here: every input comes from
// match.oracle_stats, already sitting on the match row. refereeDampening
// is always passed as null in this version. monteCarloWorker.ts's
// deriveLambdas() already accepts and correctly clamps a real dampening
// value whenever a future sprint wants to wire the RPC in — this is a
// deliberate, documented deferral, not an oversight.
//
// WORKER LIFECYCLE — a module-level singleton, created lazily on first
// use, never torn down for the life of the tab. Verified correct against
// the real app shape, not assumed: uiStore.ts's activePredictionMatchId
// is `string | null` (a singleton, not a list) — at most one
// PredictionForm is ever mounted at a time, so there is never a second
// concurrent consumer to share/contend the worker with. Spawning a new
// Worker per mount would pay real (if small) instantiation cost on every
// sheet open for a computation that's otherwise ~tens of milliseconds.

let workerInstance: Worker | null = null;

interface PendingRequest {
  resolve: (result: SimulationResult) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

const pendingRequests = new Map<string, PendingRequest>();

// Defensive — the whole simulation is bounded, single-digit-to-low-tens of
// milliseconds even on modest hardware (50k Poisson draws is cheap). 5s is
// generous headroom, never expected to fire in practice; it exists purely
// so a genuinely wedged worker can't leak a pending Promise forever.
const SIMULATION_TIMEOUT_MS = 5000;

function getWorker(): Worker {
  if (workerInstance) return workerInstance;

  workerInstance = new Worker(new URL('../workers/monteCarloWorker.ts', import.meta.url), {
    type: 'module',
  });

  workerInstance.onmessage = (e: MessageEvent) => {
    const data = e.data as
      | { type: 'RESULT'; requestId: string; result: SimulationResult }
      | { type: 'ERROR'; requestId: string; message: string };
    const pending = pendingRequests.get(data.requestId);
    // A missing entry means this response arrived after the hook already
    // gave up on it (timeout) or a newer request superseded it — silently
    // drop it, never throw on an unexpected/late message.
    if (!pending) return;
    pendingRequests.delete(data.requestId);
    clearTimeout(pending.timeoutId);
    if (data.type === 'RESULT') {
      pending.resolve(data.result);
    } else {
      pending.reject(new Error(data.message));
    }
  };

  workerInstance.onerror = () => {
    // A genuine worker crash (not a message-level ERROR, which is handled
    // above) — fail every in-flight request rather than leaving them
    // pending forever, then let the next simulate() call transparently
    // respawn a fresh worker.
    pendingRequests.forEach((p) => {
      clearTimeout(p.timeoutId);
      p.reject(new Error('Monte Carlo worker crashed'));
    });
    pendingRequests.clear();
    workerInstance = null;
  };

  return workerInstance;
}

let requestCounter = 0;

function requestSimulation(input: TeamGoalInput): { requestId: string; promise: Promise<SimulationResult> } {
  const requestId = `mc-${++requestCounter}-${Date.now()}`;
  const promise = new Promise<SimulationResult>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('Monte Carlo simulation timed out'));
    }, SIMULATION_TIMEOUT_MS);
    pendingRequests.set(requestId, { resolve, reject, timeoutId });
  });
  getWorker().postMessage({ requestId, input, iterations: DEFAULT_ITERATIONS });
  return { requestId, promise };
}

// In-memory only — this is a genuinely $0, disposable, client-only
// computation. Never written to Supabase; re-deriving it from
// already-cached oracle_stats costs nothing worth persisting across
// sessions. Keyed on everything that could change the simulation's output,
// so a stale cache entry can never survive real data moving underneath it.
const resultCache = new Map<string, SimulationResult>();

function cacheKeyFor(matchId: string, home: { sample_size: number; avg_goals_scored: number | null; avg_goals_conceded: number | null }, away: typeof home): string {
  return [
    matchId,
    home.sample_size, home.avg_goals_scored, home.avg_goals_conceded,
    away.sample_size, away.avg_goals_scored, away.avg_goals_conceded,
  ].join(':');
}

export type MonteCarloState = 'idle' | 'insufficient_data' | 'simulating' | 'ready' | 'error';

export interface UseMonteCarloSimulationResult {
  state: MonteCarloState;
  top3: ScoreProbability[];
  lambdaHome: number | null;
  lambdaAway: number | null;
}

const EMPTY_TOP3: ScoreProbability[] = [];

/**
 * Runs (or reuses a cached run of) a 50,000-iteration Poisson exact-score
 * simulation for `match`, entirely off the main thread. Returns
 * `insufficient_data` whenever either team's recent-form sample is below
 * this codebase's established MIN_SAMPLE_SIZE floor (matching
 * ScoutReportPanel.tsx/H2HModal.tsx/PredictorArchetypeBadge.tsx) or the
 * two goal averages aren't present yet (a match.oracle_stats blob written
 * before migration 067 lacks them) — never simulates on a near-empty or
 * incomplete sample.
 */
export function useMonteCarloSimulation(match: Match | null | undefined): UseMonteCarloSimulationResult {
  const [state, setState] = useState<MonteCarloState>('idle');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const latestRequestIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!match) {
      setState('idle');
      setResult(null);
      latestRequestIdRef.current = null;
      return;
    }

    const stats = match.oracle_stats;
    const home = stats?.home;
    const away = stats?.away;

    const insufficientData =
      !home ||
      !away ||
      home.sample_size < MIN_SAMPLE_SIZE ||
      away.sample_size < MIN_SAMPLE_SIZE ||
      home.avg_goals_scored == null ||
      home.avg_goals_conceded == null ||
      away.avg_goals_scored == null ||
      away.avg_goals_conceded == null;

    if (insufficientData) {
      setState('insufficient_data');
      setResult(null);
      latestRequestIdRef.current = null;
      return;
    }

    // TypeScript narrowing above already proves these are non-null at
    // this point, but the `!` assertions make that explicit at the call
    // site rather than relying on the compiler's control-flow inference
    // across a destructure boundary.
    const key = cacheKeyFor(match.id, home!, away!);
    const cached = resultCache.get(key);
    if (cached) {
      latestRequestIdRef.current = null;
      setResult(cached);
      setState('ready');
      return;
    }

    setState('simulating');

    const input: TeamGoalInput = {
      homeAvgScored: home!.avg_goals_scored,
      homeAvgConceded: home!.avg_goals_conceded,
      awayAvgScored: away!.avg_goals_scored,
      awayAvgConceded: away!.avg_goals_conceded,
      // See the file-header scope note — always null in this version.
      refereeDampening: null,
    };

    const { requestId, promise } = requestSimulation(input);
    latestRequestIdRef.current = requestId;

    promise
      .then((simResult) => {
        // Ignore a response that arrived after a newer request superseded
        // it (a fast match switch) — the same "discard a stale async
        // response" discipline usePredictions.ts's in-flight guard already
        // established (§35), applied here to a worker round trip instead
        // of a Supabase RPC.
        if (latestRequestIdRef.current !== requestId) return;
        resultCache.set(key, simResult);
        setResult(simResult);
        setState('ready');
      })
      .catch(() => {
        if (latestRequestIdRef.current !== requestId) return;
        setResult(null);
        setState('error');
      });

    return () => {
      // Unmounting/re-running doesn't cancel the in-flight worker request
      // (there's no cheap way to abort a running postMessage computation),
      // it just stops this effect instance from ever acting on the
      // response — the requestId check above is what makes that safe.
      if (latestRequestIdRef.current === requestId) {
        latestRequestIdRef.current = null;
      }
    };
    // match.oracle_stats/id are the only real dependencies (a JSONB
    // reference from a fresh TanStack fetch changes identity whenever its
    // content changes — the same object-identity contract useMatches.ts's
    // structural sharing already guarantees elsewhere in this app).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id, match?.oracle_stats]);

  return {
    state,
    top3: result?.top3 ?? EMPTY_TOP3,
    lambdaHome: result?.lambdaHome ?? null,
    lambdaAway: result?.lambdaAway ?? null,
  };
}
