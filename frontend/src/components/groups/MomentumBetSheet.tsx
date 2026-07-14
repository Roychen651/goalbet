import { useState } from 'react';
import { motion } from 'framer-motion';
import { CoinIcon } from '../ui/CoinIcon';
import { useMicroPrediction, type MicroQuestion } from '../../hooks/useMicroPrediction';
import { useLangStore } from '../../stores/langStore';
import { useUIStore } from '../../stores/uiStore';
import { haptic } from '../../lib/haptics';

interface MomentumBetSheetProps {
  question: MicroQuestion;
  myBet: { choice: 'yes' | 'no' } | null;
  onClose: () => void;
}

/**
 * Bottom sheet — rule 4.13 swipe-to-close: drag="y" + dragConstraints +
 * onDragEnd threshold, onPointerDown stopPropagation on the (only) scroll
 * container. Same shape as every other bottom sheet in this codebase
 * (CoinGuide, ShareableRecapCard).
 */
export function MomentumBetSheet({ question, myBet, onClose }: MomentumBetSheetProps) {
  const { submitBet, submitting } = useMicroPrediction();
  const { t, lang } = useLangStore();
  const { addToast } = useUIStore();
  const [choice, setChoice] = useState<'yes' | 'no' | null>(null);
  const isHe = lang === 'he';
  const isLocked = question.status !== 'open';

  const handleChoose = async (c: 'yes' | 'no') => {
    if (submitting || myBet || isLocked) return;
    haptic('selection');
    setChoice(c);
    try {
      await submitBet(c);
      haptic('success');
      addToast(t('momentumSubmitToast'), 'success');
      onClose();
    } catch (err) {
      haptic('error');
      const reason = err instanceof Error ? err.message : undefined;
      const toastKey =
        reason === 'question_closed' ? 'momentumErrorClosed'
        : reason === 'already_bet' ? 'momentumErrorAlreadyBet'
        : reason === 'insufficient_coins' ? 'momentumErrorInsufficientCoins'
        : 'momentumFailedToast';
      addToast(t(toastKey), 'error');
      setChoice(null);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        className="relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={0.15}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          if (info.offset.y > 100 && info.velocity.y > 20) onClose();
        }}
      >
        <div className="card-elevated border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden" dir={isHe ? 'rtl' : 'ltr'}>
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-12 h-1.5 rounded-full bg-text-muted/20" />
          </div>

          <div className="px-5 pt-3 pb-4 border-b border-white/8" onPointerDown={e => e.stopPropagation()}>
            <h2 className="font-bebas text-2xl tracking-wider text-white">{t('momentumTitle')}</h2>
            <div className="flex items-center gap-1.5 mt-1 text-white/45 text-xs">
              <span>{t('momentumStake')}</span>
              <CoinIcon size={12} />
            </div>
          </div>

          <div className="px-5 py-5" onPointerDown={e => e.stopPropagation()}>
            {myBet ? (
              <div className="text-center py-4 text-white/70 text-sm">
                {t('momentumAlreadyBet').replace('{0}', t(myBet.choice === 'yes' ? 'yes' : 'no'))}
              </div>
            ) : isLocked ? (
              <div className="text-center py-4 text-white/50 text-sm">{t('momentumLocked')}</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {(['yes', 'no'] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => handleChoose(c)}
                    disabled={submitting}
                    className={`py-5 rounded-2xl font-bebas text-2xl tracking-wider border transition-all active:scale-95 disabled:opacity-50 ${
                      choice === c
                        ? 'bg-accent-green text-bg-base border-accent-green'
                        : 'bg-white/6 text-white border-white/12 hover:border-accent-green/40'
                    }`}
                  >
                    {t(c)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
