import { useEffect, useRef } from 'react';
import { REACTION_SPAWN_EVENT, type ReactionParticle } from '../../hooks/useLiveReactions';

// V5 Sprint 39 — "The Live Lobby" floating-reaction renderer. Structurally
// modeled on CoinsRainCanvas.tsx (event-driven wake, RAF physics computed
// from elapsed time — never accumulated per-frame state, so a dropped
// frame never compounds error — DPR-aware sizing, prefers-reduced-motion
// gate, self-stopping loop) but QUEUE-based rather than a one-shot fixed-
// count burst: both local taps and remote broadcasts push into the SAME
// `queueRef` (owned by useLiveReactions, capped at 15) through the same
// function, so this component has zero awareness of whether a given
// particle originated locally or from another viewer. See CLAUDE.md §53.

const DURATION_MS = 2200;
const FADE_IN_END = 0.15;
const FADE_OUT_START = 0.75;

interface ReactionEngineProps {
  matchId: string;
  queueRef: React.MutableRefObject<ReactionParticle[]>;
}

export function ReactionEngine({ matchId, queueRef }: ReactionEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const resizeHandlerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    resizeHandlerRef.current = resize;
    window.addEventListener('resize', resize);

    const tick = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const now = performance.now();
      const q = queueRef.current;
      // Sweep fully-decayed particles out in place — belt-and-suspenders
      // alongside pushParticle's own 15-cap, and makes long-finished ones
      // disappear promptly instead of lingering until the next push.
      for (let i = q.length - 1; i >= 0; i--) {
        if (now - q[i].spawnedAt > DURATION_MS) q.splice(i, 1);
      }

      if (q.length === 0) {
        runningRef.current = false;
        return; // loop stops itself — woken again by REACTION_SPAWN_EVENT
      }

      for (const p of q) {
        const progress = Math.min((now - p.spawnedAt) / DURATION_MS, 1);

        // Bottom → top linear rise, with a per-particle sine-wave
        // horizontal drift — amplitude/frequency/phase all derived from
        // the particle's own fixed driftSeed, so every particle's path is
        // unique while the formula itself stays deterministic (elapsed-
        // time-driven, not accumulated velocity — robust against a
        // dropped RAF frame, the same shape MatchMomentumFlow's own
        // d-string interpolation already leans on, §47).
        const y = h * (1 - progress);
        const driftAmplitude = 18 + (p.driftSeed % 14);
        const driftFrequency = 1.6 + (p.driftSeed % 10) * 0.08;
        const x = p.x0 * w
          + Math.sin(progress * Math.PI * driftFrequency + p.driftSeed) * driftAmplitude * (1 - progress * 0.3);

        // Quick pop-in over the first ~25% of ascent, gentle shrink over
        // the last ~30% — a single continuous formula, no branches.
        const scale = 0.7 + 0.5 * Math.min(progress * 4, 1) - 0.25 * Math.max(progress - 0.7, 0) / 0.3;

        const opacity = progress < FADE_IN_END
          ? progress / FADE_IN_END
          : progress > FADE_OUT_START
            ? 1 - (progress - FADE_OUT_START) / (1 - FADE_OUT_START)
            : 1;

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.globalAlpha = Math.max(0, opacity);
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Canvas text direction is set explicitly here — never inherited
        // from a DOM ancestor's `dir` — the same "an SVG/Canvas root must
        // pin its own direction" lesson already applied twice in this
        // codebase (§21, §47). A reaction chip may be a short Hebrew
        // phrase ("איזה גול!"), and this is what keeps its glyphs shaping
        // correctly regardless of which language the page itself is in.
        ctx.direction = /[\u0590-\u05FF]/.test(p.chip) ? 'rtl' : 'ltr';
        ctx.fillText(p.chip, 0, 0);
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    const ensureRunning = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail !== matchId) return;
      // Reduced-motion: the ticker line + haptic (useLiveReactions /
      // ReactionChipRow) still fire — only the canvas animation is
      // suppressed, matching every other ambient-motion gate in this
      // codebase (CoinsRainCanvas, Sparkline's useReducedMotion).
      if (reducedMotion) return;
      if (runningRef.current) return;
      runningRef.current = true;
      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener(REACTION_SPAWN_EVENT, ensureRunning);
    return () => {
      window.removeEventListener(REACTION_SPAWN_EVENT, ensureRunning);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (resizeHandlerRef.current) window.removeEventListener('resize', resizeHandlerRef.current);
      runningRef.current = false;
    };
  }, [matchId, queueRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute bottom-0 start-0 end-0 pointer-events-none z-10"
      style={{ height: '240px' }}
    />
  );
}
