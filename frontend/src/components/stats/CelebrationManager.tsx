import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useNewPointsAlert } from '../../hooks/useNewPointsAlert';
import { celebrateAt } from '../../lib/celebrate';

const STREAK_WATERMARK_KEY = 'goalbet_last_seen_streak';
const getLastSeenStreak = () => parseInt(localStorage.getItem(STREAK_WATERMARK_KEY) ?? '0', 10);
const setLastSeenStreak = (n: number) => localStorage.setItem(STREAK_WATERMARK_KEY, String(n));

const RING_DELAY_MS = 150;
const TOTAL_DURATION_MS = 2200;

interface CelebrationManagerProps {
  streak: number;
  cardRef: RefObject<HTMLDivElement>;
  children: (displayStreak: number) => React.ReactNode;
}

/**
 * Sprint 18 — the focused celebration orchestrator. Reuses useNewPointsAlert
 * (unmodified) as the sole win-detection source — no second Realtime
 * subscription, no new points-tracking logic. Fires only when the group's
 * total_points genuinely increased since the user's last visit.
 *
 * Deliberately does NOT replay the coin chime/haptic here — App.tsx's
 * coin-deposit handler already fired those the instant the win actually
 * happened (Sprint 17), possibly minutes before the user opens the Stats tab
 * and this component mounts. This is a purely visual "look what you earned"
 * moment, not a duplicate of that feedback.
 *
 * useStatsArena has its own 2-min staleTime (it deliberately sits outside
 * AppShell's auto-sync — see useStatsArena.ts), so a win can land before the
 * Arena's cached `streak` value reflects it. invalidateQueries nudges a
 * refetch; the render itself stays keyed off whatever `streak` prop the
 * caller currently has, with the NumberFlow "replay" only firing when that
 * value has genuinely moved past the last-seen watermark.
 */
export function CelebrationManager({ streak, cardRef, children }: CelebrationManagerProps) {
  const { hasNew, markAsSeen } = useNewPointsAlert();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();

  const [celebrating, setCelebrating] = useState(false);
  const [displayStreak, setDisplayStreak] = useState(streak);
  const [ringRect, setRingRect] = useState<DOMRect | null>(null);
  const firedRef = useRef(false);

  // Stay in sync with real data whenever we're not mid-celebration.
  useEffect(() => {
    if (!celebrating) setDisplayStreak(streak);
  }, [streak, celebrating]);

  useEffect(() => {
    if (!hasNew || firedRef.current) return;
    firedRef.current = true;

    // Best-effort freshness nudge — doesn't block the sequence below.
    queryClient.invalidateQueries({ queryKey: ['statsArena'] });

    const lastSeenStreak = getLastSeenStreak();
    const streakChanged = streak > lastSeenStreak;

    setCelebrating(true);
    if (cardRef.current) setRingRect(cardRef.current.getBoundingClientRect());
    if (streakChanged) setDisplayStreak(lastSeenStreak); // hold the old value for the replay roll

    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => {
      celebrateAt(cardRef.current);
      if (streakChanged) setDisplayStreak(streak); // NumberFlow rolls up in sync with the burst
    }, RING_DELAY_MS));

    timers.push(setTimeout(() => {
      setCelebrating(false);
      setRingRect(null);
      setLastSeenStreak(streak);
      markAsSeen();
      firedRef.current = false;
    }, TOTAL_DURATION_MS));

    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNew]);

  return (
    <>
      {children(displayStreak)}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {celebrating && ringRect && !reduceMotion && (
            <>
              {/* Spotlight dim — a single oversized box-shadow leaves the
                  card's own rect untouched while dimming+blurring everything
                  else in the viewport, so the other Bento cards visually
                  recede without needing per-card React state. */}
              <motion.div
                key="celebration-spotlight"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="fixed z-[45] pointer-events-none rounded-2xl"
                style={{
                  left: ringRect.left, top: ringRect.top,
                  width: ringRect.width, height: ringRect.height,
                  boxShadow: '0 0 0 9999px rgba(4,8,16,0.6)',
                  backdropFilter: 'blur(2px)',
                  WebkitBackdropFilter: 'blur(2px)',
                }}
              />
              {/* Pulse ring on the streak card itself */}
              <motion.div
                key="celebration-ring"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: [0, 0.9, 0], scale: [0.9, 1.12, 1.28] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
                className="fixed z-[46] pointer-events-none rounded-2xl"
                style={{
                  left: ringRect.left, top: ringRect.top,
                  width: ringRect.width, height: ringRect.height,
                  boxShadow: '0 0 0 2px var(--arena-glow), 0 0 40px 10px var(--arena-glow)',
                }}
              />
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
