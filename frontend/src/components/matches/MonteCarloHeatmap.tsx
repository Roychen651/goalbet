import { motion, AnimatePresence } from 'framer-motion';
import { useLangStore } from '../../stores/langStore';
import { useMonteCarloSimulation } from '../../hooks/useMonteCarloSimulation';
import { interpolateSimulation } from '../../lib/oklch';
import { haptic } from '../../lib/haptics';
import { playSound } from '../../lib/sensoryAudio';
import { cn } from '../../lib/utils';
import type { Match } from '../../lib/supabase';
import type { ScoreProbability } from '../../workers/monteCarloWorker';

// V7 Sprint 52 — "The Monte Carlo Web Worker Engine". Scoped exactly to
// what was asked (3 direct-labeled, tappable cells), never an unrequested
// full 6x6 matrix cluttering a compact form — the same restraint this
// exact card has already had to learn twice (§32's Pressure Cooker
// removal, §47's Attack Pulse correction: don't overload the card unless
// it earns its space). Hidden entirely (return null) below MIN_SAMPLE_SIZE
// or on a worker error — the same "hidden until real data exists"
// convention OracleStatsPanel.tsx (right above this in PredictionForm)
// already established, not a visible error/empty state.

interface MonteCarloHeatmapProps {
  match: Match;
  onSelectScore: (home: number, away: number) => void;
}

function CellSkeleton() {
  return (
    <div className="flex-1 h-16 rounded-lg bg-white/[0.04] animate-pulse" />
  );
}

function ScoreCell({
  cell,
  maxPct,
  onTap,
}: {
  cell: ScoreProbability;
  maxPct: number;
  onTap: () => void;
}) {
  // Ratio against the highest of the visible top-3, not against 100% — the
  // same "denominator must actually mean something" discipline as the Risk
  // Meter (§34): the top cell should always read as fully saturated, the
  // third-place cell dimmer but never invisible. Never the only signal —
  // the real percentage is always rendered as text too (dataviz's
  // non-negotiable rule).
  const ratio = maxPct > 0 ? cell.pct / maxPct : 0;
  const { color } = interpolateSimulation(ratio);

  return (
    <motion.button
      type="button"
      onClick={onTap}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 500, damping: 15 }}
      className="flex-1 h-16 rounded-lg flex flex-col items-center justify-center gap-0.5 border border-white/8"
      style={{ background: `color-mix(in oklch, ${color} 22%, var(--color-bg-card))` }}
    >
      {/* rtl-hebrew-premium: a compound score like "2-1" is a bidi string —
          left unpinned it can visually reorder to "1-2" under Hebrew's RTL
          flow the same way an un-wrapped phone number would. Pinned LTR
          regardless of the surrounding form's direction; the cell's own
          flex layout (which side the cell sits on) stays plain logical
          ordering, no isRTL branch needed there. */}
      <span dir="ltr" className="font-mono font-bold tabular-nums text-sm text-white/90">
        {cell.home}–{cell.away}
      </span>
      <span className="font-mono tabular-nums text-[10px]" style={{ color }}>
        {cell.pct.toFixed(1)}%
      </span>
    </motion.button>
  );
}

export function MonteCarloHeatmap({ match, onSelectScore }: MonteCarloHeatmapProps) {
  const { t } = useLangStore();
  const { state, top3 } = useMonteCarloSimulation(match);

  if (state === 'idle' || state === 'insufficient_data' || state === 'error') return null;

  const maxPct = top3.length > 0 ? top3[0].pct : 0;

  const handleTap = (cell: ScoreProbability) => {
    haptic('selection');
    playSound('toggle_click');
    onSelectScore(cell.home, cell.away);
  };

  return (
    <div className="mt-2 px-3 py-2.5 rounded-xl border border-white/6 bg-white/[0.02]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[9px] uppercase tracking-widest text-white/30">{t('monteCarloTitle')}</p>
        <p className="text-[9px] text-white/20">{t('monteCarloSubtitle')}</p>
      </div>

      <AnimatePresence mode="wait">
        {state === 'simulating' ? (
          <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2">
            <CellSkeleton />
            <CellSkeleton />
            <CellSkeleton />
          </motion.div>
        ) : (
          <motion.div key="cells" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2">
            {top3.map((cell) => (
              <ScoreCell key={`${cell.home}-${cell.away}`} cell={cell} maxPct={maxPct} onTap={() => handleTap(cell)} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <p className={cn('mt-1.5 text-[9px] text-white/25 text-center')}>{t('monteCarloTapHint')}</p>
    </div>
  );
}
