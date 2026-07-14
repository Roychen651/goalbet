import confetti from 'canvas-confetti';

// Brand-themed confetti bursts. Colours pull from the "Cold Sea Navy" accents
// so celebrations feel part of the design, not a generic party popper.
const COLORS = ['#BDE8F5', '#4988C4', '#FF3366', '#FFC94A', '#FFFFFF'];

// A tasteful two-sided burst — used when a prediction is locked in.
export function celebratePrediction(): void {
  const base: confetti.Options = {
    spread: 70,
    startVelocity: 45,
    ticks: 200,
    gravity: 0.9,
    scalar: 0.9,
    colors: COLORS,
    disableForReducedMotion: true,
  };
  confetti({ ...base, particleCount: 45, angle: 60, origin: { x: 0, y: 0.9 } });
  confetti({ ...base, particleCount: 45, angle: 120, origin: { x: 1, y: 0.9 } });
}

// Sprint 18 — a card-scoped burst for the Bento Arena's focused celebration
// orchestrator. Reuses the same canvas-confetti engine as celebratePrediction/
// celebrateWin (already a dependency — no new particle engine needed). The
// origin is derived from the target element's own bounding rect converted to
// viewport-fraction coordinates, so the burst visually originates from that
// specific card instead of the screen edges.
export function celebrateAt(el: HTMLElement | null): void {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const originX = (rect.left + rect.width / 2) / window.innerWidth;
  const originY = (rect.top + rect.height / 2) / window.innerHeight;
  confetti({
    particleCount: 60,
    spread: 80,
    startVelocity: 32,
    gravity: 1,
    scalar: 0.85,
    ticks: 180,
    colors: COLORS,
    origin: { x: originX, y: originY },
    disableForReducedMotion: true,
  });
}

// A bigger, raining celebration — reserved for wins (perfect picks, coins won).
export function celebrateWin(): void {
  const end = Date.now() + 900;
  const frame = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 60,
      startVelocity: 55,
      origin: { x: 0, y: 0.7 },
      colors: COLORS,
      disableForReducedMotion: true,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 60,
      startVelocity: 55,
      origin: { x: 1, y: 0.7 },
      colors: COLORS,
      disableForReducedMotion: true,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}
