import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { PredictionForm, type PredictionData } from './PredictionForm';
import { haptic } from '../../lib/haptics';
import { useLangStore } from '../../stores/langStore';
import type { Match, Prediction } from '../../lib/supabase';
import { tTeam } from '../../lib/dictionaries/teamsHe';
import { tLeagueName } from '../../lib/constants';

// Sprint 20 — the desktop counterpart to PredictionModal.tsx's Vaul drawer.
// Vaul is a drawer-only library (no centered-dialog mode), so this is a
// separate, small Framer Motion dialog reusing PredictionForm exactly like
// the drawer does — PredictionForm itself stays completely unaware of which
// shell it's mounted in.
interface PredictionCardDesktopProps {
  match: Match;
  prediction?: Prediction;
  onSave: (data: PredictionData) => Promise<void>;
  saving: boolean;
  odds?: { homeWin: number; draw: number; awayWin: number } | null;
  isNewUser?: boolean;
  onClose: () => void;
}

export function PredictionCardDesktop({
  match, prediction, onSave, saving, odds, isNewUser, onClose,
}: PredictionCardDesktopProps) {
  const { t, lang } = useLangStore();

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
        className="relative w-full max-w-[460px] max-h-[85dvh]"
        onClick={e => e.stopPropagation()}
      >
        <GlassCard
          variant="elevated"
          grain
          edgeGradient
          className="max-h-[85dvh] overflow-hidden"
          contentClassName="flex flex-col h-full"
        >
          <div className="flex items-center justify-between px-4 pt-4 pb-2.5 border-b border-white/8 shrink-0">
            <div className="flex min-w-0 flex-col">
              <h2 className="truncate text-sm font-bold text-text-primary">
                {lang === 'he' ? `${tTeam(match.home_team)} נגד ${tTeam(match.away_team)}` : `${match.home_team} vs ${match.away_team}`}
              </h2>
              <span className="truncate text-[10px] text-text-muted opacity-60">
                {tLeagueName(match.league_id, match.league_name, lang)}{match.round ? ` · ${lang === 'he' ? `מח' ${match.round}` : `R${match.round}`}` : ''}
              </span>
            </div>
            <button
              onClick={() => { haptic('light'); onClose(); }}
              aria-label={t('close')}
              className="ms-2 shrink-0 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-white/8 hover:text-text-primary"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-3.5 pt-3 pb-4">
            <PredictionForm
              match={match}
              existingPrediction={prediction}
              onSave={async (data) => { await onSave(data); onClose(); }}
              saving={saving}
              odds={odds}
              isNewUser={isNewUser}
            />
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
