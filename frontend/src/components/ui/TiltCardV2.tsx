import { useRef, useCallback, type ReactNode } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { cn } from '../../lib/utils';

interface TiltCardV2Props {
  children: ReactNode;
  className?: string;
  /** Max rotation in degrees (default 6) */
  maxRotate?: number;
  /** Unused — kept for API compatibility */
  glareColor?: string;
  /** Disable tilt (e.g. on touch devices) */
  disabled?: boolean;
}

// ─── TiltCardV2 ──────────────────────────────────────────────────────────────
// Generic 3D tilt wrapper. Drop any content inside.
// Mouse position drives rotateX/rotateY via spring physics (no bounce).
// ─────────────────────────────────────────────────────────────────────────────
export function TiltCardV2({
  children,
  className,
  maxRotate = 3,
  disabled = false,
}: TiltCardV2Props) {
  const ref = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rawRotateX = useTransform(mouseY, [-0.5, 0.5], [maxRotate, -maxRotate]);
  const rawRotateY = useTransform(mouseX, [-0.5, 0.5], [-maxRotate, maxRotate]);

  const rotateX = useSpring(rawRotateX, { stiffness: 380, damping: 38, mass: 0.4 });
  const rotateY = useSpring(rawRotateY, { stiffness: 380, damping: 38, mass: 0.4 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      mouseX.set((e.clientX - rect.left) / rect.width  - 0.5);
      mouseY.set((e.clientY - rect.top)  / rect.height - 0.5);
    },
    [disabled, mouseX, mouseY],
  );

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={ref}
      style={{ perspective: '900px' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn('will-change-transform', className)}
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className="relative w-full h-full"
      >
        {children}
      </motion.div>
    </div>
  );
}
