import { useState } from 'react';
import { getInitials, cn } from '../../lib/utils';
import { hashTeamHue } from '../../lib/oklch';

interface EntityBadgeProps {
  /** Image URL. Missing/null/empty renders the fallback immediately — no failed request. */
  src?: string | null;
  /** Alt text / accessible name — the current display name, may be localized. */
  name: string;
  /**
   * Hash seed for the fallback gradient + initials — the original,
   * untranslated (English) name. Defaults to `name` when omitted (e.g. a
   * league name with no Hebrew variant). Kept separate from `name` on
   * purpose: hashing the possibly-Hebrew display name would flip a team's
   * fallback gradient AND initials every time the viewer toggles language —
   * the exact bug already fixed once for teamHaloColor()'s haloKey input
   * (Sprint 24). Same fix, same reasoning, applied here from the start.
   */
  hashSeed?: string;
  /** Pixel size (both width and height — always square, rule 4.16 numeric attrs). */
  size: number;
  className?: string;
  loading?: 'lazy' | 'eager';
  title?: string;
}

/**
 * Sprint 26 — generalizes Avatar.tsx's proven image-error -> fallback state
 * machine for team/league badges. Avatar.tsx's own InitialsFallback uses a
 * fixed brand gradient (fine for user avatars, one shared identity); a badge
 * needs a per-entity gradient so dozens of different teams stay visually
 * distinct, so this reuses hashTeamHue (lib/oklch.ts, exported this sprint)
 * instead of a fixed fill — the same hash teamHaloColor() already uses, no
 * second implementation.
 *
 * Renders a plain gradient <div> (not inline SVG defs) specifically to avoid
 * <linearGradient id="..."> collisions when many badges render on one page
 * (a match feed can show dozens simultaneously) — a CSS background-image
 * gradient needs no id at all.
 *
 * V6 Sprint 43 briefly wrapped this in a specular-sweep <div> (a
 * `prestige`-tier holographic finish); reverted the same day after a live
 * report of visible corruption in production (a wrapper div that didn't
 * carry the caller's `.league-logo-dark`/`.league-logo-light` toggle class
 * stayed rendered/visible even while its inner <img> was display:none —
 * see CLAUDE.md §58's addendum). Back to the plain img/fallback-div shape
 * with no wrapper.
 */
export function EntityBadge({ src, name, hashSeed, size, className, loading = 'lazy', title }: EntityBadgeProps) {
  const [imgError, setImgError] = useState(false);

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name}
        title={title}
        width={size}
        height={size}
        loading={loading}
        onError={() => setImgError(true)}
        className={cn('object-contain', className)}
      />
    );
  }

  const seed = hashSeed ?? name;
  const hue = hashTeamHue(seed);
  const hue2 = (hue + 42) % 360;

  return (
    <div
      role="img"
      aria-label={name}
      title={title}
      className={cn(
        'rounded-full flex items-center justify-center font-bebas tracking-wider text-white ring-1 ring-white/15 shrink-0',
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.34),
        background: `linear-gradient(135deg, oklch(58% 0.13 ${hue}) 0%, oklch(46% 0.15 ${hue2}) 100%)`,
      }}
    >
      {getInitials(seed)}
    </div>
  );
}
