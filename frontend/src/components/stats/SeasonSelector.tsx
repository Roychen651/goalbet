import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, CalendarClock } from 'lucide-react';
import { cn, formatSeasonLabel } from '../../lib/utils';
import { useLangStore } from '../../stores/langStore';
import type { ArchivedSeasonSummary } from '../../hooks/useLeagueStats';

// V7 Sprint 56 follow-up — The Season Archive. V7 Sprint 57 — rebuilt from
// a pill row into a real dropdown (matching LeagueDropdown.tsx's exact
// visual language — same trigger/panel shape, click-outside + Escape
// close, layoutId active-bar, checkmark) per an explicit live request for
// a "דרופ דאון" (dropdown), and extended to include the TRUE current
// season (real teams, honestly zero stats if it hasn't started) as its
// own selectable option — separate from the "Current" smart default,
// which silently substitutes the last completed season when the live one
// has no real table yet (see stats.ts's getLeagueStats() fallback). Both
// options only differ when the season genuinely hasn't started; when it
// has, `showCurrentOption` is false and there's nothing to duplicate.
//
// Still hidden entirely when there is truly nothing to select from (no
// archived seasons AND no true-current option) — same "hidden until real
// data exists" convention every other category in this app follows.
export type SeasonSelectorValue = number | 'current' | null;

interface SeasonSelectorProps {
  seasons: ArchivedSeasonSummary[];
  selectedSeason: SeasonSelectorValue;
  onSelect: (season: SeasonSelectorValue) => void;
  /** True current season number (never the fallback-substituted one) — only used when showCurrentOption is true. */
  currentSeasonNumber: number | null;
  /** Only true when the smart-default view is currently substituting the last completed season — i.e. there's something distinct to show. */
  showCurrentOption: boolean;
  /** Whether the true current season has any real (gp>0) rows yet — drives the "not started" badge. */
  currentSeasonStarted: boolean;
}

export function SeasonSelector({
  seasons,
  selectedSeason,
  onSelect,
  currentSeasonNumber,
  showCurrentOption,
  currentSeasonStarted,
}: SeasonSelectorProps) {
  const { t } = useLangStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (seasons.length === 0 && !showCurrentOption) return null;

  const options: { id: SeasonSelectorValue; label: string; badge?: string }[] = [
    { id: null, label: t('statsSeasonCurrent') },
    ...(showCurrentOption && currentSeasonNumber != null
      ? [{ id: 'current' as const, label: formatSeasonLabel(currentSeasonNumber), badge: currentSeasonStarted ? undefined : t('statsSeasonNotStarted') }]
      : []),
    ...seasons.map(s => ({ id: s.season, label: formatSeasonLabel(s.season) })),
  ];

  const selectedOption = options.find(o => o.id === selectedSeason) ?? options[0];

  return (
    <div ref={ref} className="relative">
      <motion.button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('statsSelectSeason')}
        whileTap={{ scale: 0.97 }}
        className={cn(
          'group relative flex items-center gap-2 h-9 ps-2.5 pe-2 rounded-full border backdrop-blur-glass',
          'transition-colors duration-200',
          open ? 'border-accent-secondary/50' : 'border-border-subtle hover:border-border-bright',
        )}
        style={{ background: 'var(--color-bg-card)' }}
      >
        <CalendarClock size={13} className={cn(open ? 'text-accent-secondary' : 'text-text-muted')} />
        <span className="font-mono text-[11px] font-semibold tabular-nums text-white">{selectedOption.label}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2, ease: 'easeOut' as const }}>
          <ChevronDown size={12} className="text-text-muted" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="absolute z-50 top-full mt-2 start-0 w-[200px] rounded-2xl border border-border-subtle overflow-hidden shadow-[0_20px_60px_-12px_rgba(0,0,0,0.55)]"
            style={{ background: 'var(--color-tooltip-bg)', transformOrigin: 'top' }}
          >
            <div className="flex items-center justify-between px-3 pt-2.5 pb-2 border-b border-border-subtle/80">
              <span className="font-barlow text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
                {t('statsSelectSeason')}
              </span>
            </div>

            <div data-lenis-prevent className="max-h-[280px] overflow-y-auto overscroll-contain p-1.5">
              {options.map((opt, i) => {
                const isActive = opt.id === selectedSeason;
                return (
                  <motion.button
                    key={String(opt.id)}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      onSelect(opt.id);
                      setOpen(false);
                    }}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.16, ease: 'easeOut' as const }}
                    whileHover={{ x: 2 }}
                    className={cn(
                      'relative w-full flex items-center gap-2 h-10 px-2.5 rounded-lg text-start',
                      'transition-colors duration-150',
                      isActive ? 'bg-accent-secondary/10 text-accent-secondary' : 'text-white hover:bg-white/5',
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="statsSeasonSelectorActiveBar"
                        aria-hidden
                        className="absolute start-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-accent-secondary"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}

                    <span className="flex-1 min-w-0 font-mono text-xs font-semibold tabular-nums truncate">
                      {opt.label}
                    </span>

                    {opt.badge && (
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-accent-orange bg-accent-orange/10 border border-accent-orange/25 rounded-full px-1.5 py-0.5 leading-none">
                        {opt.badge}
                      </span>
                    )}

                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        className="shrink-0 w-5 h-5 rounded-full bg-accent-secondary/15 border border-accent-secondary/30 flex items-center justify-center"
                      >
                        <Check size={11} strokeWidth={3} />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
