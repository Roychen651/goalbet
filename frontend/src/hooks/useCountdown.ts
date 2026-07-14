import { useState, useEffect } from 'react';

/**
 * Ticks every second and returns whole seconds remaining until `expiresAt`
 * (never negative). Same isolated-render shape as useLiveClock — local state,
 * own interval — so a countdown re-renders only the component that calls it,
 * never a parent list (MomentumBanner sits inside LockerRoomPage, which also
 * renders the full ActivityFeed; this must not touch that tree on every tick).
 */
export function useCountdown(expiresAt: string | null): number {
  const [remaining, setRemaining] = useState(() => secondsUntil(expiresAt));

  useEffect(() => {
    setRemaining(secondsUntil(expiresAt));
    if (!expiresAt) return;
    const id = setInterval(() => setRemaining(secondsUntil(expiresAt)), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return remaining;
}

function secondsUntil(expiresAt: string | null): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
}
