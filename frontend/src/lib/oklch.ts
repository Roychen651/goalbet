// Hand-crafted OKLCH interpolation for the Bento Arena diverging heatmap
// (Sprint 15). Deliberately not CSS color-mix() — a discrete color must be
// computed per cell from a continuous ratio at render time (some cells need
// their exact color for contrast-aware label ink too), and this keeps full
// control over hue interpolation direction and clamping.
//
// Anchors are read from the live --arena-cold/mid/hot custom properties via
// getComputedStyle, the same "resolve CSS vars at draw time" precedent
// shareCard.ts established in Sprint 11 — one source of truth in index.css,
// never a second hardcoded copy of the same three colors in JS.

interface Oklch {
  l: number; // 0-100
  c: number;
  h: number; // degrees
}

function parseOklch(raw: string): Oklch {
  const m = raw.trim().match(/oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)/i);
  if (!m) return { l: 55, c: 0, h: 0 };
  return { l: parseFloat(m[1]), c: parseFloat(m[2]), h: parseFloat(m[3]) };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Shortest-path hue interpolation so a 218deg -> 13deg lerp doesn't sweep the
// long way around the wheel through green/yellow.
function lerpHue(a: number, b: number, t: number): number {
  const diff = ((b - a + 540) % 360) - 180;
  return (a + diff * t + 360) % 360;
}

let cachedAnchors: { cold: Oklch; mid: Oklch; hot: Oklch } | null = null;
let cachedForTheme: string | null = null;

function getArenaAnchors() {
  const isLight = document.documentElement.classList.contains('light');
  const themeKey = isLight ? 'light' : 'dark';
  if (cachedAnchors && cachedForTheme === themeKey) return cachedAnchors;

  const styles = getComputedStyle(document.documentElement);
  cachedAnchors = {
    cold: parseOklch(styles.getPropertyValue('--arena-cold')),
    mid: parseOklch(styles.getPropertyValue('--arena-mid')),
    hot: parseOklch(styles.getPropertyValue('--arena-hot')),
  };
  cachedForTheme = themeKey;
  return cachedAnchors;
}

/** Drop the memoized anchors — call after a theme toggle if colors look stale. */
export function resetOklchCache(): void {
  cachedAnchors = null;
  cachedForTheme = null;
}

export interface DivergingColor {
  color: string; // ready-to-use oklch() CSS string
  l: number; // resolved lightness, 0-100 — for contrast-aware label ink
}

/**
 * ratio: 0 (worst) .. 1 (best), diverging around 0.5 (the neutral midpoint).
 */
export function interpolateDiverging(ratio: number): DivergingColor {
  const { cold, mid, hot } = getArenaAnchors();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0.5));

  let from: Oklch;
  let to: Oklch;
  let t: number;
  if (clamped >= 0.5) {
    from = mid;
    to = cold;
    t = (clamped - 0.5) / 0.5;
  } else {
    from = mid;
    to = hot;
    t = (0.5 - clamped) / 0.5;
  }

  const l = lerp(from.l, to.l, t);
  const c = lerp(from.c, to.c, t);
  const h = lerpHue(from.h, to.h, t);

  return {
    color: `oklch(${l.toFixed(1)}% ${c.toFixed(3)} ${h.toFixed(1)})`,
    l,
  };
}

// Sprint 19 — deterministic team "brand halo" hue. No team primary-color
// field exists anywhere in this codebase (matches/FOOTBALL_LEAGUES only
// carry a per-LEAGUE accent, LEAGUE_ACCENT in MatchCard.tsx) and ESPN's
// soccer competitor objects don't reliably expose one either. A stable hash
// of the team name is the honest, zero-network-call substitute: same team
// always renders the same hue, no per-card image sampling (expensive across
// a whole feed), no risk of an unverified ESPN field being absent at runtime.
// Sprint 26 — exported so EntityBadge.tsx's fallback-gradient math shares
// this exact hash instead of a second, duplicated implementation.
export function hashTeamHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

/** Subtle radial-gradient-ready OKLCH color for a team's atmospheric card halo. */
export function teamHaloColor(name: string, alpha = 0.18): string {
  const hue = hashTeamHue(name);
  return `oklch(65% 0.15 ${hue} / ${alpha})`;
}

// Sprint 20 — Risk Meter. A separate two-stop scale from the arena
// diverging one above: --risk-gold/--risk-warning mean "how much of your
// balance this bet risks," not "performance," so they get their own tokens
// (index.css) rather than reusing --arena-cold/hot for a different meaning.
let cachedRiskAnchors: { gold: Oklch; warning: Oklch } | null = null;
let cachedRiskForTheme: string | null = null;

