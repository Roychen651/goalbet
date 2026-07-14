import { motion, useReducedMotion, type Variants } from 'framer-motion';
import NumberFlow from '@number-flow/react';
import { Flame, Gauge, Grid3x3, TrendingDown, TrendingUp, Users, type LucideIcon } from 'lucide-react';
import { useLangStore } from '../../stores/langStore';
import { useGroupStore } from '../../stores/groupStore';
import { useStatsArena } from '../../hooks/useStatsArena';
import { GlassCard } from '../ui/GlassCard';
import { EmptyState } from '../ui/EmptyState';
import { PredictionHeatmap } from './PredictionHeatmap';
import { GroupDistributionChart } from './GroupDistributionChart';
import { H2HMatrix } from './H2HMatrix';

// Sprint 15 complete — all four card slots render real, hand-built
// visualizations from the single get_stats_arena_payload RPC. No fake data,
// no charting library, no additional network round trip anywhere in this tab.
//
// Polish pass: every "premium" touch below runs on Framer Motion, which was
// already the vendor-framer bundle chunk before this sprint started — no new
// dependency, no new font. GlassCard's `interactive` cursor-tracking glare
// was already built (Sprint 17-era) and simply never turned on for these
// cards until now.

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 100, damping: 15 },
  },
};

function CardSkeleton() {
  return (
    <div className="h-full min-h-[7rem] animate-pulse rounded-xl bg-white/5" />
  );
}

// Shared header treatment: gradient icon badge + gradient text-clip title —
// same visual grammar as ActivityFeed's AiBanterCard (Sprint 10), reused here
// for a consistent "this is a distinct, designed surface" identity instead of
// a sixth copy of plain icon + uppercase label.
function CardHeader({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: 'linear-gradient(135deg, var(--arena-cold) 0%, var(--color-accent-secondary) 100%)',
          boxShadow: '0 0 10px var(--arena-glow)',
        }}
      >
        <Icon size={13} strokeWidth={2.5} className="text-white" />
      </div>
      <h3
        className="font-barlow text-[11px] font-bold uppercase tracking-[0.14em]"
        style={{
          backgroundImage: 'linear-gradient(120deg, var(--color-text-primary) 0%, var(--arena-cold) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {title}
      </h3>
    </div>
  );
}

