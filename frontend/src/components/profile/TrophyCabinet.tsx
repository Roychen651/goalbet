import { Lock, Trophy as TrophyIcon } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { useLangStore } from '../../stores/langStore';
import { TranslationKey } from '../../lib/i18n';

// Sprint 22 — Trophy Cabinet. These badges are computed on the fly from
// data already on this page (same honesty class as LeaderboardRow.tsx's
// existing inline badgeHot/badgeSniper pills — un-persisted, no unlock
// timestamp) rather than a new "achievement" DB entity. A generic,
// persisted, unlock-timestamped achievement system is a real, separate
// backend feature (migration + unlock-detection service + RLS) that this
// visual-overhaul sprint deliberately does not invent — see the Sprint 22
// blueprint corrections in CLAUDE.md. Locked badges render dimmed, never
// hidden, so the cabinet reads as a real collection to work toward.

interface TrophyIconProps {
  className?: string;
}

function IconSniper({ className }: TrophyIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

function IconCenturyClub({ className }: TrophyIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path
        d="M12 2l2.9 6.26 6.9.6-5.2 4.53 1.6 6.77L12 16.9l-6.2 3.26 1.6-6.77L2.2 8.86l6.9-.6L12 2z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconIronStreak({ className }: TrophyIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path
        d="M12 2.5c-1 3.2-5 5.4-5 10.3a5 5 0 0 0 10 0c0-2.1-1.1-3.3-2.1-4.3.1 2-1 3.1-2 3.1a1.9 1.9 0 0 1-1.9-1.9c0-2.1 2-4.2 1-7.2z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconSharpshooter({ className }: TrophyIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" opacity="0.5" />
      <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.4" opacity="0.75" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 21l6.5-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3 21l2-.4.4-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconVeteran({ className }: TrophyIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 2.5l7.5 2.8v5.3c0 4.6-3.2 8.4-7.5 10-4.3-1.6-7.5-5.4-7.5-10V5.3L12 2.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8.5 12.2l2.4 2.4 4.6-4.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconHighRoller({ className }: TrophyIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <ellipse cx="12" cy="16" rx="8" ry="4" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="12" cy="12.5" rx="8" ry="4" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="12" cy="9" rx="8" ry="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M19.5 4l.7 1.6L22 6.3l-1.8.7-.7 1.6-.7-1.6L17 6.3l1.8-.7.7-1.6z" fill="currentColor" />
    </svg>
  );
}

interface BadgeDef {
  key: string;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  earned: boolean;
  accent: string;
  Icon: (props: TrophyIconProps) => JSX.Element;
}

export interface TrophyCabinetStats {
  accuracyPct: number;
  picksMade: number;
  totalPoints: number;
  currentStreak: number;
  exactScoreCount: number;
  resolvedCount: number;
  boldnessRatio: number; // 0..1, already computed for the radar's Boldness axis
}

export function TrophyCabinet({ stats }: { stats: TrophyCabinetStats }) {
  const { t } = useLangStore();

  const badges: BadgeDef[] = [
    {
      key: 'sniper', nameKey: 'trophySniperName', descKey: 'trophySniperDesc',
      earned: stats.accuracyPct >= 65 && stats.picksMade >= 5,
      accent: 'var(--color-accent-green)', Icon: IconSniper,
    },
    {
      key: 'century', nameKey: 'trophyCenturyName', descKey: 'trophyCenturyDesc',
      earned: stats.totalPoints >= 100,
      accent: 'var(--risk-gold)', Icon: IconCenturyClub,
    },
    {
      key: 'ironStreak', nameKey: 'trophyIronStreakName', descKey: 'trophyIronStreakDesc',
      earned: stats.currentStreak >= 8,
      accent: 'var(--streak-ember)', Icon: IconIronStreak,
    },
    {
      key: 'sharpshooter', nameKey: 'trophySharpshooterName', descKey: 'trophySharpshooterDesc',
      earned: stats.exactScoreCount >= 5,
      accent: '#c084fc', Icon: IconSharpshooter, // matches the existing violet "Best Tier" card accent
    },
    {
      key: 'veteran', nameKey: 'trophyVeteranName', descKey: 'trophyVeteranDesc',
      earned: stats.resolvedCount >= 25,
      accent: 'var(--color-accent-secondary)', Icon: IconVeteran,
    },
    {
      key: 'highRoller', nameKey: 'trophyHighRollerName', descKey: 'trophyHighRollerDesc',
      earned: stats.boldnessRatio >= 0.7,
      accent: 'var(--risk-warning)', Icon: IconHighRoller,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-center gap-1.5 mb-3">
        <TrophyIcon size={16} className="text-white/50" />
        <span className="font-bebas text-lg tracking-wider text-white">{t('trophyCabinetTitle')}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {badges.map(badge => (
          <GlassCard
            key={badge.key}
            tactile
            className="p-3 flex flex-col items-center text-center gap-1"
          >
            <div
              className="w-10 h-10 flex items-center justify-center"
              style={{
                color: badge.earned ? badge.accent : 'var(--color-text-muted)',
                filter: badge.earned ? `drop-shadow(0 0 6px ${badge.accent})` : 'none',
                opacity: badge.earned ? 1 : 0.35,
              }}
            >
              <badge.Icon className="w-full h-full" />
            </div>
            <span className={`font-display text-xs font-semibold truncate max-w-full ${badge.earned ? 'text-white' : 'text-text-muted'}`}>
              {t(badge.nameKey)}
            </span>
            <span className="text-[9px] leading-tight text-text-muted opacity-70 line-clamp-2">
              {t(badge.descKey)}
            </span>
            {!badge.earned && (
              <span className="mt-0.5 inline-flex items-center gap-0.5 text-[8px] text-text-muted/60 uppercase tracking-wide">
                <Lock size={8} /> {t('trophyLocked')}
              </span>
            )}
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
