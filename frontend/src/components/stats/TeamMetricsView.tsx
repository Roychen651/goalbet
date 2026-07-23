import { useMemo } from 'react';
import { useLangStore } from '../../stores/langStore';
import { EntityBadge } from '../ui/EntityBadge';
import { GlassCard } from '../ui/GlassCard';
import { EmptyState } from '../ui/EmptyState';
import type { StandingsRow, LeaderRow } from '../../hooks/useLeagueStats';
import type { TranslationKey } from '../../lib/i18n';

interface TeamMetricsViewProps {
  standings: StandingsRow[];
  // V5 Sprint 55 — reuses the leaders payload's own goalkeepers category
  // (season-long, real data) rather than deriving "clean sheets" from
  // getTeamForm()'s last-5-matches window — that would dishonestly label a
  // 5-match sample as a season leaderboard. See stats.ts's own comment on
  // LeagueLeaders.goalkeepers for the full reasoning.
  goalkeepers: LeaderRow[];
}

// V5 Sprint 55 — "Team Metrics" tab. Best Offense / Best Defense are
// derived ENTIRELY client-side from `standings` (gf/gp, ga/gp) — this data
// is already fetched for the Standings tab, so this view costs zero new
// network requests. Clean Sheet leaders is the one card that reuses real
// server-provided data (goalkeepers) rather than something computable
// from standings alone (a season-long per-team clean-sheet count isn't in
// StandingsRow at all).
export function TeamMetricsView({ standings, goalkeepers }: TeamMetricsViewProps) {
  const { t } = useLangStore();

  const bestOffense = useMemo(
    () =>
      standings
        .filter(r => r.gp > 0)
        .map(r => ({ row: r, perMatch: r.gf / r.gp }))
        .sort((a, b) => b.perMatch - a.perMatch)
        .slice(0, 5),
    [standings],
  );

  const bestDefense = useMemo(
    () =>
      standings
        .filter(r => r.gp > 0)
        .map(r => ({ row: r, perMatch: r.ga / r.gp }))
        .sort((a, b) => a.perMatch - b.perMatch)
        .slice(0, 5),
    [standings],
  );

  if (standings.length === 0 && goalkeepers.length === 0) {
    return <EmptyState icon="📊" title={t('statsNoTeamMetrics')} description="" />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <MetricCard title={t('statsBestOffense')} unit={t('statsGoalsPerMatch')}>
        {bestOffense.map(({ row, perMatch }) => (
          <TeamMetricRow key={row.team.id || row.team.name} name={row.team.shortName || row.team.name} logo={row.team.logo} hashSeed={row.team.name} value={perMatch.toFixed(2)} />
        ))}
      </MetricCard>

      <MetricCard title={t('statsBestDefense')} unit={t('statsGoalsAgainstPerMatch')}>
        {bestDefense.map(({ row, perMatch }) => (
          <TeamMetricRow key={row.team.id || row.team.name} name={row.team.shortName || row.team.name} logo={row.team.logo} hashSeed={row.team.name} value={perMatch.toFixed(2)} />
        ))}
      </MetricCard>

      <MetricCard title={t('statsCleanSheets')} unit={t('statsCleanSheets')} empty={goalkeepers.length === 0}>
        {goalkeepers.slice(0, 5).map((gk) => (
          <TeamMetricRow key={gk.athleteId || gk.name} name={gk.teamName ?? gk.name} logo={gk.teamLogo} hashSeed={gk.teamName ?? gk.athleteId} value={String(gk.value)} subLabel={gk.name} />
        ))}
      </MetricCard>
    </div>
  );
}

function MetricCard({ title, unit, children, empty }: { title: string; unit: string; children: React.ReactNode; empty?: boolean }) {
  const { t } = useLangStore();
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;

  return (
    <GlassCard tactile contentClassName="p-3 space-y-2">
      <div>
        <div className="font-barlow text-xs font-bold uppercase tracking-wider text-white">{title}</div>
        <div className="text-text-muted text-[10px] uppercase tracking-wider">{unit}</div>
      </div>
      {empty || !hasChildren ? (
        <div className="text-text-muted text-xs py-4 text-center">{t('statsNoLeadersInCategory' as TranslationKey)}</div>
      ) : (
        <div className="space-y-1">{children}</div>
      )}
    </GlassCard>
  );
}

function TeamMetricRow({ name, logo, hashSeed, value, subLabel }: { name: string; logo: string | null; hashSeed: string; value: string; subLabel?: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <EntityBadge src={logo} name={name} hashSeed={hashSeed} size={20} className="shrink-0 rounded-full" />
      <div className="flex-1 min-w-0">
        <div className="text-white text-xs font-medium truncate">{name}</div>
        {subLabel && <div className="text-text-muted text-[9px] truncate">{subLabel}</div>}
      </div>
      <div className="font-mono text-sm tabular-nums text-white font-semibold shrink-0">{value}</div>
    </div>
  );
}
