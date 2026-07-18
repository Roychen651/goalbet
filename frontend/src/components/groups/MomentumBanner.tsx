import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Zap, Check } from 'lucide-react';
import { useMicroPrediction } from '../../hooks/useMicroPrediction';
import { useCountdown } from '../../hooks/useCountdown';
import { useLangStore } from '../../stores/langStore';
import { cn } from '../../lib/utils';
import type { TranslationKey } from '../../lib/i18n';
import { MomentumBetSheet } from './MomentumBetSheet';
import { tTeam } from '../../lib/dictionaries/teamsHe';
import { InfoTip } from '../ui/InfoTip';

const MILESTONE_KEY: Record<string, TranslationKey> = {
  kickoff: 'momentumMilestoneKickoff',
  halftime: 'momentumMilestoneHalftime',
  minute_75: 'momentumMilestoneMinute75',
};

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

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
  // Locked phase: the outcome window is fixed at [locked_at, locked_at+10min)
  // (§29's arbitrage-prevention design) — resolves_at is exactly that window's
  // end, so this counts down to the real resolution moment, not a guess.
  const resolvingIn = useCountdown(question?.status === 'locked' ? question.resolves_at : null);

  if (!question) return null;
  const isHe = lang === 'he';
  const milestoneLabel = t(MILESTONE_KEY[question.milestone] ?? 'momentumMilestoneKickoff');
  const isLocked = question.status !== 'open';
  // A bet the caller already placed is just as "inert" (nothing left to
  // do here) while the question is still open as it is once locked — the
  // dimmed/calm treatment CLAUDE.md already mandates for a disabled
  // interactive element (§21 — "must look disabled, not just behave
  // disabled") applies equally to this state, not only the locked one.
  const isInert = isLocked || Boolean(myBet);

  return (
    <>
      <motion.button
        onClick={() => !isLocked && setSheetOpen(true)}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ type: 'spring' as const, stiffness: 260, damping: 24 }}
        className={cn(
          'relative w-full rounded-2xl p-[1.5px] overflow-hidden mb-4 text-start',
          // Betting is structurally closed once locked (§29 — the outcome
          // window only starts after the tap-target closes, so a late tap
          // can never be honored). Without a visual cue the card kept its
          // full-brightness "urgent, tappable" look even while inert —
          // dimming + a not-allowed cursor makes the disabled state legible
          // instead of looking like a broken button.
          isInert && 'opacity-70 cursor-default',
        )}
        dir={isHe ? 'rtl' : 'ltr'}
        disabled={isLocked}
      >
        {/* Breathing neon border — urgent rotation, red/amber/ice-blue family
            matching HTAnalystCard's "live broadcast" vocabulary. Slower once
            locked — the urgency was about the betting window, not the wait. */}
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
          transition={{ duration: isInert ? 7 : 3.6, ease: 'linear', repeat: Infinity }}
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
            transition={{ duration: isInert ? 2.4 : 1.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            {isLocked ? (
              <Lock size={16} className="text-[#FF4D66]" />
            ) : myBet ? (
              <Check size={16} className="text-[#FF4D66]" />
            ) : (
              <Zap size={18} className="text-[#FF4D66]" fill="currentColor" />
            )}
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-white/50 font-bebas">
              <span>{milestoneLabel}</span>
              {question.home_team && question.away_team && (
                <span className="truncate">
                  · {lang === 'he'
                    ? `${tTeam(question.home_team)} נגד ${tTeam(question.away_team)}`
                    : `${question.home_team} vs ${question.away_team}`}
                </span>
              )}
            </div>
            <div className="text-white font-semibold text-sm truncate">
              {/* Bug fix (live report): this used to gate on `isLocked &&
                  myBet` — while the question is still 'open' (the whole
                  60s betting window), the banner looked IDENTICAL whether
                  the user had already bet or not, since the title stayed
                  generic until locking. That's exactly what invited the
                  reported "I could press Yes again and again" loop — the
                  confirmation must show the instant a bet lands, not only
                  once the window closes. */}
              {myBet
                ? t('momentumAlreadyBet').replace('{0}', t(myBet.choice === 'yes' ? 'yes' : 'no'))
                : t('momentumTitle')}
              {/* Real user confusion, addressed directly: "a goal went in
                  a minute after I bet and nothing happened." That's
                  actually correct per §29's arbitrage-proof design — the
                  outcome window is the FULL 10 minutes from lock, checked
                  once at the end, never the instant a goal happens
                  (changing that would reopen the exact race the whole
                  mechanic exists to prevent). The fix here isn't the
                  timing — it's explaining it, so the wait reads as
                  "working as intended" instead of "broken." */}
              {isLocked && myBet && <InfoTip text={t('momentumResolvesExplainer')} />}
            </div>
          </div>

          {isLocked ? (
            question.resolves_at ? (
              <div
                className="shrink-0 font-display font-bold text-xl tabular-nums text-[#BDE8F5]"
                style={{ textShadow: '0 0 14px rgba(189,232,245,0.35)' }}
                aria-label={t('momentumResolvesIn').replace('{0}', formatMMSS(resolvingIn))}
              >
                {formatMMSS(resolvingIn)}
              </div>
            ) : (
              <span className="shrink-0 text-xs text-white/50 font-medium">{t('momentumLocked')}</span>
            )
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
