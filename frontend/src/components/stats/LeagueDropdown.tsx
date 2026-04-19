import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Trophy } from 'lucide-react';
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

const darkLogoUrl = (id: number) =>
  `https://a.espncdn.com/i/leaguelogos/soccer/500-dark/${id}.png`;
const lightLogoUrl = (id: number) =>
  `https://a.espncdn.com/i/leaguelogos/soccer/500/${id}.png`;

function LeagueLogo({
  league,
  size,
}: {
  league: League;
  size: number;
}) {
  const hide = (e: React.SyntheticEvent<HTMLImageElement>) => {
    (e.currentTarget as HTMLImageElement).style.display = 'none';
  };
  if (league.espnLogoId == null) {
    return (
      <span
        className="leading-none text-center select-none"
        style={{ fontSize: Math.round(size * 0.7) }}
      >
        {league.badge}
      </span>
    );
  }
  return (
    <>
      <img
        src={darkLogoUrl(league.espnLogoId)}
        alt={league.name}
        width={size}
        height={size}
        className="object-contain league-logo-dark"
        style={{ width: size, height: size }}
        onError={hide}
      />
      <img
        src={lightLogoUrl(league.espnLogoId)}
        alt={league.name}
        width={size}
        height={size}
        className="object-contain league-logo-light"
        style={{ width: size, height: size }}
        onError={hide}
      />
    </>
  );
}

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
      {/* ─────────── Trigger ─────────── */}
      <motion.button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('statsSelectLeague')}
        whileTap={{ scale: 0.985 }}
        className={cn(
          'group relative flex items-center gap-3 h-14 ps-2 pe-3 min-w-[260px] w-full sm:w-auto',
          'rounded-2xl border backdrop-blur-xl overflow-hidden',
          'transition-colors duration-200',
          open
            ? 'border-accent-green/50'
            : 'border-border-subtle hover:border-border-bright',
        )}
        style={{
          background:
            'linear-gradient(135deg, var(--color-bg-card) 0%, rgba(73,136,196,0.08) 100%)',
        }}
      >
        {/* accent edge — left vertical bar */}
        <span
          aria-hidden
          className={cn(
            'absolute start-0 top-2 bottom-2 w-[3px] rounded-full transition-opacity duration-200',
            open ? 'opacity-100 bg-accent-green' : 'opacity-0',
          )}
        />

        {/* Logo tile */}
        <div
          className={cn(
            'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
            'bg-white/5 border border-white/8',
            'transition-transform duration-300 group-hover:scale-105',
          )}
        >
          {selected ? (
            <LeagueLogo league={selected} size={26} />
          ) : (
            <Trophy size={18} className="text-text-muted" />
          )}
        </div>

        {/* Text stack */}
        <div className="flex-1 min-w-0 text-start">
          <div className="font-barlow font-bold text-[15px] uppercase tracking-wide text-white truncate leading-tight">
            {selected?.name ?? t('statsSelectLeague')}
          </div>
          <div className="text-text-muted text-[10px] uppercase tracking-[0.18em] truncate leading-tight mt-0.5">
            {selected?.country ?? '—'}
          </div>
        </div>

        {/* Chevron pill */}
        <div
          className={cn(
            'shrink-0 w-7 h-7 rounded-full flex items-center justify-center',
            'bg-white/5 border border-white/8 transition-colors duration-200',
            open && 'bg-accent-green/15 border-accent-green/30',
          )}
        >
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' as const }}
          >
            <ChevronDown
              size={14}
              className={cn(
                'transition-colors duration-200',
                open ? 'text-accent-green' : 'text-text-muted group-hover:text-white',
              )}
            />
          </motion.div>
        </div>
      </motion.button>

      {/* ─────────── Panel ─────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className={cn(
              'absolute z-50 top-full mt-2 start-0 end-0 w-auto',
              'sm:start-auto sm:end-0 sm:w-[320px]',
              'rounded-2xl border border-border-subtle overflow-hidden',
              'shadow-[0_20px_60px_-12px_rgba(0,0,0,0.55)]',
            )}
            style={{
              background: 'var(--color-tooltip-bg)',
              transformOrigin: 'top right',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-border-subtle/80">
              <span className="font-barlow text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted">
                {t('statsSelectLeague')}
              </span>
              <span className="text-[10px] font-bold tabular-nums text-accent-green bg-accent-green/10 border border-accent-green/20 rounded-full px-2 py-0.5 leading-none">
                {leagues.length}
              </span>
            </div>

            {/* List — data-lenis-prevent stops global Lenis smooth-scroll from
                hijacking the wheel event so inner scrolling works. */}
            <div
              data-lenis-prevent
              className="max-h-[360px] overflow-y-auto overscroll-contain p-1.5"
            >
              {leagues.map((l, i) => {
                const isActive = l.id === value;
                return (
                  <motion.button
                    key={l.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      onChange(l.id);
                      setOpen(false);
                    }}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.18, ease: 'easeOut' as const }}
                    whileHover={{ x: 2 }}
                    className={cn(
                      'relative w-full flex items-center gap-3 h-14 px-2.5 rounded-xl text-start',
                      'transition-colors duration-150',
                      isActive
                        ? 'bg-accent-green/10 text-accent-green'
                        : 'text-white hover:bg-white/5',
                    )}
                  >
                    {/* Active left bar (layoutId animates between items) */}
                    {isActive && (
                      <motion.span
                        layoutId="league-active-bar"
                        aria-hidden
                        className="absolute start-0 top-2 bottom-2 w-[3px] rounded-full bg-accent-green"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}

                    {/* Logo tile */}
                    <div
                      className={cn(
                        'shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-150',
                        isActive
                          ? 'bg-accent-green/15 border border-accent-green/25'
                          : 'bg-white/5 border border-white/8',
                      )}
                    >
                      <LeagueLogo league={l} size={24} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div
                        className={cn(
                          'font-barlow font-bold text-sm uppercase tracking-wide truncate leading-tight',
                        )}
                      >
                        {l.name}
                      </div>
                      <div
                        className={cn(
                          'text-[10px] uppercase tracking-[0.18em] truncate leading-tight mt-0.5',
                          isActive ? 'text-accent-green/70' : 'text-text-muted',
                        )}
                      >
                        {l.country}
                      </div>
                    </div>

                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        className="shrink-0 w-6 h-6 rounded-full bg-accent-green/15 border border-accent-green/30 flex items-center justify-center"
                      >
                        <Check size={13} strokeWidth={3} />
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
