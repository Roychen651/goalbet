/**
 * PredictionModal — Bottom sheet overlay for the PredictionForm.
 *
 * Reads `activePredictionMatchId` from uiStore.
 * Match/prediction data passed in from HomePage (where the hooks live).
 *
 * CLAUDE.md 4.13: drag="y", dragConstraints={{ top: 0 }}, scroll containers
 * have onPointerDown={e => e.stopPropagation()}.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useLangStore } from '../../stores/langStore';
import { PredictionForm, PredictionData } from './PredictionForm';
import { cn } from '../../lib/utils';
import type { Match, Prediction } from '../../lib/supabase';

interface PredictionModalProps {
  matches: Match[];
  predictions: Map<string, Prediction>;
  onSave: (data: PredictionData) => Promise<void>;
  /** Match ID currently being saved, or null */
  savingMatchId: string | null;
  /** ESPN odds keyed by match ID */
  espnOdds?: Map<string, { homeWin: number; draw: number; awayWin: number }>;
}

export function PredictionModal({ matches, predictions, onSave, savingMatchId, espnOdds }: PredictionModalProps) {
  const matchId = useUIStore(s => s.activePredictionMatchId);
  const close = useUIStore(s => s.closePredictionModal);
  const { t } = useLangStore();

  const match = matchId ? matches.find(m => m.id === matchId) : null;
  const prediction = matchId ? predictions.get(matchId) : undefined;

  return (
    <AnimatePresence>
      {match && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Panel */}
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28, mass: 0.75 }}
            className={cn(
              'relative z-10 w-full sm:max-w-[440px]',
              'rounded-t-2xl sm:rounded-2xl overflow-hidden',
              'shadow-[0_20px_60px_rgba(0,0,0,0.5)]',
              'max-h-[85vh] sm:max-h-[75vh] flex flex-col',
            )}
            style={{
              background: 'var(--color-tooltip-bg)',
              border: '1px solid var(--card-border)',
            }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.15}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 && info.velocity.y > 20) close();
            }}
          >
            {/* Mobile drag handle */}
            <div className="flex justify-center pt-3 pb-0 sm:hidden">
              <div className="w-12 h-1.5 rounded-full bg-text-muted/30" />
            </div>

            {/* Header */}
            <div className="px-4 pt-3 pb-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-text-primary truncate">
                  {match.home_team} vs {match.away_team}
                </span>
                <span className="text-[10px] text-text-muted opacity-60 truncate">
                  {match.league_name}
                  {match.round ? ` · R${match.round}` : ''}
                </span>
              </div>
              <button
                onClick={close}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/8 transition-colors shrink-0 ms-2"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable prediction form */}
            <div
              className="flex-1 overflow-y-auto overscroll-contain px-3.5 py-3"
              onWheel={e => e.stopPropagation()}
              onPointerDown={e => e.stopPropagation()}
            >
              <PredictionForm
                match={match}
                existingPrediction={prediction}
                onSave={async (data) => {
                  await onSave(data);
                  close();
                }}
                saving={savingMatchId === match.id}
                odds={espnOdds?.get(match.id) ?? undefined}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
