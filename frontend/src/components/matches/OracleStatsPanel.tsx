import { useLangStore } from '../../stores/langStore';
import { tTeam } from '../../lib/dictionaries/teamsHe';
import { cn } from '../../lib/utils';
import { OracleDial } from './OracleDial';
import { AIScoutCard } from '../ui/AIScoutCard';
import type { Match, OracleTeamForm } from '../../lib/supabase';

// V5 Sprint 33 — "The Analytics Oracle". Deterministic, SQL-computed
// historical form for both teams (compute_match_oracle_stats, migration
// 053) plus an AI narration of those same numbers — the AI never computes
// a stat itself, it only narrates what this panel already renders directly.
//
// Hidden entirely until real oracle_stats exists — the same "hidden until
// real data exists" convention as MatchTimeline/AIScoutCard/HallOfFame
// Chronicles/PulseFeed. No skeleton: a loading flash on a secondary panel
// is more noise than the eventual empty state (same call MatchMomentumFlow
// made, Sprint 32).
//
// W/D/L is a categorical 3-way split, not a single percentage — it does
// NOT get a radial gauge (a 0-100 dial can't honestly represent 3 outcomes
// at once). It reuses StandingsTable.tsx's existing win/draw/loss color
// language (accent-green/muted/accent-orange) as count badges instead of
// that component's own per-match sequence chips, since oracle_stats only
// carries aggregate counts, not a chronological result list.

function WDLBadges({ form }: { form: OracleTeamForm }) {
  const { lang } = useLangStore();
  const entries: { count: number; kind: 'W' | 'D' | 'L' }[] = [
    { count: form.wins, kind: 'W' },
    { count: form.draws, kind: 'D' },
    { count: form.losses, kind: 'L' },
  ];
  return (
    <div className="flex items-center gap-1">
      {entries.map(({ count, kind }) => {
        const letter = lang === 'he' ? (kind === 'W' ? 'נ' : kind === 'D' ? 'ת' : 'ה') : kind;
        return (
          <span
            key={kind}
            className={cn(
              'px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold tabular-nums ring-1 shrink-0',
              kind === 'W' && 'bg-accent-green/15 text-accent-green ring-accent-green/30',
              kind === 'D' && 'bg-white/8 text-text-muted ring-white/15',
              kind === 'L' && 'bg-accent-orange/15 text-accent-orange ring-accent-orange/30',
            )}
          >
            {count}{letter}
          </span>
        );
      })}
    </div>
  );
}

function TeamOracleColumn({ teamName, form, isRTL }: { teamName: string; form: OracleTeamForm; isRTL: boolean }) {
  const { t } = useLangStore();
  const displayName = isRTL ? tTeam(teamName) : teamName;
  // Migration 059 — at sample_size=0, "0W 0D 0L" reads as a real (if empty)
  // record even though it actually means "we've never seen this team play."
  // A single honest caption replaces the whole WDL+dial block instead of
  // three technically-zero-but-misleading badges plus two "no data" gauges.
  const hasHistory = form.sample_size > 0;

  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <span
        className="text-[11px] font-bold text-white/80 truncate max-w-full"
        dir={isRTL ? 'rtl' : 'ltr'}
        title={teamName}
      >
        {displayName}
      </span>
      {hasHistory ? (
        <>
          <WDLBadges form={form} />
          <div className="flex gap-1.5">
            <OracleDial value={form.over25_pct} label={t('oracleOver25Label')} sampleSize={form.sample_size} noDataLabel={t('oracleNoDataDial')} />
            <OracleDial value={form.btts_pct} label={t('oracleBttsLabel')} sampleSize={form.sample_size} noDataLabel={t('oracleNoDataDial')} />
          </div>
        </>
      ) : (
        <span className="text-[10px] text-white/30 text-center leading-snug px-1 py-3">{t('oracleNoRecentData')}</span>
      )}
    </div>
  );
}

interface OracleStatsPanelProps {
  match: Match;
}

export function OracleStatsPanel({ match }: OracleStatsPanelProps) {
  const { t, lang } = useLangStore();
  const isRTL = lang === 'he';
  const stats = match.oracle_stats;
  const narration = (lang === 'he' && match.ai_oracle_insight_he) || match.ai_oracle_insight;

  // Migration 059 — when NEITHER team has a single resolved match in this
  // app's own history (both new/rarely-synced sides, e.g. a fresh World Cup
  // knockout pairing), the panel has zero real signal to show at all. Hiding
  // it entirely here matches this codebase's own "hidden until real data
  // exists" convention (MatchTimeline/AIScoutCard/PulseFeed/HallOfFame
  // Chronicles) rather than rendering two side-by-side "no data" captions
  // that add visual weight without adding information.
  if (!stats || (stats.home.sample_size === 0 && stats.away.sample_size === 0)) return null;

  return (
    <div className="mt-2 px-3 py-2.5 rounded-xl border border-white/6 bg-white/[0.02]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[9px] uppercase tracking-widest text-white/30">{t('oracleTitle')}</p>
        <p className="text-[9px] text-white/20">{t('oracleSubtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TeamOracleColumn teamName={match.home_team} form={stats.home} isRTL={isRTL} />
        <TeamOracleColumn teamName={match.away_team} form={stats.away} isRTL={isRTL} />
      </div>

      {narration && (
        <div className="mt-2">
          <AIScoutCard title="oracleNarrationTitle" text={narration} tone="pre" />
        </div>
      )}
    </div>
  );
}
