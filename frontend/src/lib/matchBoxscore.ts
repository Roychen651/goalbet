/**
 * Shared ESPN boxscore fetch + pressure math — V4 Sprint 32 Commit 1.
 *
 * fetchMatchStats()/StatRow/STAT_MAP were previously module-private inside
 * MatchStats.tsx. Extracted the moment a second real consumer
 * (useMatchPressureFlow, this same commit) needed the identical ESPN
 * boxscore parsing — the "extract on the second real consumer" precedent
 * already established for lib/espnEvents.ts (Sprint 19). MatchStats.tsx now
 * imports from here instead of defining its own copy.
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

// ── Pressure math — V4 Sprint 32 ─────────────────────────────────────────────
//
// MatchMomentumPulse.tsx (Sprint 19) deliberately avoided a smoothed curve
// because ESPN's keyEvents feed has no shot/possession data to back one —
// only discrete goal/card markers. This is a genuinely different data
// source: MatchStats' boxscore fields ARE a real time series (one honest
// snapshot every 30s), so a curve here isn't fabricated precision, PROVIDED
// it's built from deltas between snapshots, not raw cumulative totals.
// Cumulative shots/corners only ever grow — a ratio computed directly from
// them slowly flattens to one value and can never show a real back-and-forth
// swing. The delta since the last poll is what actually says "who is
// pressing right now."

export interface BoxscoreSnapshot {
  shotsHome: number;
  shotsAway: number;
  sotHome: number;
  sotAway: number;
  cornersHome: number;
  cornersAway: number;
  /** 0-100, home team's share */
  possessionHome: number;
}

export function extractSnapshot(rows: StatRow[]): BoxscoreSnapshot | null {
  const find = (key: string) => rows.find(r => r.key === key);
  const shots = find('totalShots');
  const sot = find('shotsOnTarget');
  const corners = find('wonCorners');
  const poss = find('possessionPct');
  if (!shots && !sot && !corners && !poss) return null;

  return {
    shotsHome: shots?.home ?? 0,
    shotsAway: shots?.away ?? 0,
    sotHome: sot?.home ?? 0,
    sotAway: sot?.away ?? 0,
    cornersHome: corners?.home ?? 0,
    cornersAway: corners?.away ?? 0,
    possessionHome: poss?.home ?? 50,
  };
}

// Hand-tuned weights, not a statistical model — stated plainly, same
// "don't let a modeled value look more scientific than it is" discipline as
// GroupDistributionChart's Gaussian-curve honesty note (Sprint 15).
const WEIGHT_SHOTS_ON_TARGET = 3;
const WEIGHT_SHOTS = 1.5;
const WEIGHT_CORNERS = 2;
const WEIGHT_POSSESSION = 0.3;
const PRESSURE_CLAMP = 10;

/**
 * Returns a pressure value in [-PRESSURE_CLAMP, +PRESSURE_CLAMP]. Positive
 * favors home, negative favors away. `previous` is null on the very first
 * sample of a match — returns 0 (an honest "no observed change yet"),
 * never a spike derived from cumulative totals at kickoff.
 */
export function computePressureSample(current: BoxscoreSnapshot, previous: BoxscoreSnapshot | null): number {
  if (!previous) return 0;

  const dShots = (current.shotsHome - previous.shotsHome) - (current.shotsAway - previous.shotsAway);
  const dSot = (current.sotHome - previous.sotHome) - (current.sotAway - previous.sotAway);
  const dCorners = (current.cornersHome - previous.cornersHome) - (current.cornersAway - previous.cornersAway);
  const possessionTilt = (current.possessionHome - 50) * WEIGHT_POSSESSION;

  const raw =
    dSot * WEIGHT_SHOTS_ON_TARGET +
    dShots * WEIGHT_SHOTS +
    dCorners * WEIGHT_CORNERS +
    possessionTilt;

  return Math.max(-PRESSURE_CLAMP, Math.min(PRESSURE_CLAMP, raw));
}
