import { cn } from '../../lib/utils';

interface StreakBadgeProps {
  streak: number;
  className?: string;
}

export function StreakBadge({ streak, className }: StreakBadgeProps) {
  if (streak < 1) return null;

  // Streak cycles: 0→1→2→bonus+reset. Max normal value is 2.
  // streak=1: building (grey), streak=2: one more for bonus (yellow)
  const isClose = streak === 2;
  const isHigh = streak >= 3; // edge case / old data

  const tip = isHigh
    ? `${streak} correct in a row · bonus active!`
    : isClose
      ? `${streak}/3 correct in a row · next correct = +2 pts bonus!`
      : `${streak}/3 correct in a row · keep going for a bonus`;

  return (
    <span
      title={tip}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold cursor-help',
        isHigh && 'bg-accent-orange/20 text-accent-orange border border-accent-orange/30',
        !isHigh && isClose && 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
        !isHigh && !isClose && 'bg-white/8 text-text-muted border border-white/10',
        className
      )}
    >
      {isHigh ? '🔥' : isClose ? '⚡' : '↑'} {streak}
    </span>
  );
}
