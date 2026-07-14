import { motion, useReducedMotion, type Variants } from 'framer-motion';
import NumberFlow from '@number-flow/react';
import { Flame, Gauge, Grid3x3, Users } from 'lucide-react';
import { useLangStore } from '../../stores/langStore';
import { useGroupStore } from '../../stores/groupStore';
import { useStatsArena } from '../../hooks/useStatsArena';
import { GlassCard } from '../ui/GlassCard';
import { EmptyState } from '../ui/EmptyState';
import { PredictionHeatmap } from './PredictionHeatmap';
import { GroupDistributionChart } from './GroupDistributionChart';

// Sprint 15 Commit 3 — zero-dependency SVG visualization engines land in the
// Heatmap and Distribution card slots. The H2H card still shows the numeric
// summary from Commit 2; its interactive opponent picker is Commit 4.

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 100, damping: 15 },
  },
};

function CardSkeleton() {
  return (
    <div className="h-full min-h-[7rem] animate-pulse rounded-xl bg-white/5" />
  );
}

export function BentoArena() {
  const { t, lang } = useLangStore();
  const { activeGroupId } = useGroupStore();
  const reduceMotion = useReducedMotion();
  const { data, isLoading, isError } = useStatsArena();

  if (!activeGroupId) {
    return <EmptyState icon="🏟️" title={t('arenaNoGroup')} />;
  }

  if (isError) {
    return <EmptyState icon="⚠️" title={t('arenaLoadFailed')} />;
  }

  const hasAnyResolvedData =
    !!data && (data.heatmap.length > 0 || data.h2h_matrix.length > 0 || data.distribution.avg_stake > 0);

  if (!isLoading && data && !hasAnyResolvedData) {
    return <EmptyState icon="📊" title={t('arenaNoData')} />;
  }

  // Best-performing league cell (sufficient sample only) drives the hero card
  // and the ambient glow intensity — same signal, two renderings.
  const heroCell = data?.heatmap
    .filter(c => !c.insufficient_data && c.win_ratio !== null)
    .sort((a, b) => (b.win_ratio ?? 0) - (a.win_ratio ?? 0))[0];
  const heroRatio = heroCell?.win_ratio ?? 0;

  const distribution = data?.distribution;
  const opponentCount = data?.h2h_matrix.length ?? 0;

  return (
    <motion.div
      variants={reduceMotion ? undefined : containerVariants}
      initial={reduceMotion ? undefined : 'hidden'}
      animate={reduceMotion ? undefined : 'visible'}
      dir={lang === 'he' ? 'rtl' : 'ltr'}
      className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:auto-rows-[minmax(7rem,auto)]"
    >
      {/* Hero — top-performing league, radial OKLCH glow scaled by win ratio */}
      <motion.div variants={reduceMotion ? undefined : cardVariants} className="sm:col-span-2 sm:row-span-2">
        <GlassCard variant="elevated" grain className="h-full p-5 flex flex-col justify-between relative overflow-hidden">
          {!reduceMotion && (
            <div
              className="pointer-events-none absolute -inset-6 rounded-full blur-2xl"
              style={{
                background: `radial-gradient(circle, var(--arena-glow) 0%, transparent 70%)`,
                opacity: Math.max(0.25, heroRatio),
              }}
            />
          )}
          <div className="relative z-10">
            <h3 className="font-barlow text-xs font-bold uppercase tracking-widest text-text-muted">
              {t('arenaHeroTitle')}
            </h3>
            <p className="text-text-muted text-xs mt-0.5">{t('arenaHeroSubtitle')}</p>
          </div>
          <div className="relative z-10">
            {isLoading || !heroCell ? (
              <CardSkeleton />
            ) : (
              <>
                <div className="font-mono font-bold text-4xl sm:text-5xl text-text-primary tabular-nums">
                  <NumberFlow value={Math.round(heroRatio * 100)} suffix="%" />
                </div>
                <p className="font-barlow text-sm text-text-muted mt-1 truncate">{heroCell.league_name}</p>
              </>
            )}
          </div>
        </GlassCard>
      </motion.div>

      {/* Heatmap — numeric summary today, PredictionHeatmap SVG in Commit 3 */}
      <motion.div variants={reduceMotion ? undefined : cardVariants} className="sm:col-span-2 sm:row-span-2">
        <GlassCard variant="elevated" grain className="h-full p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Grid3x3 className="w-4 h-4 text-accent-green" />
            <h3 className="font-barlow text-xs font-bold uppercase tracking-widest text-text-muted">
              {t('arenaHeatmapTitle')}
            </h3>
          </div>
          {isLoading ? <CardSkeleton /> : <PredictionHeatmap cells={data?.heatmap ?? []} />}
        </GlassCard>
      </motion.div>

      {/* Distribution — Gaussian emphasis curve + glowing user-position marker */}
      <motion.div variants={reduceMotion ? undefined : cardVariants} className="sm:col-span-2">
        <GlassCard variant="elevated" grain className="h-full p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-accent-green" />
            <h3 className="font-barlow text-xs font-bold uppercase tracking-widest text-text-muted">
              {t('arenaDistributionTitle')}
            </h3>
          </div>
          {isLoading || !distribution ? (
            <CardSkeleton />
          ) : (
            <GroupDistributionChart distribution={distribution} />
          )}
        </GlassCard>
      </motion.div>

      {/* Streak tile */}
      <motion.div variants={reduceMotion ? undefined : cardVariants}>
        <GlassCard variant="elevated" grain className="h-full p-4 flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-accent-orange" />
            <h3 className="font-barlow text-xs font-bold uppercase tracking-widest text-text-muted">
              {t('arenaStreakTile')}
            </h3>
          </div>
          {isLoading || !distribution ? (
            <CardSkeleton />
          ) : (
            <div className="font-mono font-bold text-2xl text-text-primary tabular-nums">
              <NumberFlow value={distribution.current_streak} />
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* Risk score tile */}
      <motion.div variants={reduceMotion ? undefined : cardVariants}>
        <GlassCard variant="elevated" grain className="h-full p-4 flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-accent-green" />
            <h3 className="font-barlow text-xs font-bold uppercase tracking-widest text-text-muted">
              {t('arenaRiskTile')}
            </h3>
          </div>
          {isLoading || !distribution ? (
            <CardSkeleton />
          ) : (
            <div className="font-mono font-bold text-2xl text-text-primary tabular-nums">
              <NumberFlow value={distribution.risk_score} />
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* H2H — opponent count today, interactive matrix picker in Commit 4 */}
      <motion.div variants={reduceMotion ? undefined : cardVariants} className="sm:col-span-4">
        <GlassCard variant="elevated" grain className="h-full p-5 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-accent-green" />
            <h3 className="font-barlow text-xs font-bold uppercase tracking-widest text-text-muted">
              {t('arenaH2HTitle')}
            </h3>
          </div>
          {isLoading ? (
            <CardSkeleton />
          ) : (
            <p className="font-mono text-sm text-text-muted">
              {t('arenaH2HSubtitle').replace('{0}', String(opponentCount))}
            </p>
          )}
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
