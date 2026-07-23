import { motion, LayoutGroup } from 'framer-motion';
import { cn, formatSeasonLabel } from '../../lib/utils';
import { useLangStore } from '../../stores/langStore';
import type { ArchivedSeasonSummary } from '../../hooks/useLeagueStats';

// V7 Sprint 56 follow-up — The Season Archive. Hidden entirely
// (`return null`) when zero seasons have been archived yet for this
// league — the same "hidden until real data exists" convention this
// codebase already applies to MatchTimeline/AIScoutCard/PulseFeed/etc.
// The archive only starts accumulating from whenever this feature first
// deployed (see seasonArchive.ts's header comment) — a brand-new league or
// one this backend hasn't yet completed a season for will legitimately show
// nothing here for a while, which is honest, not a bug.
interface SeasonSelectorProps {
  seasons: ArchivedSeasonSummary[];
  selectedSeason: number | null; // null = current/live season
  onSelect: (season: number | null) => void;
}

export function SeasonSelector({ seasons, selectedSeason, onSelect }: SeasonSelectorProps) {
  const { t } = useLangStore();
  if (seasons.length === 0) return null;

  const options: { id: number | null; label: string }[] = [
    { id: null, label: t('statsSeasonCurrent') },
    ...seasons.map(s => ({ id: s.season, label: formatSeasonLabel(s.season) })),
  ];

  return (
    <LayoutGroup id="stats-season-selector">
      <div
        className="flex gap-1 overflow-x-auto rounded-full border border-border-subtle bg-bg-card/60 p-1"
        data-lenis-prevent
      >
        {options.map(opt => {
          const isActive = selectedSeason === opt.id;
          return (
            <button
              key={String(opt.id)}
              type="button"
              onClick={() => onSelect(opt.id)}
              className={cn(
                'relative shrink-0 rounded-full px-3 py-1 font-mono text-[11px] font-semibold tabular-nums transition-colors',
                isActive ? 'text-white' : 'text-text-muted hover:text-white/80',
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="statsSeasonSelectorPill"
                  className="absolute inset-0 rounded-full bg-accent-secondary/20 ring-1 ring-accent-secondary/40"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative z-10">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
