import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

/**
 * MatchCardSkeleton — premium loading placeholder shaped like a MatchCard.
 *
 * Used during the Render cold-start window (up to ~60s) so the app feels alive
 * instead of showing a bare spinner. Two coordinated Framer Motion effects:
 *   1. A soft breathing pulse on the whole card (opacity + subtle scale).
 *   2. A diagonal shimmer sweep travelling across the surface — mirrors the
 *      MatchCard hover shimmer so the loading state reads as "the real card,
 *      not yet filled in".
 *
 * Theme-aware: uses white/opacity utility classes (which have html.light
 * navy overrides in index.css) and CSS-var backed borders — never hardcoded hex.
 */

const shimmer = {
  animate: {
    x: ['-120%', '220%'],
    transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' as const },
  },
};

function Bar({ className }: { className?: string }) {
  return <div className={cn('rounded-md bg-white/[0.09]', className)} />;
}

export function MatchCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: [0.55, 0.9, 0.55], y: 0 }}
      transition={{
        opacity: { duration: 2.1, repeat: Infinity, ease: 'easeInOut' as const, delay: index * 0.12 },
        y: { duration: 0.3, ease: 'easeOut' as const, delay: Math.min(index * 0.05, 0.25) },
      }}
      className={cn(
        'relative overflow-hidden rounded-2xl border card-base',
        'backdrop-blur-glass p-4',
      )}
      aria-hidden
    >
      {/* Diagonal shimmer sweep */}
      <motion.div
        variants={shimmer}
        animate="animate"
        className="pointer-events-none absolute inset-y-0 -inset-x-1/4 w-1/3 -skew-x-12"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)',
        }}
      />

      {/* Header: league label + status pill */}
      <div className="relative flex items-center justify-between mb-4">
        <Bar className="h-3 w-28" />
        <div className="h-5 w-16 rounded-full bg-white/[0.07]" />
      </div>

      {/* Teams + score */}
      <div className="relative flex items-center gap-3">
        {/* Home */}
        <div className="flex flex-1 flex-col items-center gap-2">
          <div className="h-11 w-11 rounded-full bg-white/[0.10]" />
          <Bar className="h-3 w-20" />
        </div>

        {/* Score */}
        <div className="flex shrink-0 flex-col items-center gap-1.5 px-2">
          <div className="h-7 w-16 rounded-lg bg-white/[0.08]" />
          <Bar className="h-2.5 w-10 bg-white/[0.06]" />
        </div>

        {/* Away */}
        <div className="flex flex-1 flex-col items-center gap-2">
          <div className="h-11 w-11 rounded-full bg-white/[0.10]" />
          <Bar className="h-3 w-20" />
        </div>
      </div>

      {/* Footer: predict CTA placeholder */}
      <div className="relative mt-4 flex items-center justify-center">
        <div className="h-8 w-40 rounded-full bg-white/[0.06]" />
      </div>
    </motion.div>
  );
}

/** Renders `count` staggered skeleton cards. */
export function MatchCardSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: count }, (_, i) => (
        <MatchCardSkeleton key={i} index={i} />
      ))}
    </div>
  );
}
