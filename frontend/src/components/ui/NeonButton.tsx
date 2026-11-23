import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

// Omits the gesture/animation handlers whose React DOM signature clashes with
// Framer Motion's own (onAnimationStart, onDrag*) — motion.button below only
// needs the plain button attributes (onClick, disabled, type, etc.).
interface NeonButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDragStart' | 'onDragEnd' | 'onDrag'> {
  variant?: 'green' | 'orange' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export function NeonButton({
  variant = 'green',
  size = 'md',
  loading = false,
  children,
  className,
  disabled,
  ...props
}: NeonButtonProps) {
  return (
    <motion.button
      whileTap={disabled || loading ? undefined : { scale: 0.95, rotate: -0.5, transition: { type: 'spring', stiffness: 500, damping: 15 } }}
      disabled={disabled || loading}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 font-dm font-semibold rounded-xl',
        'transition-all duration-200 select-none',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
        // Sizes
        size === 'sm' && 'px-3 py-1.5 text-sm',
        size === 'md' && 'px-5 py-2.5 text-sm',
        size === 'lg' && 'px-7 py-3.5 text-base',
        // Variants
        // Full-app audit, Nov 2026 — "Unified Button & Icon System": glow
        // intensity halved (0.5 -> 0.25 alpha, 25px -> 16px) to match the
        // orange variant's already-modest --glow-orange token below,
        // instead of this one variant alone carrying a visibly hotter
        // glow than every other primary button in the app.
        //
        // Visual polish round 2 (live QA report) — this was a flat
        // solid-fill + glow button sitting next to PredictionForm's own
        // debossed/embossed tier chips, which already have real shadow-
        // layering depth. Reuses that exact TECHNIQUE (an inset top
        // rim-light at idle, a deeper layered emboss — rim-light + outward
        // colored glow — on hover/active) with each variant's OWN color,
        // never the unrelated 5-tier OKLCH hues from lib/tierVisuals.ts —
        // same shadow-layering idea, not a cross-family color reuse.
        variant === 'green' && [
          'shadow-[inset_0_1.5px_0_rgba(255,255,255,0.35),inset_0_-2px_4px_rgba(0,0,0,0.18)]',
          'bg-accent-green text-bg-base',
          'hover:brightness-110 hover:scale-[1.02]',
          'hover:shadow-[inset_0_1.5px_0_rgba(255,255,255,0.45),inset_0_-2px_4px_rgba(0,0,0,0.15),0_6px_20px_-4px_rgba(var(--color-live-glow-rgb),0.45)]',
          'active:scale-[0.98] active:brightness-95',
        ],
        variant === 'orange' && [
          'shadow-[inset_0_1.5px_0_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(0,0,0,0.22)]',
          'bg-accent-orange text-white',
          'hover:scale-[1.02] hover:shadow-[inset_0_1.5px_0_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.18),0_6px_20px_-4px_rgba(var(--color-accent-orange-rgb),0.5)]',
          'active:scale-[0.98] active:brightness-95',
        ],
        variant === 'ghost' && [
          'shadow-[inset_0_2px_5px_rgba(0,0,0,0.3),inset_0_-1px_0_rgba(255,255,255,0.05)]',
          'bg-transparent btn-ghost-text text-white border border-[rgba(255,255,255,0.15)]',
          'hover:bg-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.25)]',
          'hover:shadow-[inset_0_1.5px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(255,255,255,0.05)]',
          'active:scale-[0.98] active:brightness-95',
          'transition-all duration-200',
        ],
        variant === 'danger' && [
          'shadow-[inset_0_1.5px_0_rgba(255,255,255,0.08),inset_0_-2px_4px_rgba(0,0,0,0.2)]',
          'bg-red-500/20 text-red-400 border border-red-500/30',
          'hover:bg-red-500/30 hover:shadow-[inset_0_1.5px_0_rgba(255,255,255,0.12),inset_0_-2px_4px_rgba(0,0,0,0.15),0_6px_16px_-4px_rgba(239,68,68,0.35)]',
          'active:scale-[0.98] active:brightness-95',
        ],
        className
      )}
      {...props}
    >
      {loading ? (
        <>
          <Spinner />
          <span className="opacity-70">{children}</span>
        </>
      ) : children}
    </motion.button>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="20" />
    </svg>
  );
}
