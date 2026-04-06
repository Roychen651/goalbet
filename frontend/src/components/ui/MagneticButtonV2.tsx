import { useRef, useCallback, type ReactNode } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
} from 'framer-motion';
import { cn } from '../../lib/utils';

interface MagneticButtonV2Props {
  children: ReactNode;
  className?: string;
  /** Magnetic pull strength 0–1 (default 0.35) */
  strength?: number;
  /** Radius in px that triggers magnetic pull (default 80) */
  radius?: number;
  variant?: 'volt' | 'ghost' | 'purple';
  size?: 'sm' | 'md' | 'lg';
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

// ─── MagneticButtonV2 ────────────────────────────────────────────────────────
// When the cursor enters the radius, the button pulls slightly toward it.
// On hover the button glows with the volt accent.
// Text on volt variant is deep black (#09090b) for maximum contrast.
// ─────────────────────────────────────────────────────────────────────────────
export function MagneticButtonV2({
  children,
  className,
  strength = 0.35,
  radius = 80,
  variant = 'volt',
  size = 'md',
  onClick,
  disabled = false,
  type = 'button',
}: MagneticButtonV2Props) {
  const ref = useRef<HTMLButtonElement>(null);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 350, damping: 28, mass: 0.5 });
  const y = useSpring(rawY, { stiffness: 350, damping: 28, mass: 0.5 });

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!ref.current || disabled) return;
      const rect = ref.current.getBoundingClientRect();
      const cx = rect.left + rect.width  / 2;
      const cy = rect.top  + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius) {
        rawX.set(dx * strength);
        rawY.set(dy * strength);
      } else {
        rawX.set(0);
        rawY.set(0);
      }
    },
    [disabled, radius, strength, rawX, rawY],
  );

  const handleMouseLeave = useCallback(() => {
    rawX.set(0);
    rawY.set(0);
  }, [rawX, rawY]);

  // Attach to window so the magnetic effect works before cursor is directly over the button
  const attachListeners = useCallback(() => {
    window.addEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  const detachListeners = useCallback(() => {
    window.removeEventListener('mousemove', handleMouseMove);
    handleMouseLeave();
  }, [handleMouseMove, handleMouseLeave]);

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      style={{ x, y }}
      onMouseEnter={attachListeners}
      onMouseLeave={detachListeners}
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      className={cn(
        'relative inline-flex items-center justify-center gap-2',
        'font-sans font-semibold rounded-xl select-none',
        'transition-shadow duration-200',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
        // Size
        size === 'sm' && 'px-4 py-2 text-sm',
        size === 'md' && 'px-6 py-3 text-sm',
        size === 'lg' && 'px-8 py-4 text-base',
        // Variants — uses CSS tokens so they adapt to dark/light mode
        variant === 'volt' && [
          'bg-accent-green text-bg-base',
          'hover:shadow-[0_0_32px_rgba(189,232,245,0.45),0_0_64px_rgba(189,232,245,0.15)]',
          'hover:brightness-105',
        ],
        variant === 'ghost' && [
          'bg-transparent text-text-primary border border-border-subtle',
          'hover:bg-white/5 hover:border-border-bright',
          'hover:shadow-[0_0_20px_rgba(189,232,245,0.08)]',
        ],
        variant === 'purple' && [
          'bg-[rgba(73,136,196,0.20)] text-accent-green border border-[rgba(73,136,196,0.30)]',
          'hover:bg-[rgba(73,136,196,0.30)]',
          'hover:shadow-[0_0_32px_rgba(73,136,196,0.35)]',
        ],
        className,
      )}
    >
      {children}
    </motion.button>
  );
}
