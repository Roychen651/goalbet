// Tactile feedback wrapper around the Vibration API. No-op on devices/browsers
// that don't support it (desktop, iOS Safari) — always safe to call.
type Pattern = 'light' | 'medium' | 'heavy' | 'success' | 'error';

const PATTERNS: Record<Pattern, number | number[]> = {
  light: 8,
  medium: 15,
  heavy: 30,
  success: [12, 40, 18],   // tap-pause-tap — a satisfying "done" cadence
  error: [30, 30, 30],
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
