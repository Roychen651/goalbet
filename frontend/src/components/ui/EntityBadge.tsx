import { useRef, useState } from 'react';
import { getInitials, cn } from '../../lib/utils';
import { hashTeamHue } from '../../lib/oklch';
import { useTactileTilt } from '../../hooks/useTactileTilt';

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
  /**
   * V6 Sprint 43 — opt-in metallic/holographic tier: real 3D pointer tilt
   * (useTactileTilt) plus an overlay-blended specular sheen. Every badge
   * already gets the CSS-only sweep below for free; `prestige` is reserved
   * for genuinely single-instance, high-profile contexts (a Champions
   * League/World Cup league logo rendered once per card) and must never be
   * set app-wide across a feed of many simultaneous badges — the same
   * "single/rare instance -> JS tilt, many instances -> CSS-only" split
   * this codebase already applies to allowGyroscope (Sprint 16), Trophy
   * Cabinet (Sprint 22), and ParlaySlipDrawer (Sprint 34).
   */
  prestige?: boolean;
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
 * V6 Sprint 43 — wrapped in a sizing `<div>` that owns the specular sweep
 * (index.css's .badge-sweep / .badge-prestige) so both branches below —
 * a real image AND the gradient-initials fallback — get IDENTICAL lighting
 * treatment, structurally: the wrapper doesn't know or care which one
 * rendered inside it. The wrapper is deliberately a *separate* class list
 * from `className`, which still applies to the inner <img>/<div> exactly as
 * before (theme-toggle classes like `league-logo-dark`, sizing utilities,
 * `rounded-full`) — this preserves 100% of every existing call site's
 * visual output; the wrapper only adds new chrome around it, never changes
 * what was already there.
 */
export function EntityBadge({ src, name, hashSeed, size, className, loading = 'lazy', title, prestige = false }: EntityBadgeProps) {
  const [imgError, setImgError] = useState(false);
  const [touched, setTouched] = useState(false);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // enabled: prestige — a non-prestige badge attaches zero pointer listeners
  // at all (useTactileTilt's own "master off means nothing attached, not a
  // smaller effect" contract), so the dozens-of-badges-per-feed case never
  // pays for a hook it isn't using.
  const tiltRef = useTactileTilt<HTMLDivElement>({ enabled: prestige, max: 10 });

  // Mobile "touch/drag" sweep trigger — index.css's own comment on
  // .badge-sweep explains why this can't be a bare :active/:hover: iOS
  // Safari fires :hover on tap with no mouse to ever "leave", leaving the
  // sweep stuck. A real, explicit touch-driven class with a short linger
  // (260ms) reads as a genuine reflection on tap instead of an instant
  // flicker, and always resolves back to false — never sticky.
  const handleTouchStart = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    setTouched(true);
  };
  const handleTouchEnd = () => {
    touchTimerRef.current = setTimeout(() => setTouched(false), 260);
  };

  const content = src && !imgError ? (
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
  ) : (
    (() => {
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
    })()
  );

  return (
    <div
      ref={tiltRef}
      className={cn('relative shrink-0 badge-sweep', prestige && 'badge-prestige', touched && 'badge-touched')}
      style={{ width: size, height: size }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {content}
    </div>
  );
}
