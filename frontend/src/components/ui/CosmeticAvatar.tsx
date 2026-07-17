// V5 Sprint 37 Commit 3 — "Profile Prestige & Cosmetics" render layer.
// Wraps the untouched Avatar.tsx (used at a dozen+ call sites) rather than
// adding frame/halo/badge props directly to it — keeps this feature's blast
// radius to the 3 call sites that actually need it (LeaderboardRow,
// ProfilePage's hero, ActivityFeed's human-event avatar).
//
// Frame: a rotating conic-gradient ring, reusing the exact technique
// ActivityFeed.tsx's AiBanterCard/HTAnalystCard/MomentumBanner/ChronicleCard
// already established — a bigger colored circle positioned BEHIND the
// avatar's own opaque disc, so only the rim shows (the same trick as a
// static Tailwind `ring-2`, just animated). No mask/clip-path needed.
//
// Halo: generalizes LeaderboardRow.tsx's existing rank-1-only breathing
// halo (opacity/scale only, GPU-safe) to any cosmetic color. An explicitly
// PURCHASED halo always wins over an auto-derived one (LeaderboardRow's
// rank-1 gold, ProfilePage's streak-tier halo) — pass the derived halo as
// `fallbackHalo` and it only renders when no cosmetic halo is equipped.
//
// Badge: a small corner pill, logical-position (`-end-`, rule 4.10) so it
// mirrors correctly under RTL.
import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Avatar } from './Avatar';
import { getCosmeticItem } from '../../lib/cosmeticsCatalog';
import { cn } from '../../lib/utils';
import { useLangStore } from '../../stores/langStore';

interface ActiveCosmetics {
  frame?: string | null;
  halo?: string | null;
  badge?: string | null;
}

interface CosmeticAvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  activeCosmetics?: ActiveCosmetics | null;
  className?: string;
  /** Rendered only when no cosmetic halo is equipped — see file header. */
  fallbackHalo?: ReactNode;
}

export function CosmeticAvatar({ src, name, size = 'md', activeCosmetics, className, fallbackHalo }: CosmeticAvatarProps) {
  const reduceMotion = useReducedMotion();
  const { lang } = useLangStore();
  const frameItem = getCosmeticItem(activeCosmetics?.frame);
  const haloItem = getCosmeticItem(activeCosmetics?.halo);
  const badgeItem = getCosmeticItem(activeCosmetics?.badge);

  return (
    <div className="relative isolate shrink-0">
      {haloItem ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -z-10 -inset-3 rounded-full blur-lg"
          style={{ background: `radial-gradient(circle, ${haloItem.color} 0%, transparent 70%)` }}
          animate={reduceMotion ? { opacity: 0.55 } : { opacity: [0.4, 0.75, 0.4], scale: [1, 1.1, 1] }}
          transition={reduceMotion ? undefined : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : (
        fallbackHalo
      )}

      {frameItem && (
        <motion.div
          aria-hidden
          className="absolute -inset-[2.5px] rounded-full"
          style={{
            background: `conic-gradient(from 0deg, ${frameItem.color}, ${frameItem.colorSecondary ?? frameItem.color}, ${frameItem.color})`,
          }}
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={reduceMotion ? undefined : { duration: 5, ease: 'linear', repeat: Infinity }}
        />
      )}

      <Avatar src={src} name={name} size={size} className={cn('relative z-10', className)} />

      {badgeItem && (
        <div
          aria-hidden
          title={lang === 'he' ? badgeItem.nameHe : badgeItem.nameEn}
          className="absolute -bottom-0.5 -end-0.5 z-20 w-4 h-4 rounded-full flex items-center justify-center text-[8px] leading-none ring-2"
          style={{ background: badgeItem.color, ['--tw-ring-color' as string]: 'var(--color-bg-base)' }}
        >
          ✦
        </div>
      )}
    </div>
  );
}
