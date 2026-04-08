import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame, Target, Activity } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { Avatar } from '../ui/Avatar';
import { useLangStore } from '../../stores/langStore';
import { cn } from '../../lib/utils';
import type { LeaderboardEntryWithProfile } from '../../lib/supabase';

interface LeaderboardInsightsProps {
  entries: LeaderboardEntryWithProfile[];
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

export function LeaderboardInsights({ entries }: LeaderboardInsightsProps) {
  const { t } = useLangStore();

  const insights = useMemo<Insight[]>(() => {
    // On Fire — highest weekly_points (must be > 0)
    const onFire = entries
      .filter(e => e.weekly_points > 0)
      .sort((a, b) => b.weekly_points - a.weekly_points)[0] ?? null;

    // Sniper — highest accuracy (min 5 predictions)
    const sniper = entries
      .filter(e => e.predictions_made >= 5)
      .sort((a, b) => {
        const accA = a.correct_predictions / a.predictions_made;
        const accB = b.correct_predictions / b.predictions_made;
        return accB - accA;
      })[0] ?? null;
    const sniperAcc = sniper
      ? Math.round((sniper.correct_predictions / sniper.predictions_made) * 100)
      : 0;

    // Grinder — most predictions_made
    const grinder = entries
      .sort((a, b) => b.predictions_made - a.predictions_made)[0] ?? null;

    return [
      {
        key: 'onfire',
        icon: <Flame className="w-4.5 h-4.5" />,
        title: t('insightOnFire'),
        subtitle: t('insightOnFireDesc'),
        user: onFire,
        stat: onFire ? `${onFire.weekly_points} ${t('pts')}` : '—',
        accentClass: 'text-accent-orange',
        iconBg: 'bg-accent-orange/12 text-accent-orange',
      },
      {
        key: 'sniper',
        icon: <Target className="w-4.5 h-4.5" />,
        title: t('insightSniper'),
        subtitle: t('insightSniperDesc'),
        user: sniper,
        stat: sniper ? `${sniperAcc}%` : '—',
        accentClass: 'text-accent-green',
        iconBg: 'bg-accent-green/12 text-accent-green',
      },
      {
        key: 'grinder',
        icon: <Activity className="w-4.5 h-4.5" />,
        title: t('insightGrinder'),
        subtitle: t('insightGrinderDesc'),
        user: grinder && grinder.predictions_made > 0 ? grinder : null,
        stat: grinder && grinder.predictions_made > 0 ? `${grinder.predictions_made} ${t('picks')}` : '—',
        accentClass: 'text-blue-400',
        iconBg: 'bg-blue-400/12 text-blue-400',
      },
    ];
  }, [entries, t]);

  // Don't render if no insights have users
  if (insights.every(i => !i.user)) return null;

  return (
    <div className="flex gap-3 overflow-x-auto snap-x scrollbar-hide pb-1 md:grid md:grid-cols-3 md:overflow-visible">
      {insights.map((insight, i) => (
        <motion.div
          key={insight.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, type: 'spring', stiffness: 260, damping: 24 }}
          className="snap-start min-w-[200px] md:min-w-0 flex-shrink-0 md:flex-shrink"
        >
          <GlassCard className="p-3.5 h-full">
            <div className="flex items-start gap-2.5">
              {/* Icon */}
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', insight.iconBg)}>
                {insight.icon}
              </div>

              <div className="flex-1 min-w-0">
                {/* Title + subtitle */}
                <div className={cn('text-xs font-bold uppercase tracking-wider', insight.accentClass)}>
                  {insight.title}
                </div>
                <div className="text-[10px] text-text-muted leading-tight mt-0.5">
                  {insight.subtitle}
                </div>
              </div>
            </div>

            {insight.user ? (
              <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-white/6">
                <Avatar src={insight.user.avatar_url} name={insight.user.username} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs font-semibold truncate">{insight.user.username}</div>
                </div>
                <div className={cn('font-bebas text-lg tracking-wide', insight.accentClass)}>
                  {insight.stat}
                </div>
              </div>
            ) : (
              <div className="mt-3 pt-2.5 border-t border-white/6 text-text-muted text-[10px]">—</div>
            )}
          </GlassCard>
        </motion.div>
      ))}
    </div>
  );
}
