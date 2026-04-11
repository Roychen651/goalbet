import { LeaderboardEntryWithProfile } from '../../lib/supabase';
import { Avatar } from '../ui/Avatar';
import { cn } from '../../lib/utils';
import { useLangStore } from '../../stores/langStore';
import type { PeriodStat } from '../../pages/LeaderboardPage';

interface LeaderboardRowProps {
  entry: LeaderboardEntryWithProfile;
  isCurrentUser: boolean;
  type: 'total' | 'weekly' | 'lastWeek';
  /** Period-filtered stats for this user. null on 'total' tab or when missing. */
  periodStat?: PeriodStat | null;
  onClick?: () => void;
}

const PODIUM_STYLES: Record<number, { ring: string; shadow: string; avatarSize: 'md' | 'lg' | 'xl'; bg: string }> = {
  1: { ring: 'ring-2 ring-amber-400/70', shadow: 'drop-shadow-[0_0_14px_rgba(232,160,32,0.35)]', avatarSize: 'xl', bg: 'bg-amber-500/5' },
  2: { ring: 'ring-2 ring-slate-300/60', shadow: 'drop-shadow-[0_0_10px_rgba(200,200,200,0.25)]', avatarSize: 'lg', bg: 'bg-white/5' },
  3: { ring: 'ring-2 ring-amber-700/60', shadow: 'drop-shadow-[0_0_8px_rgba(180,100,50,0.25)]', avatarSize: 'lg', bg: 'bg-orange-900/10' },
};

export function LeaderboardRow({ entry, isCurrentUser, type, periodStat, onClick }: LeaderboardRowProps) {
  const { t } = useLangStore();
  const points = type === 'weekly' ? entry.weekly_points
    : type === 'lastWeek' ? (entry.last_week_points ?? 0)
    : entry.total_points;
  // Picks / accuracy: use the period-filtered stats when on weekly/lastWeek so the
  // subtitle row ("33 picks · 45% accurate") matches the KPI card and the Sniper insight.
  const periodActive = type !== 'total';
  const picksMade = periodActive ? (periodStat?.made ?? 0) : entry.predictions_made;
  const picksCorrect = periodActive ? (periodStat?.correct ?? 0) : entry.correct_predictions;
  const accuracy = picksMade > 0
    ? Math.round((picksCorrect / picksMade) * 100)
    : 0;
  const podium = PODIUM_STYLES[entry.rank];

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 py-3 transition-all duration-200 border-b border-white/5 last:border-b-0',
        onClick && 'cursor-pointer',
        isCurrentUser
          ? 'bg-accent-green/8'
          : podium ? podium.bg : 'hover:bg-white/4',
      )}
    >
      <div className="w-7 text-center shrink-0">
        {entry.rank === 1 ? (
          <span className="text-lg">🥇</span>
        ) : entry.rank === 2 ? (
          <span className="text-lg">🥈</span>
        ) : entry.rank === 3 ? (
          <span className="text-lg">🥉</span>
        ) : (
          <span className="text-text-muted text-sm font-semibold tabular-nums">{entry.rank}</span>
        )}
      </div>

      <Avatar
        src={entry.avatar_url}
        name={entry.username}
        size={podium ? podium.avatarSize : 'md'}
        className={cn(podium?.ring, podium?.shadow)}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn('font-semibold text-sm truncate', isCurrentUser ? 'text-accent-green' : 'text-white')}>
            {entry.username}{isCurrentUser && ` (${t('you')})`}
          </span>
          {entry.weekly_points > 15 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-accent-orange/10 text-accent-orange border border-accent-orange/20 leading-none whitespace-nowrap">
              {t('badgeHot')} 🔥
            </span>
          )}
          {accuracy >= 65 && picksMade >= 5 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-accent-green/10 text-accent-green border border-accent-green/20 leading-none whitespace-nowrap">
              {t('badgeSniper')} 🎯
            </span>
          )}
        </div>
        <div className="text-text-muted text-xs mt-0.5">
          {picksMade} {t('picks')} · {picksMade > 0 ? `${accuracy}%` : '—'} {t('accurate')}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <div className="text-end min-w-[56px]">
          {(entry.live_points ?? 0) > 0 ? (
            <>
              {/* Confirmed pts + live potential, clearly labelled */}
              <div className="flex items-baseline gap-1 justify-end">
                <span className={cn('font-bebas tracking-wider text-xl', entry.rank === 1 ? 'text-accent-green text-glow-green' : 'text-white')}>
                  {points}
                </span>
                <span className="text-blue-400 font-bebas text-base">+{entry.live_points}</span>
              </div>
              <div className="flex items-center gap-1 justify-end mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 animate-pulse" />
                <span className="text-blue-400 text-[10px] font-medium">{entry.live_points} {t('ptsLiveLabel')}</span>
              </div>
            </>
          ) : (
            <>
              <div className={cn('font-bebas tracking-wider text-xl', entry.rank === 1 ? 'text-accent-green text-glow-green' : 'text-white')}>
                {points}
              </div>
              <div className="text-text-muted text-xs">{points} {t('pts')}</div>
            </>
          )}
        </div>
        {onClick && <span className="text-white/20 text-xs">›</span>}
      </div>
    </div>
  );
}
