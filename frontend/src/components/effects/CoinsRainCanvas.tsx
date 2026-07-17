// V5 Sprint 36 — "The Social Syndicate": a full-viewport falling-coin canvas
// fired the moment a Syndicate Pool actually pays out (ActivityFeed.tsx,
// on a genuinely new WON_COINS event with metadata.is_pool_payout === true).
//
// Deliberately a small, dedicated Canvas 2D particle loop — NOT
// lib/celebrate.ts's existing canvas-confetti wrapper reused. That engine's
// shapes/physics are tuned for a short, single-origin BURST (a card-anchored
// explosion — celebrateAt(), CelebrationManager.tsx, §33); a sustained,
// full-width RAIN of coins drifting down the whole viewport is a genuinely
// different visual grammar canvas-confetti's own particle model doesn't
// express. This is the same "check whether an existing dependency already
// covers the ask" audit CLAUDE.md §33 established for confetti, applied here
// with the opposite, equally honest conclusion — the existing tool doesn't
// fit, so a small new primitive is warranted. It's still zero-dependency:
// the same lazily-drawn `<canvas>` technique Sparkline.tsx/shareCard.ts
// already use, not a new library.
//
// Module-level singleton (mirrors lib/sensoryAudio.ts's single lazily-
// created AudioContext discipline): only one rain may be in flight across
// the whole app at a time. A burst of several pool payouts landing in the
// same tick must never stack N independent full-viewport canvases.

import { useEffect, useRef } from 'react';

let activeInstanceId: symbol | null = null;

interface Coin {
  x: number;
  y: number;
  vy: number;
  vx: number;
  rotation: number;
  vr: number;
  size: number;
  opacity: number;
}

const COIN_COLORS = ['#F5C518', '#C9860A', '#FFD966'];
const COIN_COUNT = 40;
const DURATION_MS = 2600;
const FADE_START_MS = DURATION_MS - 500;

/** Fire-and-forget trigger — any component can call this without holding a ref to the canvas. */
export function triggerCoinsRain(): void {
  window.dispatchEvent(new Event('goalbet:coins-rain'));
}

/**
 * Mount exactly once, near the app root (AppShell.tsx) — same "one instance
 * for the whole app" placement as SyncProgressBar/ToastContainer. Renders an
 * empty, pointer-events-none canvas that only draws while a rain is active.
 */
export function CoinsRainCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const resizeHandlerRef = useRef<(() => void) | null>(null);
  const instanceId = useRef(Symbol('coins-rain'));

  useEffect(() => {
    const start = () => {
      // A sustained rain of falling particles is exactly the animated-motion
      // case prefers-reduced-motion exists to suppress — same gate every
      // other ambient/celebratory animation in this codebase respects
      // (celebrate.ts's disableForReducedMotion, Sparkline's useReducedMotion).
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (activeInstanceId !== null) return; // another rain already in flight — never stack two

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      activeInstanceId = instanceId.current;
      activeRef.current = true;

      const dpr = window.devicePixelRatio || 1;
      const resize = () => {
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      resize();
      resizeHandlerRef.current = resize;
      window.addEventListener('resize', resize);

      const coins: Coin[] = Array.from({ length: COIN_COUNT }, () => ({
        x: Math.random() * window.innerWidth,
        y: -20 - Math.random() * window.innerHeight * 0.5,
        vy: 2.4 + Math.random() * 2.2,
        vx: (Math.random() - 0.5) * 1.2,
        rotation: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.12,
        size: 6 + Math.random() * 6,
        opacity: 1,
      }));

      const startedAt = performance.now();

      const stop = () => {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        activeRef.current = false;
        if (activeInstanceId === instanceId.current) activeInstanceId = null;
        if (resizeHandlerRef.current) {
          window.removeEventListener('resize', resizeHandlerRef.current);
          resizeHandlerRef.current = null;
        }
      };

      const tick = (now: number) => {
        if (!activeRef.current) return;
        const elapsed = now - startedAt;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        let anyVisible = false;
        for (const coin of coins) {
          coin.y += coin.vy;
          coin.x += coin.vx;
          coin.rotation += coin.vr;
          if (elapsed > FADE_START_MS) coin.opacity = Math.max(0, coin.opacity - 0.04);
          if (coin.y < window.innerHeight + 20 && coin.opacity > 0) anyVisible = true;

          ctx.save();
          ctx.translate(coin.x, coin.y);
          ctx.rotate(coin.rotation);
          ctx.globalAlpha = coin.opacity;
          // Squash the vertical scale by |cos(rotation)| — a cheap "coin
          // tumbling edge-on" illusion with zero extra geometry.
          ctx.scale(1, Math.max(0.15, Math.abs(Math.cos(coin.rotation))));
          ctx.beginPath();
          ctx.arc(0, 0, coin.size, 0, Math.PI * 2);
          ctx.fillStyle = COIN_COLORS[Math.floor(Math.abs(coin.x + coin.y)) % COIN_COLORS.length];
          ctx.fill();
          ctx.restore();
        }

        if (elapsed < DURATION_MS && anyVisible) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          stop();
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener('goalbet:coins-rain', start);
    return () => {
      window.removeEventListener('goalbet:coins-rain', start);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (resizeHandlerRef.current) window.removeEventListener('resize', resizeHandlerRef.current);
      if (activeInstanceId === instanceId.current) activeInstanceId = null;
      activeRef.current = false;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-[200]"
    />
  );
}
