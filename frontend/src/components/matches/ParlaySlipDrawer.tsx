import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, X } from 'lucide-react';
import { useLangStore } from '../../stores/langStore';
import { haptic } from '../../lib/haptics';
import { playSound } from '../../lib/sensoryAudio';
import { parlayIntensityColor } from '../../lib/oklch';
import { calcParlayBonusPreview, type ParlayTierKey } from '../../lib/constants';
import { TIER_COLORS } from '../../lib/tierVisuals';
import { cn } from '../../lib/utils';
import type { TranslationKey } from '../../lib/i18n';
import { InfoTip } from '../ui/InfoTip';

// V5 Sprint 34 — "The Prediction Matrix". "כרטיס השילוב שלי" (My Parlay
// Slip). Deliberately NOT a second full-screen modal with its own backdrop:
// PredictionForm already lives inside its own sheet (Vaul on mobile /
// centered dialog on desktop, §35) — stacking a second independent modal
// on top would be a heavy "sheet inside a sheet" UX. This is an inline
// panel within the existing form's own flow, entering/exiting via
// AnimatePresence with the organic spring the brief asked for.
//
// V5 Sprint 36 Hotfix — a real bug, reported live: this panel is NOT the
// last element in PredictionForm's list (Sprint 36's "Start a Shared Pool"
// button, plus the coin summary/submit button, all render after it). A
// `position: sticky` element doesn't reserve space at its pinned position —
// it paints on top of whatever else is scrolling underneath once its
// sticky threshold triggers, which is exactly what made this drawer visibly
// overlap the Total Goals tier row on a real device (screenshot evidence).
// Sticky is the wrong tool for "float above the current scroll position"
// when there's more real content below it in the same flow — plain in-flow
// positioning (no `sticky`) is what actually guarantees zero overlap.
//
// The WebKit blur+transform trap this codebase has shipped twice already
// (PredictionModal's Vaul sheet once, §21/§34; solved again for
// NotificationCenter's drawer, §38) is designed around from the start:
// the glass blur lives on this panel's own backdrop-filter CSS class
// (card-elevated), but the panel itself is NOT what carries the entrance
// `y`/`opacity` transform — a plain wrapper motion.div owns the transform,
// and the blurred surface is a static inner div, never the same element
// that's being animated. (Unlike NotificationCenter's full-screen drawer,
// there's no separate fixed backdrop here — this panel doesn't cover the
// whole screen, so there's nothing behind it that needs dimming.)
//
// Locking the parlay is a pure client-side confirmation, not a second
// network call — is_parlay=true the moment 2+ tiers are linked (Commit 2),
// carried on the NEXT save via the form's own existing submit flow. The
// lock button here is tactile flair confirming that state, collapsing the
// drawer to a compact "armed" pill — never a second RPC call.

const PARLAY_TIER_COLOR_INDEX: Record<ParlayTierKey, number> = {
  result: 0, score: 1, corners: 2, btts: 3, ou: 4,
};

const PARLAY_TIER_LABEL_KEY: Record<ParlayTierKey, TranslationKey> = {
  result: 'fullTimeResult', score: 'exactScore', corners: 'totalCorners', btts: 'bothTeamsToScore', ou: 'totalGoals',
};

interface ParlaySlipDrawerProps {
  linkedTiers: Set<ParlayTierKey>;
  tierPoints: Record<ParlayTierKey, number>;
  onUnlink: (key: ParlayTierKey) => void;
}

export function ParlaySlipDrawer({ linkedTiers, tierPoints, onUnlink }: ParlaySlipDrawerProps) {
  const { t } = useLangStore();
  const [confirmed, setConfirmed] = useState(false);
  const linkedList = Array.from(linkedTiers);
  const k = linkedList.length;
  const armed = k >= 2;

  // Re-arm the confirmation state whenever the actual linked-tier set
  // changes (a tier was added/removed) — a stale "confirmed" pill sitting
  // over a since-changed selection would be actively misleading.
  useEffect(() => {
    setConfirmed(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedList.join(',')]);

  if (!armed) return null;

  const bonus = calcParlayBonusPreview(linkedList, tierPoints);
  const intensityColor = parlayIntensityColor(k);
  const multiplier = (1 + 0.25 * (k - 1)).toFixed(2);

  const handleLock = () => {
    haptic('bet_lock');
    playSound('lock_thud');
    setConfirmed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="parlay-slip"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 180, damping: 18 }}
        className="mt-2"
      >
        <div
          className="rounded-2xl border overflow-hidden card-elevated"
          style={{ borderColor: `color-mix(in oklch, ${intensityColor} 45%, var(--card-border))` }}
        >
          <AnimatePresence mode="wait">
            {confirmed ? (
              <motion.div
                key="confirmed"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-between gap-2 px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <Link2 size={14} style={{ color: intensityColor }} />
                  <span className="text-xs font-headline uppercase tracking-wider text-text-primary">
                    {t('parlaySlipArmed')}
                  </span>
                </div>
                <span
                  className="text-[11px] font-mono font-bold tabular-nums px-2 py-0.5 rounded-full"
                  style={{ color: intensityColor, background: `color-mix(in oklch, ${intensityColor} 16%, transparent)` }}
                >
                  x{multiplier}
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="expanded"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-[11px] font-headline uppercase tracking-wider text-text-primary">
                    {t('parlaySlipTitle')}
                    <InfoTip text={t('parlaySlipDrawerHint')} />
                  </span>
                  <span
                    className="text-[10px] font-mono font-bold tabular-nums px-2 py-0.5 rounded-full shrink-0"
                    style={{ color: intensityColor, background: `color-mix(in oklch, ${intensityColor} 16%, transparent)` }}
                  >
                    x{multiplier} · +{bonus} {t('pts')}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {linkedList.map((key) => {
                    const color = TIER_COLORS[PARLAY_TIER_COLOR_INDEX[key]];
                    return (
                      <span
                        key={key}
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border',
                          'border-current bg-current/10',
                          color.pts,
                        )}
                      >
                        {t(PARLAY_TIER_LABEL_KEY[key])}
                        <button
                          type="button"
                          onClick={() => onUnlink(key)}
                          aria-label={t('parlayUnlink')}
                          className="opacity-60 hover:opacity-100 -me-0.5"
                        >
                          <X size={10} strokeWidth={3} />
                        </button>
                      </span>
                    );
                  })}
                </div>

                <motion.button
                  type="button"
                  onClick={handleLock}
                  whileTap={{ scale: 0.95, rotate: -0.5, transition: { type: 'spring', stiffness: 500, damping: 15 } }}
                  className="w-full py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white"
                  style={{ background: `linear-gradient(135deg, ${intensityColor}, color-mix(in oklch, ${intensityColor} 60%, black))` }}
                >
                  {t('parlaySlipLock')}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
