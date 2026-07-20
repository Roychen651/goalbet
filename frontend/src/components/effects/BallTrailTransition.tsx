// V6 Sprint 43 — "The Kinetic Core": a brief, hardware-accelerated Canvas 2D
// flourish that bridges top-level tab switches (Home/Standings/Stats/Locker
// Room/Profile/Settings — BottomNav.tsx's real 6 nav items, not an arbitrary
// subset). A small ball "kicks" across the viewport leaving a short trail of
// alternating ice-blue/solar-gold particles.
//
// Same module-level-singleton, event-driven-wake shape as CoinsRainCanvas.tsx
// (Sprint 36) and ReactionEngine.tsx (Sprint 39) — not a new pattern. The
// canvas is idle (zero draw calls, zero RAF) whenever no trail is in flight.
//
// Deliberately NOT a general particle system or a physically-simulated kick:
// every particle's position is derived from elapsed time against a fixed
// 250ms duration (progress = elapsed / DURATION_MS), the same
// robust-against-a-dropped-frame shape CLAUDE.md §47 already established for
// MatchMomentumFlow's SVG path interpolation — a stalled frame just "catches
// up" on the next one instead of corrupting accumulated velocity state.
//
// The ball itself is a plain two-tone circle (radial gradient, no texture/
// facets) — at 250ms and ~9px radius, a "real soccer ball" texture would be
// invisible motion blur and wasted render cost. Effort goes where it's
// actually visible, the same restraint this codebase applies to every other
// decorative-vs-substantive tradeoff (sparse honestly-labeled data markers
// over fabricated precision, §34; a computed payout ceiling over a guessed
// number, §51-addendum-3).
//
// Frequency note: this fires on the single highest-frequency interaction in
// the app (every bottom-nav tap). Kept intentionally brief and sparse for
// exactly that reason — see CLAUDE.md §58 for the explicit tradeoff and the
// §47 "Live Pressure Cooker" precedent this sprint is deliberately weighing
// itself against.

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ROUTES } from '../../lib/constants';

const TAB_ROUTES = new Set<string>([
  ROUTES.HOME,
  ROUTES.LEADERBOARD,
  ROUTES.STATS,
  ROUTES.LOCKER_ROOM,
  ROUTES.PROFILE,
  ROUTES.SETTINGS,
]);

let activeInstanceId: symbol | null = null;

const DURATION_MS = 250;
const TRAIL_LENGTH = 10;
const TRAIL_SAMPLE_EVERY_MS = 18; // ~one sample every other 60fps frame
const BALL_RADIUS = 9;

interface TrailPoint {
  x: number;
  y: number;
  t: number; // ms since trail start, for age-based fade
}

/** Fire-and-forget trigger — exported for parity with CoinsRainCanvas's
 *  triggerCoinsRain(), though the primary caller is this file's own
 *  route-change watcher below. */
export function triggerBallTrail(): void {
  window.dispatchEvent(new Event('goalbet:ball-trail'));
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/**
 * Mount exactly once, near the app root (AppShell.tsx), sibling to
 * CoinsRainCanvas — same "one instance for the whole app" placement.
 * Must be mounted inside Router context (it calls useLocation) — AppShell
 * already is (it calls useLocation itself for the page-fade key).
 */
export function BallTrailTransition() {
  const { pathname } = useLocation();
  const hasMountedRef = useRef(false);
  const prevPathnameRef = useRef<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const resizeHandlerRef = useRef<(() => void) | null>(null);
  const instanceId = useRef(Symbol('ball-trail'));

  // ─── Route-change watcher — only real top-level tab switches fire it ────
  useEffect(() => {
    const prev = prevPathnameRef.current;
    const isRealTabSwitch =
      hasMountedRef.current &&
      prev !== null &&
      prev !== pathname &&
      TAB_ROUTES.has(prev) &&
      TAB_ROUTES.has(pathname);

    if (isRealTabSwitch) triggerBallTrail();

    hasMountedRef.current = true;
    prevPathnameRef.current = pathname;
  }, [pathname]);

  // ─── Canvas draw loop ────────────────────────────────────────────────────
  useEffect(() => {
    const start = () => {
      // A moving, trailing particle is exactly the case prefers-reduced-motion
      // exists to suppress — same gate CoinsRainCanvas/celebrate.ts/Sparkline
      // already apply. Reduced-motion users get today's plain 220ms
      // AnimatePresence cross-fade, completely unchanged, with zero canvas
      // work at all — a real bypass, not a slower version of the same thing.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (activeInstanceId !== null) return; // one trail in flight at a time

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

      // Colors resolved live from the already-established tokens — never a
      // hardcoded hex/oklch literal. accent-green is this app's ice-blue;
      // risk-gold is already reused decoratively once (Trophy Cabinet's
      // Century Club badge, §37) — no new OKLCH tokens needed for a trail.
      const styles = getComputedStyle(document.documentElement);
      const colorIce = styles.getPropertyValue('--color-accent-green').trim() || '#BDE8F5';
      const colorGold = styles.getPropertyValue('--risk-gold').trim() || '#E8A020';

      // RTL-aware direction — read the live signal AppShell's own effect
      // already maintains (document.documentElement.dir), never a second
      // isRTL computation. LTR kicks start→end (left→right); RTL mirrors.
      const isRTL = document.documentElement.dir === 'rtl';
      const startX = isRTL ? window.innerWidth + 20 : -20;
      const endX = isRTL ? -20 : window.innerWidth + 20;
      const baseY = Math.max(56, window.innerHeight * 0.14); // just under TopBar
      const arcHeight = 22;

      const trail: TrailPoint[] = [];
      let lastSampleAt = 0;
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
        const rawProgress = Math.min(1, elapsed / DURATION_MS);
        const progress = easeOutQuad(rawProgress);

        const x = startX + (endX - startX) * progress;
        const y = baseY - Math.sin(rawProgress * Math.PI) * arcHeight;

        if (elapsed - lastSampleAt >= TRAIL_SAMPLE_EVERY_MS) {
          trail.push({ x, y, t: elapsed });
          if (trail.length > TRAIL_LENGTH) trail.shift();
          lastSampleAt = elapsed;
        }

        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        // Trail — oldest first so the freshest particle paints on top.
        trail.forEach((p, i) => {
          const age = (elapsed - p.t) / 220; // fades over ~220ms
          const alpha = Math.max(0, 1 - age) * 0.5;
          if (alpha <= 0) return;
          const size = BALL_RADIUS * (0.35 + 0.5 * (i / trail.length));
          ctx.beginPath();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = i % 2 === 0 ? colorIce : colorGold;
          ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
          ctx.fill();
        });

        // The ball — small radial-gradient circle, no facets/texture (see
        // header comment: invisible at this size/speed, not worth the cost).
        ctx.globalAlpha = 1;
        const grad = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, BALL_RADIUS);
        grad.addColorStop(0, '#FFFFFF');
        grad.addColorStop(0.55, colorIce);
        grad.addColorStop(1, colorGold);
        ctx.beginPath();
        ctx.fillStyle = grad;
        ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        if (rawProgress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          stop();
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener('goalbet:ball-trail', start);
    return () => {
      window.removeEventListener('goalbet:ball-trail', start);
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
      // z-[150]: above BottomNav/TopBar dropdowns (40-50) and
      // NotificationCenter's drawer (59-60) so the trail visually crosses
      // the whole viewport including the nav bar; below CoinsRainCanvas's
      // z-[200] so a rare coincidence (navigating mid-payout-celebration)
      // never visually competes with it.
      className="fixed inset-0 pointer-events-none z-[150]"
    />
  );
}
