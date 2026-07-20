/**
 * V6 Sprint 46 — extracted out of LeaderboardRow.tsx (was module-private)
 * the moment a second real consumer (WeeklyPodiumModal.tsx) needed the
 * identical rank -> ring/shadow/size/background mapping. The same
 * "extract on the second real consumer" precedent as lib/tierVisuals.ts /
 * lib/espnEvents.ts / lib/teamNameUtils.ts. LeaderboardRow.tsx re-imports
 * from here with zero visual diff.
 */
export const PODIUM_STYLES: Record<number, { ring: string; shadow: string; avatarSize: 'md' | 'lg' | 'xl'; bg: string }> = {
  1: { ring: 'ring-2 ring-amber-400/70', shadow: 'drop-shadow-[0_0_14px_rgba(232,160,32,0.35)]', avatarSize: 'xl', bg: 'bg-amber-500/5' },
  2: { ring: 'ring-2 ring-slate-300/60', shadow: 'drop-shadow-[0_0_10px_rgba(200,200,200,0.25)]', avatarSize: 'lg', bg: 'bg-white/5' },
  3: { ring: 'ring-2 ring-amber-700/60', shadow: 'drop-shadow-[0_0_8px_rgba(180,100,50,0.25)]', avatarSize: 'lg', bg: 'bg-orange-900/10' },
};
