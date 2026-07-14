// Tactile feedback wrapper around the Vibration API. No-op on devices/browsers
// that don't support it (desktop, iOS Safari) — always safe to call.
type Pattern =
  | 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'coin_drop'
  | 'toggle_click' | 'bet_lock' | 'coin_roll';

const PATTERNS: Record<Pattern, number | number[]> = {
  selection: 5,            // ultra-brief tick — a crisp mechanical switch, not a buzz
  light: 8,
  medium: 15,
  heavy: 30,
  success: [12, 40, 18],   // tap-pause-tap — a satisfying "done" cadence
  error: [30, 30, 30],
  coin_drop: [8, 30, 8, 30], // light double-tap — receiving coins
  // Sprint 17 — paired with lib/sensoryAudio.ts's synthesized SFX of the
  // same names (bet_lock/coin_roll match the audio side 1:1; toggle_click
  // pairs with the audio manager's same-named tone).
  toggle_click: [6, 20, 6], // soft double-tick — a settings/nav toggle
  bet_lock: [10, 15, 25],   // crisp mechanical snap, sharper attack than 'medium'
  coin_roll: 4,             // one sub-pulse — fired repeatedly across a NumberFlow roll, never a single long buzz
};

export function haptic(pattern: Pattern = 'light'): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(PATTERNS[pattern]);
    }
  } catch {
    // ignore — vibration is a nice-to-have, never critical
  }
}
