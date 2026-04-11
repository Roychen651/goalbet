import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame, Target, Activity } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { Avatar } from '../ui/Avatar';
import { useLangStore } from '../../stores/langStore';
import { cn } from '../../lib/utils';
import type { LeaderboardEntryWithProfile } from '../../lib/supabase';
import type { PeriodStatsMap } from '../../pages/LeaderboardPage';

type PeriodType = 'total' | 'weekly' | 'lastWeek';

interface LeaderboardInsightsProps {
  entries: LeaderboardEntryWithProfile[];
  type: PeriodType;
  /** Period-filtered stats per user_id. null on the 'total' tab. */
  periodStatsMap?: PeriodStatsMap | null;
}

interface Insight {
  key: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  user: LeaderboardEntryWithProfile | null;
  stat: string;
  accentClass: string;
  iconBg: string;
}

/** Get the correct points value for a given period */
function getPoints(e: LeaderboardEntryWithProfile, type: PeriodType): number {
  if (type === 'weekly') return e.weekly_points;
  if (type === 'lastWeek') return e.last_week_points ?? 0;
  return e.total_points;
}

export function LeaderboardInsights({ entries, type, periodStatsMap }: LeaderboardInsightsProps) {
  const { t } = useLangStore();

  const insights = useMemo<Insight[]>(() => {
    // Helpers that return the correct stats for the active period.
    // On 'total' we use the cached leaderboard row; on weekly/lastWeek we use the
    // period-filtered map so on-fire, Sniper, and Grinder reflect the same window as
    // the KPI card and the leaderboard rows.
    const periodActive = type !== 'total' && periodStatsMap != null;
    const ptsOf = (e: LeaderboardEntryWithProfile) =>
      periodActive ? (periodStatsMap!.get(e.user_id)?.pts ?? 0) : getPoints(e, type);
    const madeOf = (e: LeaderboardEntryWithProfile) =>
      periodActive ? (periodStatsMap!.get(e.user_id)?.made ?? 0) : e.predictions_made;
    const correctOf = (e: LeaderboardEntryWithProfile) =>
      periodActive ? (periodStatsMap!.get(e.user_id)?.correct ?? 0) : e.correct_predictions;

    // ── On Fire — highest points in the selected period (must be > 0)
    const sorted = [...entries].sort((a, b) => ptsOf(b) - ptsOf(a));
    const onFire = sorted.find(e => ptsOf(e) > 0) ?? null;
    const onFirePts = onFire ? ptsOf(onFire) : 0;

    // Period-aware subtitle for On Fire
    const onFireSub = type === 'weekly'
      ? t('insightOnFireDesc')        // "Player of the Week"
      : type === 'lastWeek'
        ? t('insightOnFireLastWeek')   // "Last Week's Best"
        : t('insightOnFireAllTime');   // "Top Scorer"

    // ── Sniper — highest accuracy in the active period (min 5 predictions)
    const sniper = [...entries]
      .filter(e => madeOf(e) >= 5)
      .sort((a, b) => {
        const accA = correctOf(a) / madeOf(a);
        const accB = correctOf(b) / madeOf(b);
        return accB - accA;
      })[0] ?? null;
    const sniperAcc = sniper
      ? Math.round((correctOf(sniper) / madeOf(sniper)) * 100)
      : 0;

    // ── Grinder — most predictions in the active period
    const grinder = [...entries]
      .sort((a, b) => madeOf(b) - madeOf(a))[0] ?? null;
    const grinderMade = grinder ? madeOf(grinder) : 0;

    return [
      {
        key: 'onfire',
        icon: <Flame className="w-4 h-4" />,
        title: t('insightOnFire'),
        subtitle: onFireSub,
        user: onFire,
        stat: onFire ? `${onFirePts} ${t('pts')}` : '—',
        accentClass: 'text-accent-orange',
        iconBg: 'bg-accent-orange/12 text-accent-orange',
      },
      {
        key: 'sniper',
        icon: <Target className="w-4 h-4" />,
        title: t('insightSniper'),
        subtitle: t('insightSniperDesc'),
        user: sniper,
        stat: sniper ? `${sniperAcc}%` : '—',
        accentClass: 'text-accent-green',
        iconBg: 'bg-accent-green/12 text-accent-green',
      },
      {
        key: 'grinder',
        icon: <Activity className="w-4 h-4" />,
        title: t('insightGrinder'),
        subtitle: t('insightGrinderDesc'),
        user: grinder && grinderMade > 0 ? grinder : null,
        stat: grinder && grinderMade > 0 ? `${grinderMade} ${t('picks')}` : '—',
        accentClass: 'text-blue-400',
        iconBg: 'bg-blue-400/12 text-blue-400',
      },
    ];
  }, [entries, type, t, periodStatsMap]);

  if (insights.every(i => !i.user)) return null;

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {insights.map((insight, i) => (
        <motion.div
          key={insight.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, type: 'spring', stiffness: 260, damping: 24 }}
        >
          <GlassCard className="p-2 sm:p-3.5 h-full">
            {/* Icon + title row */}
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <div className={cn('w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0', insight.iconBg)}>
                {insight.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn('text-[10px] sm:text-xs font-bold uppercase tracking-wider leading-tight', insight.accentClass)}>
                  {insight.title}
                </div>
                <div className="text-[8px] sm:text-[10px] text-text-muted leading-tight mt-0.5 hidden sm:block">
                  {insight.subtitle}
                </div>
              </div>
            </div>

            {insight.user ? (
              <div className="flex items-center gap-1.5 sm:gap-2 mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-white/6">
                <Avatar src={insight.user.avatar_url} name={insight.user.username} size="sm" />
                <div className="flex-1 min-w-0 hidden sm:block">
                  <div className="text-white text-xs font-semibold truncate">{insight.user.username}</div>
                </div>
                <div className={cn('font-bebas text-sm sm:text-lg tracking-wide whitespace-nowrap', insight.accentClass)}>
                  {insight.stat}
                </div>
              </div>
            ) : (
              <div className="mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-white/6 text-text-muted text-[10px]">—</div>
            )}
          </GlassCard>
        </motion.div>
      ))}
    </div>
  );
}