function getRiskAnchors() {
  const isLight = document.documentElement.classList.contains('light');
  const themeKey = isLight ? 'light' : 'dark';
  if (cachedRiskAnchors && cachedRiskForTheme === themeKey) return cachedRiskAnchors;

  const styles = getComputedStyle(document.documentElement);
  cachedRiskAnchors = {
    gold: parseOklch(styles.getPropertyValue('--risk-gold')),
    warning: parseOklch(styles.getPropertyValue('--risk-warning')),
  };
  cachedRiskForTheme = themeKey;
  return cachedRiskAnchors;
}

/**
 * ratio: 0 (safe, low commitment) .. 1 (at/near full balance). A plain
 * two-stop lerp, not diverging around a midpoint like interpolateDiverging.
 */
export function interpolateRisk(ratio: number): DivergingColor {
  const { gold, warning } = getRiskAnchors();
  const t = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const l = lerp(gold.l, warning.l, t);
  const c = lerp(gold.c, warning.c, t);
  const h = lerpHue(gold.h, warning.h, t);
  return {
    color: `oklch(${l.toFixed(1)}% ${c.toFixed(3)} ${h.toFixed(1)})`,
    l,
  };
}

// Sprint 22 — Avatar streak-tier halo. Three fixed discrete tiers, not a
// continuous ratio, so unlike interpolateDiverging/interpolateRisk this
// doesn't need getComputedStyle/caching machinery at all — it just picks
// which of the three --streak-* tokens (index.css) applies and hands back
// a var() reference for the caller to drop straight into a style prop,
// exactly how LeaderboardRow.tsx already uses `var(--risk-gold)` directly
// for its single-token gold halo.
export type StreakTier = 'bronze' | 'silver' | 'ember';

export function streakTierColor(streak: number): { token: string; tier: StreakTier } {
  if (streak >= 8) return { token: 'var(--streak-ember)', tier: 'ember' };
  if (streak >= 4) return { token: 'var(--streak-silver)', tier: 'silver' };
  return { token: 'var(--streak-bronze)', tier: 'bronze' };
}

// Sprint 34 — Parlay multiplier badge. k (linked-tier count) is only ever
// 2 or 3 — a fixed 2-value set, not a continuous ratio — so same shape as
// streakTierColor() above: a plain lookup handing back a var() reference,
// no getComputedStyle/caching machinery needed.
export function parlayIntensityColor(linkedTierCount: number): string {
  return linkedTierCount >= 3 ? 'var(--parlay-high)' : 'var(--parlay-low)';
}

// V6 Sprint 48 — Global Arena division badge. Exactly 4 named divisions,
// nothing continuous to interpolate — same plain-lookup shape as
// streakTierColor()/parlayIntensityColor() above. Deliberately reads
// --arena-division-* (index.css), never --streak-*, even though the color
// vocabulary (bronze/silver/gold) overlaps — the two token families mean
// genuinely different things (streak length vs. cross-platform division),
// see index.css's own comment on this exact token block.
export type ArenaDivision = 'bronze' | 'silver' | 'gold' | 'diamond';

export function arenaDivisionColor(division: ArenaDivision): string {
  return `var(--arena-division-${division})`;
}

// V7 Sprint 52 — Monte Carlo heatmap cell intensity. A genuine SEQUENTIAL
// single-hue ramp (--sim-low/--sim-high share one hue, only L/C vary),
// unlike every diverging/two-hue pair above — "how likely this simulated
// score is" has no natural midpoint to diverge around, it's a plain
// magnitude, the dataviz skill's own textbook case for "sequential = one
// hue, light->dark." Same getComputedStyle/caching shape as
// interpolateRisk() since this is also a continuous ratio, not a fixed
// small set like streakTierColor()/arenaDivisionColor().
let cachedSimAnchors: { low: Oklch; high: Oklch } | null = null;
let cachedSimForTheme: string | null = null;

function getSimAnchors() {
  const isLight = document.documentElement.classList.contains('light');
  const themeKey = isLight ? 'light' : 'dark';
  if (cachedSimAnchors && cachedSimForTheme === themeKey) return cachedSimAnchors;

  const styles = getComputedStyle(document.documentElement);
  cachedSimAnchors = {
    low: parseOklch(styles.getPropertyValue('--sim-low')),
    high: parseOklch(styles.getPropertyValue('--sim-high')),
  };
  cachedSimForTheme = themeKey;
  return cachedSimAnchors;
}

/**
 * ratio: 0 (this cell's probability is the lowest of the visible set) ..
 * 1 (the highest / most probable cell). Color alone is never the only
 * signal here — every consumer (MonteCarloHeatmap.tsx) always renders the
 * cell's real percentage as text too, per the dataviz skill's
 * non-negotiable rule.
 */
export function interpolateSimulation(ratio: number): DivergingColor {
  const { low, high } = getSimAnchors();
  const t = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const l = lerp(low.l, high.l, t);
  const c = lerp(low.c, high.c, t);
  const h = lerpHue(low.h, high.h, t);
  return {
    color: `oklch(${l.toFixed(1)}% ${c.toFixed(3)} ${h.toFixed(1)})`,
    l,
  };
}