// Subtle premium lift on hover — Linear/Stripe-dashboard-style, not a bounce.
const cardHover = { y: -3, transition: { duration: 0.18, ease: 'easeOut' as const } };

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
  const stakeAboveAvg = distribution ? distribution.avg_stake >= distribution.group_avg_stake : null;

  return (
    <motion.div
      variants={reduceMotion ? undefined : containerVariants}
      initial={reduceMotion ? undefined : 'hidden'}
      animate={reduceMotion ? undefined : 'visible'}
      dir={lang === 'he' ? 'rtl' : 'ltr'}
      className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:auto-rows-[minmax(7rem,auto)]"
    >
      {/* Hero — top-performing league, radial OKLCH glow scaled by win ratio */}
      <motion.div
        variants={reduceMotion ? undefined : cardVariants}
        whileHover={reduceMotion ? undefined : cardHover}
        className="sm:col-span-2 sm:row-span-2"
      >
        <GlassCard
          variant="elevated"
          grain
          interactive
          className="h-full p-5 flex flex-col justify-between relative overflow-hidden"
        >
          {!reduceMotion && (
            <motion.div
              className="pointer-events-none absolute -inset-6 rounded-full blur-2xl"
              style={{ background: 'radial-gradient(circle, var(--arena-glow) 0%, transparent 70%)' }}
              animate={{ opacity: [Math.max(0.2, heroRatio), Math.max(0.35, heroRatio * 1.25), Math.max(0.2, heroRatio)] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <div className="relative z-10">
            <CardHeader icon={TrendingUp} title={t('arenaHeroTitle')} />
            <p className="text-text-muted text-xs mt-1.5 ms-8">{t('arenaHeroSubtitle')}</p>
          </div>
          <div className="relative z-10">
            {isLoading || !heroCell ? (
              <CardSkeleton />
            ) : (
              <>
                <div className="font-mono font-bold text-5xl sm:text-6xl tracking-tight text-text-primary tabular-nums">
                  <NumberFlow value={Math.round(heroRatio * 100)} suffix="%" />
                </div>
                <p className="font-barlow text-sm font-medium text-text-muted mt-1.5 truncate">{heroCell.league_name}</p>
              </>
            )}
          </div>
        </GlassCard>
      </motion.div>

      {/* Heatmap */}
      <motion.div
        variants={reduceMotion ? undefined : cardVariants}
        whileHover={reduceMotion ? undefined : cardHover}
        className="sm:col-span-2 sm:row-span-2"
      >
        <GlassCard variant="elevated" grain interactive className="h-full p-5 flex flex-col gap-3">
          <CardHeader icon={Grid3x3} title={t('arenaHeatmapTitle')} />
          {isLoading ? <CardSkeleton /> : <PredictionHeatmap cells={data?.heatmap ?? []} />}
        </GlassCard>
      </motion.div>

      {/* Distribution — Gaussian emphasis curve + glowing user-position marker */}
      <motion.div
        variants={reduceMotion ? undefined : cardVariants}
        whileHover={reduceMotion ? undefined : cardHover}
        className="sm:col-span-2"
      >
        <GlassCard variant="elevated" grain interactive className="h-full p-5 flex flex-col gap-3">
          <CardHeader icon={Gauge} title={t('arenaDistributionTitle')} />
          {isLoading || !distribution ? (
            <CardSkeleton />
          ) : (
            <>
              <GroupDistributionChart distribution={distribution} />
              {stakeAboveAvg !== null && (
                <div className="flex items-center gap-1 text-[11px] font-mono text-text-muted -mt-1">
                  {stakeAboveAvg ? (
                    <TrendingUp size={12} className="text-accent-green" />
                  ) : (
                    <TrendingDown size={12} className="text-accent-orange" />
                  )}
                  <span>{Math.abs(distribution.avg_stake - distribution.group_avg_stake).toFixed(1)}</span>
                </div>
              )}
            </>
          )}
        </GlassCard>
      </motion.div>

      {/* Streak tile */}
      <motion.div variants={reduceMotion ? undefined : cardVariants} whileHover={reduceMotion ? undefined : cardHover}>
        <GlassCard variant="elevated" grain interactive className="h-full p-4 flex flex-col justify-between">
          <CardHeader icon={Flame} title={t('arenaStreakTile')} />
          {isLoading || !distribution ? (
            <CardSkeleton />
          ) : (
            <div className="font-mono font-bold text-3xl text-text-primary tabular-nums tracking-tight">
              <NumberFlow value={distribution.current_streak} />
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* Risk score tile */}
      <motion.div variants={reduceMotion ? undefined : cardVariants} whileHover={reduceMotion ? undefined : cardHover}>
        <GlassCard variant="elevated" grain interactive className="h-full p-4 flex flex-col justify-between">
          <CardHeader icon={Gauge} title={t('arenaRiskTile')} />
          {isLoading || !distribution ? (
            <CardSkeleton />
          ) : (
            <div className="font-mono font-bold text-3xl text-text-primary tabular-nums tracking-tight">
              <NumberFlow value={distribution.risk_score} />
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* H2H — interactive opponent picker, zero new network calls per switch */}
      <motion.div variants={reduceMotion ? undefined : cardVariants} whileHover={reduceMotion ? undefined : cardHover} className="sm:col-span-4">
        <GlassCard variant="elevated" grain interactive className="h-full p-5 flex flex-col gap-2">
          <CardHeader icon={Users} title={t('arenaH2HTitle')} />
          {isLoading ? <CardSkeleton /> : <H2HMatrix matrix={data?.h2h_matrix ?? []} />}
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
