/**
 * PlayerCardSheet — V7 Sprint 53 Commit 2. The "interactive player card"
 * from a tap on any pin in TacticalPitch3D (or any row in MatchRosters'
 * list-view fallback). Shell copies WeeklyPodiumModal.tsx's / H2HModal.tsx's
 * exact proven shape (createPortal, static bg-black/80 + backdrop-blur-md
 * backdrop, spring-entrance motion.div wrapping a plain `card-elevated`
 * child) — a shape that already coexists safely with a transformed ancestor
 * in this exact codebase (the backdrop itself is never transformed; only
 * the card's own mount-entrance motion.div is, a one-shot settle-and-done
 * animation, not the continuous/interactive category this app's WebKit
 * backdrop-filter+transform trap is actually about).
 *
 * Renders ONLY real fields already present on PitchPlayer (name, jersey,
 * position, starter/subbedIn/subbedOut, injured) — every one of them
 * genuinely parsed from ESPN's roster response by MatchRosters.tsx's own
 * fetchRosters(). No fabricated rating, goals, assists, or heatmap: this
 * codebase has repeatedly declined shipping data that doesn't exist
 * anywhere in the real ESPN response (§48's Oracle Narrator Pattern, §60's
 * Trophy Cabinet audit) — a player card is no exception. A field that's
 * genuinely absent (no formation-level position label, no injury flag)
 * is simply omitted from the card, never replaced with a placeholder.
 */

import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { useLangStore } from '../../stores/langStore';
import type { TranslationKey } from '../../lib/i18n';
import { cn } from '../../lib/utils';
import type { PitchPlayer } from './TacticalPitch';

interface PlayerCardSheetProps {
  player: PitchPlayer;
  isHome: boolean;
  teamName: string;
  onClose: () => void;
}

const POS_LABEL_KEY: Record<string, TranslationKey> = {
  GK: 'goalkeeper',
  DEF: 'defender',
  MID: 'midfielder',
  FWD: 'forward',
};

export function PlayerCardSheet({ player, isHome, teamName, onClose }: PlayerCardSheetProps) {
  const { t } = useLangStore();
  const teamShort = teamName.split(' ').pop() ?? teamName;
  const posKey = POS_LABEL_KEY[player.positionShort];
  const posLabel = posKey ? t(posKey) : player.positionShort;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      <motion.div
        className="relative w-full max-w-sm"
        initial={{ opacity: 0, y: 48, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="rounded-2xl card-elevated border border-white/10 overflow-hidden">
          {/* Header */}
          <div
            className={cn(
              'px-5 pt-5 pb-4 flex items-start justify-between gap-3',
              isHome ? 'bg-accent-green/[0.06]' : 'bg-accent-orange/[0.06]',
              'border-b border-white/8',
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0',
                    'text-[13px] font-display font-bold tabular-nums',
                    isHome
                      ? 'bg-accent-green/20 border-accent-green/60 text-accent-green'
                      : 'bg-accent-orange/20 border-accent-orange/60 text-accent-orange',
                  )}
                >
                  {player.jersey || '–'}
                </span>
                <div className="min-w-0">
                  <h2 className="font-bebas text-xl tracking-wide text-white truncate">
                    {player.name}
                  </h2>
                  <p className={cn(
                    'text-[11px] font-semibold uppercase tracking-widest truncate',
                    isHome ? 'text-accent-green/70' : 'text-accent-orange/70',
                  )}>
                    {teamShort}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/8 border border-white/12 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/15 transition-all text-sm shrink-0"
            >
              ✕
            </button>
          </div>

          {/* Body — real fields only */}
          <div className="px-5 py-4 space-y-2.5">
            <Row label={posLabel} />
            {typeof player.starter === 'boolean' && (
              <Row label={player.starter ? t('playerCardStatusStarter') : t('playerCardStatusSub')} />
            )}
            {player.subbedIn && (
              <Row label={t('playerCardSubbedIn')} icon={<ArrowUpCircle size={13} className="text-emerald-400" />} />
            )}
            {player.subbedOut && (
              <Row label={t('playerCardSubbedOut')} icon={<ArrowDownCircle size={13} className="text-red-400/80" />} />
            )}
            {player.injured && (
              <Row label={t('playerCardInjured')} icon={<AlertCircle size={13} className="text-accent-orange" />} />
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

function Row({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-white/75">
      {icon}
      <span className={icon ? '' : 'text-white/50'}>{label}</span>
    </div>
  );
}
