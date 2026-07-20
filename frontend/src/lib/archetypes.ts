import type { TranslationKey } from './i18n';

// V6 Sprint 45 — "Predictor Playstyle DNA." A pure classifier over data this
// codebase already computes — Sprint 40's get_player_scout_report()
// (tier_success_rates for Result/Score/Corners/BTTS/OU) plus ProfilePage's
// own already-derived accuracy/volatility/boldness ratios (§22 radar axes,
// same MIN_SAMPLE=3 insufficient-data gate ScoutReportPanel already uses).
// Zero new backend aggregation.

export type ArchetypeKey = 'prophet' | 'maverick' | 'tactician' | 'anchor';

export interface ArchetypeInput {
  exactScoreRate: number | null;   // score tier success ratio, sample-gated
  cornersRate: number | null;      // corners tier success ratio, sample-gated
  bttsRate: number | null;         // btts tier success ratio, sample-gated
  ftAccuracy: number;              // 0-1, already computed (radarAxes.accuracy)
  volatility: number;              // 0-1 clamped, already computed (radarAxes.volatility)
  boldness: number;                // 0-1 clamped, already computed (radarAxes.boldness)
  resolvedCount: number;
}

export interface ArchetypeResult {
  key: ArchetypeKey;
  nameKey: TranslationKey;
  emoji: string;
  descKey: TranslationKey;
}

const MIN_RESOLVED = 8; // below this, no archetype is confidently assignable

/**
 * Deliberately NOT "🎯 הצלף / Sniper" — TrophyCabinet.tsx already has a
 * Sniper badge (general FT accuracy >= 65%) and LeaderboardRow.tsx has its
 * own inline Sniper pill, both on this same page. A second "Sniper" here,
 * for a *different* stat (exact-score rate), would be the exact same-page
 * badge-name collision §37/§52 already corrected once each. "The Prophet"
 * (🔮) — exact-score calling — is a genuinely distinct identity.
 */
export function classifyArchetype(input: ArchetypeInput): ArchetypeResult | null {
  if (input.resolvedCount < MIN_RESOLVED) return null;

  const { exactScoreRate, cornersRate, bttsRate, ftAccuracy, volatility, boldness } = input;

  if (exactScoreRate !== null && exactScoreRate >= 0.25) {
    return { key: 'prophet', nameKey: 'archetypeProphetName', emoji: '🔮', descKey: 'archetypeProphetDesc' };
  }
  if (cornersRate !== null && bttsRate !== null && (cornersRate + bttsRate) / 2 >= 0.6) {
    return { key: 'tactician', nameKey: 'archetypeTacticianName', emoji: '📐', descKey: 'archetypeTacticianDesc' };
  }
  if (ftAccuracy >= 0.55 && volatility <= 0.35) {
    return { key: 'anchor', nameKey: 'archetypeAnchorName', emoji: '🛡️', descKey: 'archetypeAnchorDesc' };
  }
  if (boldness >= 0.5) {
    return { key: 'maverick', nameKey: 'archetypeMaverickName', emoji: '🦁', descKey: 'archetypeMaverickDesc' };
  }
  return null;
}
