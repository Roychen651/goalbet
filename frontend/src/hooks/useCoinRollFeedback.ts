import { useEffect, useRef } from 'react';
import { haptic } from '../lib/haptics';

// Sprint 17 — the "cascading roll" haptic, synced to the coin NumberFlow's
// known transformTiming duration (600ms, TopBar.tsx/Sidebar.tsx) rather than
// one single pulse at the instant the value changes. A handful of short
// sub-pulses spread across the same window the digits are visibly rolling
// reads as one continuous tactile "whir," not a series of separate taps.
//
// Deliberately does not play a sound here — App.tsx's coin-deposit
// coalescing handler already fires coin_chime once per deposit event; this
// hook only adds the tactile layer tied to the NumberFlow animation itself,
// so a real deposit gets exactly one chime plus one cascading roll, not two
// overlapping sounds.
const ROLL_DURATION_MS = 600;
const PULSE_COUNT = 4;

export function useCoinRollFeedback(coins: number): void {
  const prevRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = coins;
    if (prev === null) return; // skip the initial mount — not a "roll"
    if (coins <= prev) return; // only increases get the celebratory roll

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < PULSE_COUNT; i++) {
      timers.push(setTimeout(() => haptic('coin_roll'), (ROLL_DURATION_MS / PULSE_COUNT) * i));
    }
    return () => timers.forEach(clearTimeout);
  }, [coins]);
}
