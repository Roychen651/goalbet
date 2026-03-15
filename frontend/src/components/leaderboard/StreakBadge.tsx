import { cn } from '../../lib/utils';

interface StreakBadgeProps {
  streak: number;
  className?: string;
}

export function StreakBadge({ streak, className }: StreakBadgeProps) {
  if (streak < 2) return null;

  const isHot = streak >= 5;
  const isFire = streak >= 3;

  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
      isHot && 'bg-accent-orange/20 text-accent-orange border border-accent-orange/30',
      !isHot && isFire && 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
      !isFire && 'bg-white/10 text-text-muted border border-white/10',
      className
    )}>
      {isHot ? '🔥' : isFire ? '⚡' : '↑'} {streak}
    </span>
  );
}
