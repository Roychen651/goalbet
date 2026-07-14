import { useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import NumberFlow from '@number-flow/react';
import { Maximize2 } from 'lucide-react';
import { useLangStore } from '../../stores/langStore';
import { cn } from '../../lib/utils';
import { haptic } from '../../lib/haptics';
import { Avatar } from '../ui/Avatar';
import { ExpandedH2HView } from './ExpandedH2HView';
import type { ArenaH2HRow } from '../../hooks/useStatsArena';

interface H2HMatrixProps {
  matrix: ArenaH2HRow[];
}

// The opponent picker re-indexes into the already-fetched matrix from
// get_stats_arena_payload — selecting a rival fires zero network requests,
// which is the whole point of Commit 1's single-RPC, no-N+1 design.
export function H2HMatrix({ matrix }: H2HMatrixProps) {
  const { t } = useLangStore();
  const [selectedId, setSelectedId] = useState<string | null>(matrix[0]?.opponent_id ?? null);
  const [expanded, setExpanded] = useState(false);

  if (matrix.length === 0) {
    return <p className="font-mono text-sm text-text-muted">{t('arenaH2HEmpty')}</p>;
  }

  const selected = matrix.find(r => r.opponent_id === selectedId) ?? matrix[0];
  const total = selected.user_wins + selected.opponent_wins + selected.ties || 1;
  const winPct = (selected.user_wins / total) * 100;
  const tiePct = (selected.ties / total) * 100;
  const lossPct = (selected.opponent_wins / total) * 100;
  const hasHistory = selected.match_details.length > 0;

  const barSpring = { type: 'spring' as const, stiffness: 180, damping: 24 };

  return (
    <LayoutGroup>
      <div className="flex flex-col gap-3">
        <p className="font-mono text-xs text-text-muted">
          {t('arenaH2HSubtitle').replace('{0}', String(matrix.length))}
        </p>

        {/* Opponent picker — scroll-snap rail, Lenis-wheel-compatible per rule 4 */}
        <div
          className="flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-1 -mx-1 px-1"
          data-lenis-prevent
        >
          {matrix.map(row => (
            <button
              key={row.opponent_id}
              type="button"
              onClick={() => { if (row.opponent_id !== selectedId) haptic('selection'); setSelectedId(row.opponent_id); setExpanded(false); }}
              className={cn(
                'snap-start shrink-0 flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl border transition-colors duration-150',
                row.opponent_id === selectedId
                  ? 'border-accent-green/60 bg-accent-green/10'
                  : 'border-border-subtle bg-white/5 hover:bg-white/10'
              )}
            >
              <Avatar src={row.avatar_url} name={row.username} size="sm" />
              <span className="font-barlow text-[10px] text-text-muted max-w-[4.5rem] truncate">
                {row.username}
              </span>
            </button>
          ))}
        </div>

        {/* Comparison panel — layoutId-shared with ExpandedH2HView (Sprint 16).
            Tapping the expand affordance morphs this exact box into the full
            match-history portal rather than popping a generic modal. */}
        <AnimatePresence mode="popLayout">
          {!expanded && (
            <motion.div
              key="collapsed"
              layoutId={`h2h-panel-${selected.opponent_id}`}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              className="relative grid grid-cols-2 gap-3 rounded-xl bg-white/5 p-3"
            >
              {hasHistory && (
                <button
                  type="button"
                  onClick={() => { haptic('selection'); setExpanded(true); }}
                  aria-label={t('arenaH2HExpandAria')}
                  className="absolute top-2 end-2 w-6 h-6 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/15 text-text-muted hover:text-text-primary transition-colors"
                >
                  <Maximize2 size={12} />
                </button>
              )}

              <div className="text-center">
                <p className="font-barlow text-[10px] uppercase tracking-widest text-text-muted">{t('you')}</p>
                <p className="font-mono font-bold text-xl text-accent-green tabular-nums">
                  <NumberFlow value={selected.user_points} />
                </p>
              </div>
              <div className="text-center">
                <p className="font-barlow text-[10px] uppercase tracking-widest text-text-muted truncate">
                  {selected.username}
                </p>
                <p className="font-mono font-bold text-xl text-text-primary tabular-nums">
                  <NumberFlow value={selected.opponent_points} />
                </p>
              </div>

              <div className="col-span-2 flex items-center justify-between text-xs font-mono text-text-muted">
                <span>{t('arenaH2HPoints')}</span>
                <span>
                  {t('arenaH2HShared')}: <NumberFlow value={selected.shared_matches} />
                </span>
              </div>

              <div className="col-span-2">
                <p className="font-barlow text-[10px] uppercase tracking-widest text-text-muted mb-1">
                  {t('arenaH2HRecord')}
                </p>
                {/* Segments animate their width on opponent switch instead of
                    snapping — the bar visibly redistributes rather than jump-cutting. */}
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <motion.div animate={{ width: `${winPct}%` }} transition={barSpring} className="bg-accent-green" />
                  <motion.div animate={{ width: `${tiePct}%` }} transition={barSpring} className="bg-white/30" />
                  <motion.div animate={{ width: `${lossPct}%` }} transition={barSpring} className="bg-accent-orange" />
                </div>
                <div className="mt-1 flex justify-between font-mono text-[11px] text-text-muted tabular-nums">
                  <span>
                    <NumberFlow value={selected.user_wins} />W
                  </span>
                  <span>
                    <NumberFlow value={selected.ties} />T
                  </span>
                  <span>
                    <NumberFlow value={selected.opponent_wins} />W
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {expanded && <ExpandedH2HView row={selected} onClose={() => setExpanded(false)} />}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}
