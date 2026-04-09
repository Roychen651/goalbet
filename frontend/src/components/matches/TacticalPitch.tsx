/**
 * TacticalPitch — Glass tactical formation view for Starting XI.
 *
 * Parses formation string (e.g. "4-3-3") + player positions to render
 * an interactive pitch diagram. Vertical on mobile, horizontal on desktop.
 * Falls back gracefully when formation data is unavailable.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface PitchPlayer {
  name: string;
  jersey: string;
  positionShort: string; // GK, DEF, MID, FWD
  subbedOut?: boolean;
}

interface TacticalPitchProps {
  homeFormation: string | null;
  awayFormation: string | null;
  homeStarters: PitchPlayer[];
  awayStarters: PitchPlayer[];
  homeTeam: string;
  awayTeam: string;
  rtl?: boolean;
}

// ── Formation parser ─────────────────────────────────────────────────────────

/**
 * Parse "4-3-3" → [4, 3, 3] (outfield rows from defense to attack).
 * Returns null if unparseable.
 */
function parseFormation(f: string | null): number[] | null {
  if (!f) return null;
  const parts = f.split('-').map(Number);
  if (parts.some(isNaN) || parts.length < 2) return null;
  return parts;
}

/**
 * Distribute starters into pitch rows based on formation.
 * Row 0 = GK (always 1), then formation rows from defense → attack.
 * Returns array of rows, each row = array of players.
 */
function distributeToRows(
  starters: PitchPlayer[],
  formation: number[] | null,
): PitchPlayer[][] {
  const gk = starters.filter(p => p.positionShort === 'GK');
  const defs = starters.filter(p => p.positionShort === 'DEF');
  const mids = starters.filter(p => p.positionShort === 'MID');
  const fwds = starters.filter(p => p.positionShort === 'FWD');

  // If we have a valid formation, use it to build rows
  if (formation) {
    const outfield = [...defs, ...mids, ...fwds];
    const rows: PitchPlayer[][] = [gk.length > 0 ? [gk[0]] : []];
    let idx = 0;
    for (const count of formation) {
      const row: PitchPlayer[] = [];
      for (let i = 0; i < count && idx < outfield.length; i++, idx++) {
        row.push(outfield[idx]);
      }
      rows.push(row);
    }
    return rows;
  }

  // Fallback — group by position
  const rows: PitchPlayer[][] = [];
  if (gk.length > 0) rows.push(gk);
  if (defs.length > 0) rows.push(defs);
  if (mids.length > 0) rows.push(mids);
  if (fwds.length > 0) rows.push(fwds);
  return rows;
}

// ── Player Node ──────────────────────────────────────────────────────────────

function PlayerNode({
  player,
  index,
  isHome,
}: {
  player: PitchPlayer;
  index: number;
  isHome: boolean;
}) {
  // Short display name: last word of name, max ~8 chars
  const shortName = player.name.includes('.')
    ? player.name // Already short like "J. Smith"
    : player.name.split(' ').pop() ?? player.name;

  return (
    <motion.div
      className="flex flex-col items-center gap-0.5 min-w-0"
      initial={{ opacity: 0, scale: 0.4, y: -16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 220,
        damping: 18,
        delay: index * 0.04,
      }}
    >
      {/* Jersey circle */}
      <div
        className={cn(
          'w-7 h-7 md:w-9 md:h-9 rounded-full flex items-center justify-center',
          'text-[10px] md:text-[11px] font-display font-bold tabular-nums leading-none',
          'border shadow-sm transition-colors',
          player.subbedOut && 'opacity-30',
          isHome
            ? 'bg-accent-green/20 border-accent-green/40 text-accent-green shadow-[0_0_8px_var(--color-accent-green,rgba(189,232,245,0.15))]'
            : 'bg-accent-orange/20 border-accent-orange/40 text-accent-orange shadow-[0_0_8px_var(--color-accent-orange,rgba(255,51,102,0.15))]',
        )}
      >
        {player.jersey || '–'}
      </div>

      {/* Name label */}
      <span
        className={cn(
          'text-[7px] md:text-[8px] font-mono leading-tight text-center truncate max-w-[48px] md:max-w-[56px]',
          player.subbedOut ? 'text-white/20' : 'text-white/60',
        )}
      >
        {shortName}
      </span>
    </motion.div>
  );
}

// ── Pitch Row (distributes players evenly across width) ──────────────────────

function PitchRow({
  players,
  rowIndex,
  isHome,
}: {
  players: PitchPlayer[];
  rowIndex: number;
  isHome: boolean;
}) {
  if (players.length === 0) return null;

  return (
    <div className="flex items-center justify-around w-full px-1 md:px-2">
      {players.map((p, i) => (
        <PlayerNode
          key={`${p.jersey}-${p.name}`}
          player={p}
          index={rowIndex * 4 + i}
          isHome={isHome}
        />
      ))}
    </div>
  );
}

