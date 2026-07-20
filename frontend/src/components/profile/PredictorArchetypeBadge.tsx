import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { classifyArchetype, type ArchetypeResult } from '../../lib/archetypes';
import type { ScoutReportData } from '../leaderboard/ScoutReportPanel';
import { useLangStore } from '../../stores/langStore';
import { useTactileTilt } from '../../hooks/useTactileTilt';

interface PredictorArchetypeBadgeProps {
  userId: string;
  groupId: string | null;
  ftAccuracy: number;
  volatility: number;
  boldness: number;
  resolvedCount: number;
}

const MIN_SAMPLE = 3;

/**
 * V6 Sprint 45 — reuses get_player_scout_report() (Sprint 40, §55) for its
 * own tier_success_rates rather than a new RPC; combines with ProfilePage's
 * already-computed accuracy/volatility/boldness ratios (§22 radar axes).
 * Single-instance, one hero element on the page — the same "many
 * simultaneous instances -> CSS, single/rare -> real tilt" split this
 * codebase already applies elsewhere (§16/§43) justifies useTactileTilt
 * here without the "many badges in a feed" cost concern.
 */
export function PredictorArchetypeBadge({ userId, groupId, ftAccuracy, volatility, boldness, resolvedCount }: PredictorArchetypeBadgeProps) {
  const { t } = useLangStore();
  const [report, setReport] = useState<ScoutReportData | null>(null);
  const tiltRef = useTactileTilt<HTMLDivElement>({ max: 6 });

  useEffect(() => {
    if (!userId || !groupId) return;
    supabase
      .rpc('get_player_scout_report', { p_target_user_id: userId, p_group_id: groupId })
      .then(({ data }) => setReport(data as ScoutReportData | null));
  }, [userId, groupId]);

  if (!report) return null;

  const rate = (r: { sample: number; correct: number } | undefined) =>
    r && r.sample >= MIN_SAMPLE ? r.correct / r.sample : null;

  const archetype: ArchetypeResult | null = classifyArchetype({
    exactScoreRate: rate(report.tier_success_rates.score),
    cornersRate: rate(report.tier_success_rates.corners),
    bttsRate: rate(report.tier_success_rates.btts),
    ftAccuracy,
    volatility,
    boldness,
    resolvedCount,
  });

  // Hidden until a confident classification exists — the same "hidden
  // until real data exists" convention this codebase applies everywhere
  // (MatchTimeline/AIScoutCard/PulseFeed/HallOfFameChronicles, §21).
  if (!archetype) return null;

  return (
    <div
      ref={tiltRef}
      className="tactile-tilt mt-3 rounded-2xl border border-white/10 px-4 py-3 flex items-center gap-3"
      style={{
        background: 'color-mix(in oklch, var(--risk-gold) 8%, var(--color-bg-card))',
        boxShadow: '0 0 24px color-mix(in oklch, var(--risk-gold) 20%, transparent)',
      }}
    >
      <span className="text-2xl leading-none shrink-0" aria-hidden>{archetype.emoji}</span>
      <div className="min-w-0">
        <div className="text-sm font-bold text-white truncate">{t(archetype.nameKey)}</div>
        <div className="text-xs text-text-muted truncate">{t(archetype.descKey)}</div>
      </div>
    </div>
  );
}
