import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils';

/**
 * FormBars — last-N result predictions as points-per-match bars.
 *
 * Colour encodes outcome (correct FT result = accent-green, miss = red); height
 * encodes magnitude (a perfect +10 towers over a lone +3). Pure flex + Framer
 * Motion grow-in, no chart lib. Accent colour comes from the CSS var behind
 * `bg-accent-green`, so it flips Navy<->Frost automatically.
 */

export interface FormPoint {
  pts: number;
  correct: boolean;
}

interface FormBarsProps {
  series: FormPoint[];
  className?: string;
}

const MIN_H = 14; // floor % so zero-point misses still render a visible nub

export function FormBars({ series, className }: FormBarsProps) {
  const reduce = useReducedMotion();
  const maxPts = Math.max(...series.map(s => s.pts), 1);

  if (series.length === 0) {
    return (
      <div className={cn('flex items-end gap-1 h-10', className)} aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-1 rounded-sm bg-white/8" style={{ height: '35%' }} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flex items-end gap-1 h-10', className)} aria-hidden="true">
      {series.map((s, i) => {
        const h = MIN_H + (s.pts / maxPts) * (100 - MIN_H);
        return (
          <motion.div
            key={i}
            className={cn(
              'flex-1 rounded-sm min-w-[3px]',
              s.correct ? 'bg-accent-green' : 'bg-red-500/60',
            )}
            style={{ height: `${h}%`, transformOrigin: 'bottom' }}
            initial={reduce ? false : { scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{
              type: 'spring',
              stiffness: 260,
              damping: 22,
              delay: reduce ? 0 : 0.3 + i * 0.05,
            }}
          />
        );
      })}
    </div>
  );
}