// ── Team Half (one side of the pitch) ────────────────────────────────────────

function TeamHalf({
  starters,
  formation,
  teamName,
  isHome,
  formationStr,
}: {
  starters: PitchPlayer[];
  formation: number[] | null;
  teamName: string;
  isHome: boolean;
  formationStr: string | null;
}) {
  const rows = useMemo(
    () => distributeToRows(starters, formation),
    [starters, formation],
  );

  // Home team: GK at bottom, attack at top (toward center)
  // Away team: GK at top, attack at bottom (toward center)
  const orderedRows = isHome ? [...rows].reverse() : rows;

  const shortName = teamName.split(' ').pop() ?? teamName;

  return (
    <div className="flex-1 flex flex-col justify-evenly py-1 md:py-3 relative min-h-0">
      {/* Formation badge */}
      {formationStr && (
        <div className={cn(
          'absolute z-10 start-2',
          isHome ? 'bottom-1' : 'top-1',
        )}>
          <span className="text-[8px] md:text-[9px] font-mono text-accent-green/40 bg-accent-green/[0.06] border border-accent-green/10 rounded px-1.5 py-0.5">
            {shortName} {formationStr}
          </span>
        </div>
      )}

      {orderedRows.map((row, i) => (
        <PitchRow
          key={i}
          players={row}
          rowIndex={isHome ? (orderedRows.length - 1 - i) : i}
          isHome={isHome}
        />
      ))}
    </div>
  );
}

// ── Pitch Markings (SVG) ─────────────────────────────────────────────────────

function PitchMarkings() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 200"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* Stroke uses CSS var for theme compatibility */}
      <g
        fill="none"
        stroke="var(--color-border-bright)"
        strokeWidth="0.4"
        opacity="0.35"
      >
        {/* Outer boundary */}
        <rect x="2" y="2" width="96" height="196" rx="1" />

        {/* Center line */}
        <line x1="2" y1="100" x2="98" y2="100" />

        {/* Center circle */}
        <circle cx="50" cy="100" r="12" />
        <circle cx="50" cy="100" r="0.8" fill="var(--color-border-bright)" />

        {/* Home penalty box (bottom) */}
        <rect x="22" y="168" width="56" height="30" />
        {/* Home goal box */}
        <rect x="32" y="184" width="36" height="14" />
        {/* Home penalty arc */}
        <path d="M 35 168 A 10 10 0 0 1 65 168" />
        {/* Home penalty spot */}
        <circle cx="50" cy="176" r="0.6" fill="var(--color-border-bright)" />

        {/* Away penalty box (top) */}
        <rect x="22" y="2" width="56" height="30" />
        {/* Away goal box */}
        <rect x="32" y="2" width="36" height="14" />
        {/* Away penalty arc */}
        <path d="M 35 32 A 10 10 0 0 0 65 32" />
        {/* Away penalty spot */}
        <circle cx="50" cy="24" r="0.6" fill="var(--color-border-bright)" />

        {/* Corner arcs */}
        <path d="M 2 5 A 3 3 0 0 0 5 2" />
        <path d="M 95 2 A 3 3 0 0 0 98 5" />
        <path d="M 2 195 A 3 3 0 0 1 5 198" />
        <path d="M 95 198 A 3 3 0 0 1 98 195" />
      </g>
    </svg>
  );
}

// ── Horizontal Pitch Markings (desktop) ──────────────────────────────────────

