import { useEffect, useRef, type RefObject } from 'react';

interface TactileTiltOptions {
  /** Master on/off — false means zero listeners attached, not a smaller effect. */
  enabled?: boolean;
  /** Max rotation in degrees on each axis. */
  max?: number;
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
 * effect, genuinely nothing.
 */
export function useTactileTilt<T extends HTMLElement = HTMLDivElement>(
  options: TactileTiltOptions = {},
): RefObject<T> {
  const { enabled = true, max = 8 } = options;
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!canHover || reduceMotion) return;

    let rect: DOMRect | null = null;
    let rafId = 0;
    let lastEvent: PointerEvent | null = null;

    const write = () => {
      rafId = 0;
      if (!lastEvent || !rect) return;
      const px = Math.min(1, Math.max(0, (lastEvent.clientX - rect.left) / rect.width));
      const py = Math.min(1, Math.max(0, (lastEvent.clientY - rect.top) / rect.height));
      const rotateY = (px - 0.5) * max * 2;
      const rotateX = (0.5 - py) * max * 2;
      el.style.setProperty('--tilt-x', `${rotateX.toFixed(2)}deg`);
      el.style.setProperty('--tilt-y', `${rotateY.toFixed(2)}deg`);
      el.style.setProperty('--glare-x', `${(px * 100).toFixed(1)}%`);
      el.style.setProperty('--glare-y', `${(py * 100).toFixed(1)}%`);
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
      if (!rafId) rafId = requestAnimationFrame(write);
    };

    const onLeave = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      // Never left permanently on — a grid of always-will-change cards is a
      // real compositing/memory cost most tilt-effect integrations get wrong.
      el.style.willChange = 'auto';
      el.style.setProperty('--tilt-x', '0deg');
      el.style.setProperty('--tilt-y', '0deg');
      el.style.setProperty('--glare-x', '50%');
      el.style.setProperty('--glare-y', '50%');
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
  }, [enabled, max]);

  return ref;
}
