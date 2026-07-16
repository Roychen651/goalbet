import { useEffect, useRef, useState } from 'react';
import { fetchMatchStats, extractSnapshot, computePressureSample, type BoxscoreSnapshot } from '../lib/matchBoxscore';
import { LEAGUE_ESPN_SLUG, LIVE_STATUSES } from '../lib/constants';
import type { Match } from '../lib/supabase';

// V4 Sprint 32 — fixed-length rolling window, not just for tidiness: Framer
// Motion's built-in complex-value interpolation can only smoothly morph an
// SVG `d` string between two renders when the command STRUCTURE is
// identical (same M/C token sequence, same point count) — only the numbers
// embedded in it may differ. A variable-length window would change the `d`
// string's shape every time a sample ages out, causing the path to snap
// instead of breathe. 20 samples * 30s cadence = 10 minutes, matching
// MatchMomentumPulse's own WINDOW_MINUTES for visual/conceptual consistency.
const WINDOW_SIZE = 20;
const POLL_MS = 30_000;

export function useMatchPressureFlow(match: Match): { samples: number[]; hasData: boolean } {
  const [samples, setSamples] = useState<number[]>(() => Array(WINDOW_SIZE).fill(0));
  const [hasData, setHasData] = useState(false);
  const prevRef = useRef<BoxscoreSnapshot | null>(null);

  useEffect(() => {
    if (!LEAGUE_ESPN_SLUG[match.league_id]) return;
    if (!LIVE_STATUSES.includes(match.status)) return;

    let cancelled = false;
    const poll = () => {
      fetchMatchStats(match.external_id, match.league_id)
        .then(rows => {
          if (cancelled) return;
          const snap = extractSnapshot(rows);
          if (!snap) return; // no boxscore data yet this tick — leave prior state untouched
          const value = computePressureSample(snap, prevRef.current);
          prevRef.current = snap;
          setHasData(true);
          setSamples(prev => [...prev.slice(1), value]);
        })
        .catch(() => {});
    };

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [match.external_id, match.league_id, match.status]);

  return { samples, hasData };
}