function PitchMarkingsHorizontal() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 200 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke="var(--color-border-bright)"
        strokeWidth="0.4"
        opacity="0.35"
      >
        {/* Outer boundary */}
        <rect x="2" y="2" width="196" height="96" rx="1" />

        {/* Center line */}
        <line x1="100" y1="2" x2="100" y2="98" />

        {/* Center circle */}
        <circle cx="100" cy="50" r="12" />
        <circle cx="100" cy="50" r="0.8" fill="var(--color-border-bright)" />

        {/* Home penalty box (left) */}
        <rect x="2" y="22" width="30" height="56" />
        {/* Home goal box */}
        <rect x="2" y="32" width="14" height="36" />
        {/* Home penalty arc */}
        <path d="M 32 35 A 10 10 0 0 0 32 65" />
        {/* Home penalty spot */}
        <circle cx="24" cy="50" r="0.6" fill="var(--color-border-bright)" />

        {/* Away penalty box (right) */}
        <rect x="168" y="22" width="30" height="56" />
        {/* Away goal box */}
        <rect x="184" y="32" width="14" height="36" />
        {/* Away penalty arc */}
        <path d="M 168 35 A 10 10 0 0 1 168 65" />
        {/* Away penalty spot */}
        <circle cx="176" cy="50" r="0.6" fill="var(--color-border-bright)" />

        {/* Corner arcs */}
        <path d="M 2 5 A 3 3 0 0 0 5 2" />
        <path d="M 195 2 A 3 3 0 0 0 198 5" />
        <path d="M 2 95 A 3 3 0 0 1 5 98" />
        <path d="M 195 98 A 3 3 0 0 1 198 95" />
      </g>
    </svg>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function TacticalPitch({
  homeFormation,
  awayFormation,
  homeStarters,
  awayStarters,
  homeTeam,
  awayTeam,
  rtl,
}: TacticalPitchProps) {
  const homeParsed = useMemo(() => parseFormation(homeFormation), [homeFormation]);
  const awayParsed = useMemo(() => parseFormation(awayFormation), [awayFormation]);

  // Need at least some starters for each team to render
  if (homeStarters.length < 5 || awayStarters.length < 5) return null;

  return (
    <>
      {/* ── VERTICAL PITCH (mobile) ── */}
      <div className="block md:hidden">
        <div
          className={cn(
            'relative w-full rounded-xl overflow-hidden',
            'bg-[var(--color-bg-card)] backdrop-blur-glass',
            'border border-border-subtle',
            'pitch-grass',
          )}
          style={{ aspectRatio: '3 / 4' }}
        >
          <PitchMarkings />

          {/* absolute inset-0 — h-full doesn't propagate from aspect-ratio containers */}
          <div className="absolute inset-0 z-[1] flex flex-col">
            {/* Away half (top — attacking downward) */}
            <TeamHalf
              starters={awayStarters}
              formation={awayParsed}
              teamName={awayTeam}
              isHome={false}
              formationStr={awayFormation}
            />

            {/* Center divider */}
            <div className="h-px w-full bg-border-bright/20 shrink-0" />

            {/* Home half (bottom — attacking upward) */}
            <TeamHalf
              starters={homeStarters}
              formation={homeParsed}
              teamName={homeTeam}
              isHome={true}
              formationStr={homeFormation}
            />
          </div>
        </div>
      </div>

      {/* ── HORIZONTAL PITCH (desktop/tablet) ── */}
      <div className="hidden md:block">
        <div
          className={cn(
            'relative w-full rounded-xl overflow-hidden',
            'bg-[var(--color-bg-card)] backdrop-blur-glass',
            'border border-border-subtle',
            'pitch-grass',
          )}
          style={{ aspectRatio: '2 / 1' }}
        >
          <PitchMarkingsHorizontal />

          {/* absolute inset-0 — h-full doesn't propagate from aspect-ratio containers */}
          <div className={cn(
            'absolute inset-0 z-[1] flex',
            rtl ? 'flex-row-reverse' : 'flex-row',
          )}>
            {/* Home half (left in LTR, right in RTL) */}
            <HorizontalTeamHalf
              starters={homeStarters}
              formation={homeParsed}
              teamName={homeTeam}
              isHome={true}
              formationStr={homeFormation}
              attackRight={!(rtl ?? false)}
            />

            {/* Center divider */}
            <div className="w-px self-stretch bg-border-bright/20 shrink-0" />

            {/* Away half (right in LTR, left in RTL) */}
            <HorizontalTeamHalf
              starters={awayStarters}
              formation={awayParsed}
              teamName={awayTeam}
              isHome={false}
              formationStr={awayFormation}
              attackRight={rtl ?? false}
            />
          </div>
        </div>
      </div>
    </>
  );
}

// ── Horizontal Team Half (desktop) ───────────────────────────────────────────

function HorizontalTeamHalf({
  starters,
  formation,
  teamName,
  isHome,
  formationStr,
  attackRight,
}: {
  starters: PitchPlayer[];
  formation: number[] | null;
  teamName: string;
  isHome: boolean;
  formationStr: string | null;
  attackRight: boolean;
}) {
  const rows = useMemo(
    () => distributeToRows(starters, formation),
    [starters, formation],
  );

  // attackRight = true → GK on left, forwards on right
  // attackRight = false → GK on right, forwards on left
  const orderedRows = attackRight ? rows : [...rows].reverse();

  const shortName = teamName.split(' ').pop() ?? teamName;

  return (
    <div className="flex-1 flex items-stretch relative">
      {/* Formation badge */}
      {formationStr && (
        <div className="absolute z-10 top-1 start-2">
          <span className="text-[9px] font-mono text-accent-green/40 bg-accent-green/[0.06] border border-accent-green/10 rounded px-1.5 py-0.5">
            {shortName} {formationStr}
          </span>
        </div>
      )}

      <div className="flex-1 flex items-stretch justify-evenly py-3 px-1">
        {orderedRows.map((row, colIdx) => (
          <div
            key={colIdx}
            className="flex flex-col items-center justify-evenly"
          >
            {row.map((p, i) => (
              <PlayerNode
                key={`${p.jersey}-${p.name}`}
                player={p}
                index={colIdx * 4 + i}
                isHome={isHome}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
