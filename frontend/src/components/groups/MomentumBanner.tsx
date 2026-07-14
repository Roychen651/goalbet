import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap } from 'lucide-react';
import { useMicroPrediction } from '../../hooks/useMicroPrediction';
import { useCountdown } from '../../hooks/useCountdown';
import { useLangStore } from '../../stores/langStore';
import type { TranslationKey } from '../../lib/i18n';
import { MomentumBetSheet } from './MomentumBetSheet';

const MILESTONE_KEY: Record<string, TranslationKey> = {
  kickoff: 'momentumMilestoneKickoff',
  halftime: 'momentumMilestoneHalftime',
  minute_75: 'momentumMilestoneMinute75',
};

/**
 * The countdown ticks via useCountdown — same isolated local-state shape as
 * useLiveClock, so the 1Hz tick re-renders only this component. LockerRoomPage
 * and the ActivityFeed list beside it never re-render because of this timer.
 */
export function MomentumBanner() {
  const { question, myBet } = useMicroPrediction();
  const { t, lang } = useLangStore();
  const [sheetOpen, setSheetOpen] = useState(false);
  const remaining = useCountdown(question?.status === 'open' ? question.expires_at : null);

  if (!question) return null;
  const isHe = lang === 'he';
  const milestoneLabel = t(MILESTONE_KEY[question.milestone] ?? 'momentumMilestoneKickoff');
  const isLocked = question.status !== 'open';

  return (
    <>
      <motion.button
        onClick={() => !isLocked && setSheetOpen(true)}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ type: 'spring' as const, stiffness: 260, damping: 24 }}
        className="relative w-full rounded-2xl p-[1.5px] overflow-hidden mb-4 text-start"
        dir={isHe ? 'rtl' : 'ltr'}
        disabled={isLocked}
      >
        {/* Breathing neon border — urgent rotation, red/amber/ice-blue family
            matching HTAnalystCard's "live broadcast" vocabulary */}
        <motion.span
          aria-hidden
          className="absolute inset-[-55%]"
          style={{
            background:
              'conic-gradient(from 0deg,' +
              ' rgba(255,77,102,0.0) 0%,' +
              ' rgba(255,77,102,0.95) 12%,' +
              ' rgba(255,201,74,0.75) 28%,' +
              ' rgba(189,232,245,0.85) 48%,' +
              ' rgba(255,77,102,0.55) 66%,' +
              ' rgba(255,201,74,0.0) 82%,' +
              ' rgba(255,77,102,0.0) 100%)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 3.6, ease: 'linear', repeat: Infinity }}
        />

        <div
          className="relative rounded-[calc(1rem-1.5px)] px-4 py-3.5 flex items-center gap-3"
          style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,0.72) 0%, rgba(4,8,16,0.70) 100%)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <motion.div
            className="w-9 h-9 rounded-xl bg-[#FF4D66]/15 flex items-center justify-center shrink-0"
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Zap size={18} className="text-[#FF4D66]" fill="currentColor" />
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-white/50 font-bebas">
              <span>{milestoneLabel}</span>
              {question.home_team && question.away_team && (
                <span className="truncate">· {question.home_team} vs {question.away_team}</span>
              )}
            </div>
            <div className="text-white font-semibold text-sm truncate">{t('momentumTitle')}</div>
          </div>

          {isLocked ? (
            <span className="shrink-0 text-xs text-white/50 font-medium">
              {myBet ? t('momentumAlreadyBet').replace('{0}', t(myBet.choice === 'yes' ? 'yes' : 'no')) : t('momentumLocked')}
            </span>
          ) : (
            <div className="shrink-0 font-display font-bold text-2xl tabular-nums text-[#FFC94A]" style={{ textShadow: '0 0 14px rgba(255,201,74,0.4)' }}>
              {remaining}s
            </div>
          )}
        </div>
      </motion.button>

      <AnimatePresence>
        {sheetOpen && question && (
          <MomentumBetSheet question={question} myBet={myBet} onClose={() => setSheetOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
