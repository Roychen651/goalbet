// Sprint 25 — extracted out of PredictionForm.tsx the moment a second
// consumer (the Bento Almanac's Tier Ledger card) needed the identical
// 5-color tier system. Same precedent as lib/espnEvents.ts (Sprint 19) and
// lib/teamNameUtils.ts (Sprint 24): extract on the second real consumer,
// don't duplicate a second hardcoded copy of the same values.
//
// Index order is the CANONICAL 5-tier order (Result / Score / Corners /
// BTTS / Over-Under) — always fixed here, unlike PredictionForm.tsx's own
// per-match `tiers` array, whose length (and therefore which index maps to
// which tier) shifts when a league has corners disabled
// (LEAGUES_WITHOUT_CORNERS). Consumers that need the canonical ledger
// (the Almanac) should index this array directly by tier number; consumers
// that build a per-match tier list (PredictionForm.tsx) keep computing
// their own positional index against this same array.

// Sprint 20 — `emboss` replaces `glow` as the selected-chip shadow: an inner
// light-catch (reads as raised/lit from above) plus an outward glow in the
// tier's own color, instead of a bare outward glow alone. `glow` itself is
// kept (still referenced by TierRow's point label, unrelated to the chip
// shadow).
export const TIER_COLORS = [
  { dot: 'bg-emerald-400', pts: 'text-emerald-400', glow: 'shadow-[0_0_12px_rgba(52,211,153,0.3)]',  emboss: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_3px_10px_-2px_rgba(52,211,153,0.45)]' },
  { dot: 'bg-yellow-400',  pts: 'text-yellow-400',  glow: 'shadow-[0_0_12px_rgba(234,179,8,0.3)]',   emboss: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_3px_10px_-2px_rgba(234,179,8,0.45)]'  },
  { dot: 'bg-blue-400',    pts: 'text-blue-400',    glow: 'shadow-[0_0_12px_rgba(96,165,250,0.3)]',  emboss: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_3px_10px_-2px_rgba(96,165,250,0.45)]'  },
  { dot: 'bg-orange-400',  pts: 'text-orange-400',  glow: 'shadow-[0_0_12px_rgba(251,146,60,0.3)]',  emboss: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_3px_10px_-2px_rgba(251,146,60,0.45)]'  },
  { dot: 'bg-purple-400',  pts: 'text-purple-400',  glow: 'shadow-[0_0_12px_rgba(192,132,252,0.3)]', emboss: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_3px_10px_-2px_rgba(192,132,252,0.45)]' },
];

// Shared "debossed" (sunken-into-the-surface) shadow for unselected chips —
// deliberately NOT per-tier colored; only the selected state should carry
// tier identity, so an unselected chip always recedes the same neutral way.
export const DEBOSS_SHADOW = 'shadow-[inset_0_1px_3px_rgba(0,0,0,0.3),inset_0_-1px_0_rgba(255,255,255,0.03)]';
