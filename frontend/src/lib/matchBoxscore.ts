/**
 * Shared ESPN boxscore fetch — originally extracted (V4 Sprint 32 Commit 1)
 * so both MatchStats.tsx and the since-removed Match Pressure Graph
 * (MatchMomentumFlow.tsx, removed on live user feedback — "unnecessary,
 * clutters the card") could share one ESPN boxscore parser instead of
 * duplicating it. The pressure-delta math (BoxscoreSnapshot,
 * extractSnapshot, computePressureSample, PRESSURE_CLAMP) that only that
 * removed component used was removed alongside it — fetchMatchStats()/
 * StatRow/STAT_MAP stay, MatchStats.tsx is still a real consumer.
 */

import { LEAGUE_ESPN_SLUG } from './constants';
import type { TranslationKey } from './i18n';

// ── Types ────────────────────────────────────────────────────────────────────

export interface StatRow {
  key: string;
  label: TranslationKey;
  home: number;
  away: number;
  /** Display as percentage (e.g. possession) */
  pct?: boolean;
}

// Stat names from ESPN → our i18n keys + extraction helpers
export const STAT_MAP: { espn: string; label: TranslationKey; pct?: boolean }[] = [
  { espn: 'possessionPct', label: 'possession', pct: true },
  { espn: 'totalShots',    label: 'totalShots' },
  { espn: 'shotsOnTarget', label: 'shotsOnTarget' },
  { espn: 'wonCorners',    label: 'cornersStats' },
  { espn: 'foulsCommitted', label: 'fouls' },
  { espn: 'offsides',      label: 'offsides' },
  { espn: 'yellowCards',   label: 'yellowCards' },
  { espn: 'redCards',      label: 'redCardsStat' },
];

// ── ESPN Fetch ───────────────────────────────────────────────────────────────

export async function fetchMatchStats(externalId: string, leagueId: number): Promise<StatRow[]> {
  const slug = LEAGUE_ESPN_SLUG[leagueId];
  if (!slug) return [];

  const eventId = externalId.replace(/^espn_/, '');
  if (!eventId || !/^\d+$/.test(eventId)) return [];

  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${eventId}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json() as Record<string, unknown>;

    const boxscore = data?.boxscore as Record<string, unknown> | undefined;
    const teams = (boxscore?.teams as Record<string, unknown>[]) ?? [];
    if (teams.length < 2) return [];

    const homeStat = (teams[0]?.statistics as Record<string, unknown>[]) ?? [];
    const awayStat = (teams[1]?.statistics as Record<string, unknown>[]) ?? [];

    const getVal = (stats: Record<string, unknown>[], name: string): number => {
      const found = stats.find(s => s.name === name);
      if (!found) return 0;
      const dv = found.displayValue ?? found.value;
      const n = typeof dv === 'string' ? parseFloat(dv.replace('%', '')) : typeof dv === 'number' ? dv : 0;
      return isNaN(n) ? 0 : n;
    };

    const rows: StatRow[] = [];
    for (const m of STAT_MAP) {
      const h = getVal(homeStat, m.espn);
      const a = getVal(awayStat, m.espn);
      // Only include stats that have data (at least one side > 0), except possession
      if (h === 0 && a === 0 && !m.pct) continue;
      rows.push({ key: m.espn, label: m.label, home: h, away: a, pct: m.pct });
    }

    return rows;
  } catch {
    return [];
  }
}

