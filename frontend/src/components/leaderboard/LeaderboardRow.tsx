import { LeaderboardEntryWithProfile } from '../../lib/supabase';
import { Avatar } from '../ui/Avatar';
import { StreakBadge } from './StreakBadge';
import { cn, formatPoints } from '../../lib/utils';
import { useLangStore } from '../../stores/langStore';

interface LeaderboardRowProps {
  entry: LeaderboardEntryWithProfile;
  isCurrentUser: boolean;
  type: 'total' | 'weekly';
  onClick?: () => void;
}

const RANK_MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function LeaderboardRow({ entry, isCurrentUser, type, onClick }: LeaderboardRowProps) {
  const { t } = useLangStore();
  const points = type === 'weekly' ? entry.weekly_points : entry.total_points;
  const medal = RANK_MEDALS[entry.rank];

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl transition-all duration-200',
        onClick && 'cursor-pointer',
        isCurrentUser
          ? 'bg-accent-green/8 border border-accent-green/20'
          : 'hover:bg-white/5 border border-transparent',
        entry.rank <= 3 && !isCurrentUser && 'bg-white/3',
      )}
    >
      <div className="w-7 text-center shrink-0">
        {medal ? (
          <span className="text-lg">{medal}</span>
        ) : (
          <span className="text-text-muted text-sm font-semibold tabular-nums">{entry.rank}</span>
        )}
      </div>

      <Avatar src={entry.avatar_url} name={entry.username} size="md" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('font-semibold text-sm truncate', isCurrentUser ? 'text-accent-green' : 'text-white')}>
            {entry.username}{isCurrentUser && ' (you)'}
          </span>
          <StreakBadge streak={entry.current_streak} />
        </div>
        <div className="text-text-muted text-xs mt-0.5">
          {entry.predictions_made} {t('picks')} · {entry.predictions_made > 0 ? `${Math.round((entry.correct_predictions / entry.predictions_made) * 100)}%` : '—'} {t('accurate')}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <div className="text-end">
          <div className={cn('font-bebas tracking-wider text-xl', entry.rank === 1 ? 'text-accent-green text-glow-green' : 'text-white')}>
            {points}
          </div>
          <div className="text-text-muted text-xs">{formatPoints(points)}</div>
        </div>
        {onClick && <span className="text-white/20 text-xs">›</span>}
      </div>
    </div>
  );
}
