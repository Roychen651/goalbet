import { useState, useEffect } from 'react';

/**
 * Ticks every `intervalMs` milliseconds, causing the consuming component to
 * re-render so countdown displays stay accurate without refetching any data.
 * Safe to use inside expanded prediction forms — it only re-renders the component
 * that calls it, preserving all child state (PredictionForm inputs, etc.).
 */
export function useLiveClock(intervalMs = 30_000): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
