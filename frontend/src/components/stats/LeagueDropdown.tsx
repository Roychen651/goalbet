import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLangStore } from '../../stores/langStore';

interface League {
  id: number;
  name: string;
  country: string;
  badge: string;
  espnLogoId: number | null;
}

interface Props {
  leagues: readonly League[];
  value: number | null;
  onChange: (id: number) => void;
}

const logoUrl = (id: number | null) =>
  id ? `https://a.espncdn.com/i/leaguelogos/soccer/500-dark/${id}.png` : null;

export function LeagueDropdown({ leagues, value, onChange }: Props) {
  const { t } = useLangStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = leagues.find(l => l.id === value);

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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('statsSelectLeague')}
        className={cn(
          'group flex items-center gap-3 h-12 ps-3 pe-3 min-w-[240px]',
          'rounded-xl bg-bg-card border transition-all duration-200 active:scale-[0.98]',
          open
            ? 'border-accent-green/50 bg-accent-green/5'
            : 'border-border-subtle hover:border-border-bright hover:bg-white/5',
        )}
      >
        {selected?.espnLogoId ? (
          <img
            src={logoUrl(selected.espnLogoId)!}
            alt={selected.name}
            width={24}
            height={24}
            className="w-6 h-6 object-contain shrink-0"
          />
        ) : (
          <span className="text-lg leading-none shrink-0 w-6 text-center">
            {selected?.badge ?? '⚽'}
          </span>
        )}
        <div className="flex-1 min-w-0 text-start">
          <div className="text-white font-semibold text-sm truncate leading-tight">
            {selected?.name ?? t('statsSelectLeague')}
          </div>
          <div className="text-text-muted text-[10px] uppercase tracking-wider truncate leading-tight mt-0.5">
            {selected?.country ?? '—'}
          </div>
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' as const }}
          className="shrink-0"
        >
          <ChevronDown
            size={16}
            className={cn(
              'transition-colors',
              open ? 'text-accent-green' : 'text-text-muted group-hover:text-white',
            )}
          />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            className={cn(
              'absolute z-50 top-full mt-2 end-0 w-[280px]',
              'rounded-xl border border-border-subtle overflow-hidden',
              'shadow-[0_12px_40px_rgba(0,0,0,0.5)]',
            )}
            style={{ background: 'var(--color-tooltip-bg)' }}
          >
            <div className="max-h-[340px] overflow-y-auto p-1.5">
              {leagues.map((l, i) => {
                const isActive = l.id === value;
                return (
                  <motion.button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      onChange(l.id);
                      setOpen(false);
                    }}
                    role="option"
                    aria-selected={isActive}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.015, duration: 0.15 }}
                    className={cn(
                      'w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-start',
                      'transition-colors duration-150',
                      isActive
                        ? 'bg-accent-green/10 text-accent-green'
                        : 'text-white hover:bg-white/5',
                    )}
                  >
                    {l.espnLogoId ? (
                      <img
                        src={logoUrl(l.espnLogoId)!}
                        alt={l.name}
                        width={22}
                        height={22}
                        className="w-[22px] h-[22px] object-contain shrink-0"
                      />
                    ) : (
                      <span className="text-base w-[22px] text-center shrink-0">{l.badge}</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate leading-tight">{l.name}</div>
                      <div
                        className={cn(
                          'text-[10px] uppercase tracking-wider truncate leading-tight mt-0.5',
                          isActive ? 'text-accent-green/70' : 'text-text-muted',
                        )}
                      >
                        {l.country}
                      </div>
                    </div>
                    {isActive && (
                      <Check size={16} className="shrink-0" strokeWidth={2.5} />
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
