import { useEffect, useRef, type RefObject } from 'react';

interface TactileTiltOptions {
  /** Master on/off — false means zero listeners attached, not a smaller effect. */
  enabled?: boolean;
  /** Max rotation in degrees on each axis. */
  max?: number;
  /**
   * Sprint 16 Commit 3 — allow falling back to gyroscope-driven tilt on
   * touch devices when the user has explicitly opted in (useTiltStore) and
   * the browser has already granted DeviceOrientationEvent permission (this
   * hook never itself requests permission — that must happen from a real
   * tap, see TiltModeToggle.tsx / lib/tiltPermission.ts). Default false:
   * most GlassCard tactile usage should stay pointer-only.
   */
  allowGyroscope?: boolean;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Hand-crafted, zero-re-render 3D tilt (Sprint 16). Writes
 * --tilt-x/--tilt-y/--glare-x/--glare-y directly onto the element's style
 * via a ref, bypassing React's setState entirely — a pointermove handler
 * that touched React state would re-render the card (and its children) on
 * every mouse pixel, defeating the point of a 60fps hover effect.
 *
 * Capability-gated once per mount, not per event: (hover: hover) and
 * (pointer: fine) only (a real mouse, not a touchscreen or a coarse
 * pointer), and never when prefers-reduced-motion is set. Devices that fail
 * either check get zero event listeners attached — not a scaled-down
 * effect, genuinely nothing — UNLESS allowGyroscope is set, in which case a
 * non-hover-capable device (a touchscreen) falls back to device-orientation
 * tilt instead of doing nothing.
 */
export function useTactileTilt<T extends HTMLElement = HTMLDivElement>(
  options: TactileTiltOptions = {},
): RefObject<T> {
  const { enabled = true, max = 8, allowGyroscope = false } = options;
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const write = (rotateX: number, rotateY: number, glareX: number, glareY: number) => {
      el.style.setProperty('--tilt-x', `${rotateX.toFixed(2)}deg`);
      el.style.setProperty('--tilt-y', `${rotateY.toFixed(2)}deg`);
      el.style.setProperty('--glare-x', `${glareX.toFixed(1)}%`);
      el.style.setProperty('--glare-y', `${glareY.toFixed(1)}%`);
    };

    const reset = () => {
      el.style.willChange = 'auto';
      write(0, 0, 50, 50);
    };

    if (canHover) {
      let rect: DOMRect | null = null;
      let rafId = 0;
      let lastEvent: PointerEvent | null = null;

      const flush = () => {
        rafId = 0;
        if (!lastEvent || !rect) return;
        const px = clamp((lastEvent.clientX - rect.left) / rect.width, 0, 1);
        const py = clamp((lastEvent.clientY - rect.top) / rect.height, 0, 1);
        write((0.5 - py) * max * 2, (px - 0.5) * max * 2, px * 100, py * 100);
      };

      const onEnter = () => {
        // Measured once per hover session, not on every move — the card's
        // position doesn't change mid-hover, so re-measuring per pixel would
        // be a wasted layout read on every single event.
        rect = el.getBoundingClientRect();
        el.style.willChange = 'transform';
      };
      const onMove = (e: PointerEvent) => {
        lastEvent = e;
        if (!rafId) rafId = requestAnimationFrame(flush);
      };
      const onLeave = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        // Never left permanently on — a grid of always-will-change cards is
        // a real compositing/memory cost most tilt-effect integrations get
        // wrong.
        reset();
      };

      el.addEventListener('pointerenter', onEnter, { passive: true });
      el.addEventListener('pointermove', onMove, { passive: true });
      el.addEventListener('pointerleave', onLeave, { passive: true });

      return () => {
        el.removeEventListener('pointerenter', onEnter);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerleave', onLeave);
        if (rafId) cancelAnimationFrame(rafId);
      };
    }

    if (allowGyroscope && 'DeviceOrientationEvent' in window) {
      let baseline: { beta: number; gamma: number } | null = null;
      let rafId = 0;
      let lastEvent: DeviceOrientationEvent | null = null;

      const flush = () => {
        rafId = 0;
        const e = lastEvent;
        if (!e || e.beta == null || e.gamma == null) return;
        if (!baseline) baseline = { beta: e.beta, gamma: e.gamma };
        const dBeta = clamp(e.beta - baseline.beta, -30, 30);
        const dGamma = clamp(e.gamma - baseline.gamma, -30, 30);
        const rotateX = (dBeta / 30) * max;
        const rotateY = (dGamma / 30) * max;
        // Glare has no natural "cursor position" on a gyroscope — derive one
        // from the same tilt delta so the highlight still moves believably.
        write(rotateX, rotateY, 50 + (rotateY / max) * 50, 50 + (rotateX / max) * 50);
      };

      const onOrientation = (e: DeviceOrientationEvent) => {
        lastEvent = e;
        if (!rafId) rafId = requestAnimationFrame(flush);
      };

      el.style.willChange = 'transform';
      window.addEventListener('deviceorientation', onOrientation, { passive: true });

      return () => {
        window.removeEventListener('deviceorientation', onOrientation);
        if (rafId) cancelAnimationFrame(rafId);
        reset();
      };
    }
  }, [enabled, max, allowGyroscope]);

  return ref;
}
