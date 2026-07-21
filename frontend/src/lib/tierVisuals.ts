// Sprint 25 — extracted out of PredictionForm.tsx the moment a second
// consumer (the Bento Almanac's Tier Ledger card) needed the identical
// 5-color tier system. Same precedent as lib/espnEvents.ts (Sprint 19) and
// lib/teamNameUtils.ts (Sprint 24): extract on the second real consumer,
// don't duplicate a second hardcoded copy of the same values.
//
// Index order is the CANONICAL 5-tier order (Result / Score / Corners /
// BTTS / Over-Under). V4 Sprint 26 — PredictionForm.tsx's own per-match
// `tiers` array now matches this same fixed order too: the Corners tier
// used to be conditionally spread OUT of the array entirely for
// LEAGUES_WITHOUT_CORNERS leagues (shifting every later index), but it's
// now always present — just conditionally `disabled` with an explanatory
// tooltip instead of silently missing. Both consumers can index this array
// positionally with no special-casing.

// V6 Sprint 50 — re-derived from raw default Tailwind hues (emerald-400/
// yellow-400/blue-400/orange-400/purple-400 — literally the "hue-wheel
// default, not derived" pattern color-system-custom flags) to a real,
// designed OKLCH set: one consistent L/C recipe (72% lightness, ~0.19
// chroma, tuned per-hue for perceptual balance) sweeping 5 well-separated
// hues (~60-90 degree gaps) rather than 5 unrelated default swatches. This
// is a categorical identity set (5 fixed tiers, not an interpolated
// 2-stop scale like --arena-cold/hot etc.), so plain hardcoded OKLCH
// literals via Tailwind arbitrary values is the right shape here — same
// as this file always did, just derived values instead of picked-by-name
// Tailwind classes. Tailwind arbitrary-value syntax requires underscores
// in place of spaces inside [...]; slashes (alpha) are literal.
//
// Sprint 20 — `emboss` replaces `glow` as the selected-chip shadow: an inner
// light-catch (reads as raised/lit from above) plus an outward glow in the
// tier's own color, instead of a bare outward glow alone. `glow` itself is
// kept (still referenced by TierRow's point label, unrelated to the chip
// shadow). V6 Sprint 50 deepens `emboss` into a genuine two-layer read (a
// bright top rim-light + a NEW dark inner shadow at the bottom edge, then
// the outward glow) — a real "raised glass key" depth instead of a single
// flat inset line, and widens the outward glow's spread/blur for more
// presence. `DEBOSS_SHADOW` (below) gets the matching idle-state deepening:
// a larger inset blur/spread reads as more genuinely sunken, not just a
// thin 1px groove.
export const TIER_COLORS = [
  {
    dot: 'bg-[oklch(72%_0.19_155)]',
    pts: 'text-[oklch(72%_0.19_155)]',
    glow: 'shadow-[0_0_16px_oklch(72%_0.19_155_/_0.4)]',
    emboss: 'shadow-[inset_0_1.5px_0_oklch(100%_0_0_/_0.22),inset_0_-3px_5px_oklch(0%_0_0_/_0.25),0_5px_18px_-3px_oklch(72%_0.19_155_/_0.6)]',
  },
  {
    dot: 'bg-[oklch(78%_0.16_85)]',
    pts: 'text-[oklch(78%_0.16_85)]',
    glow: 'shadow-[0_0_16px_oklch(78%_0.16_85_/_0.4)]',
    emboss: 'shadow-[inset_0_1.5px_0_oklch(100%_0_0_/_0.22),inset_0_-3px_5px_oklch(0%_0_0_/_0.25),0_5px_18px_-3px_oklch(78%_0.16_85_/_0.6)]',
  },
  {
    dot: 'bg-[oklch(70%_0.18_245)]',
    pts: 'text-[oklch(70%_0.18_245)]',
    glow: 'shadow-[0_0_16px_oklch(70%_0.18_245_/_0.4)]',
    emboss: 'shadow-[inset_0_1.5px_0_oklch(100%_0_0_/_0.22),inset_0_-3px_5px_oklch(0%_0_0_/_0.25),0_5px_18px_-3px_oklch(70%_0.18_245_/_0.6)]',
  },
  {
    dot: 'bg-[oklch(72%_0.19_45)]',
    pts: 'text-[oklch(72%_0.19_45)]',
    glow: 'shadow-[0_0_16px_oklch(72%_0.19_45_/_0.4)]',
    emboss: 'shadow-[inset_0_1.5px_0_oklch(100%_0_0_/_0.22),inset_0_-3px_5px_oklch(0%_0_0_/_0.25),0_5px_18px_-3px_oklch(72%_0.19_45_/_0.6)]',
  },
  {
    dot: 'bg-[oklch(68%_0.20_305)]',
    pts: 'text-[oklch(68%_0.20_305)]',
    glow: 'shadow-[0_0_16px_oklch(68%_0.20_305_/_0.4)]',
    emboss: 'shadow-[inset_0_1.5px_0_oklch(100%_0_0_/_0.22),inset_0_-3px_5px_oklch(0%_0_0_/_0.25),0_5px_18px_-3px_oklch(68%_0.20_305_/_0.6)]',
  },
];

// Shared "debossed" (sunken-into-the-surface) shadow for unselected chips —
// deliberately NOT per-tier colored; only the selected state should carry
// tier identity, so an unselected chip always recedes the same neutral way.
// V6 Sprint 50 — deepened blur/spread (was a thin 3px groove) for a
// genuinely sunken "glass key" read at rest, not just a flat outline.
export const DEBOSS_SHADOW = 'shadow-[inset_0_2px_5px_rgba(0,0,0,0.4),inset_0_-1px_0_rgba(255,255,255,0.05)]';
