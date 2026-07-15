import { useState } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { useLangStore } from '../../stores/langStore';
import { EntityBadge } from '../ui/EntityBadge';
import { GlassCard } from '../ui/GlassCard';
import { cn } from '../../lib/utils';
import type { LeaderRow } from '../../hooks/useLeagueStats';
import type { TranslationKey } from '../../lib/i18n';

interface LeagueLeadersProps {
  scorers: LeaderRow[];
  assists: LeaderRow[];
  discipline: LeaderRow[];
}

type Category = 'scorers' | 'assists' | 'discipline';

// V4 Sprint 27 — the Player Leaders Hub. Replaces the old static two-column
// layout with a premium sub-nav (Scorers / Assists / Discipline) driving a
// single micro-glass card list, reusing the same shared-layoutId pill morph
// technique HomePage's Segmented Snapper established (§34 Commit 1) instead
// of a plain conditional-class tab strip.
export function LeagueLeaders({ scorers, assists, discipline }: LeagueLeadersProps) {
  const { t } = useLangStore();
  const hasScorers = scorers && scorers.length > 0;
  const hasAssists = assists && assists.length > 0;
  const hasDiscipline = discipline && discipline.length > 0;

  const categories: { id: Category; rows: LeaderRow[]; label: TranslationKey; unit: TranslationKey; has: boolean }[] = [
    { id: 'scorers', rows: scorers, label: 'statsTopScorers', unit: 'statsGoals', has: hasScorers },
    { id: 'assists', rows: assists, label: 'statsTopAssists', unit: 'statsAssists', has: hasAssists },
    { id: 'discipline', rows: discipline, label: 'statsDiscipline', unit: 'statsCards', has: hasDiscipline },
  ];
  const available = categories.filter(c => c.has);

  const [active, setActive] = useState<Category | null>(available[0]?.id ?? null);
  const activeCategory = categories.find(c => c.id === active) ?? available[0];

  if (available.length === 0) return null;

  return (
    <div className="space-y-3">
      <LayoutGroup id="leaders-subnav">
        <div className="flex gap-1.5 rounded-xl border border-border-subtle bg-bg-card/60 p-1 backdrop-blur-glass">
          {categories.map((cat) => {
            if (!cat.has) return null;
            const isActive = activeCategory?.id === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActive(cat.id)}
                className={cn(
                  'relative flex-1 rounded-lg px-2 py-2 font-barlow text-xs font-bold uppercase tracking-wider transition-colors',
                  isActive ? 'text-white' : 'text-text-muted hover:text-white/80'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="leadersActivePill"
                    className="absolute inset-0 rounded-lg bg-accent-green/15 ring-1 ring-accent-green/30"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{t(cat.label)}</span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>

      {activeCategory && (
        <LeadersGrid unit={t(activeCategory.unit)} rows={activeCategory.rows} />
      )}
    </div>
  );
}

function LeadersGrid({ unit, rows }: { unit: string; rows: LeaderRow[] }) {
  const { t } = useLangStore();

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-card/40 px-4 py-6 text-center text-sm text-text-muted">
        {t('statsNoLeadersInCategory')}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {rows.slice(0, 10).map((row) => (
        <LeaderCard key={row.athleteId || `${row.rank}-${row.name}`} row={row} unit={unit} />
      ))}
    </div>
  );
}

function LeaderCard({ row, unit }: { row: LeaderRow; unit: string }) {
  const { t } = useLangStore();

  return (
    <GlassCard tactile contentClassName="flex items-center gap-3 px-3 py-2.5">
      <span className="w-4 text-end text-text-muted font-mono text-[11px] tabular-nums shrink-0">
        {row.rank}
      </span>

      <div className="relative shrink-0 isolate">
        <EntityBadge
          src={row.photo}
          name={row.name}
          hashSeed={row.athleteId || row.name}
          size={40}
          className="rounded-full"
        />
        <div className="absolute -bottom-0.5 -end-0.5 rounded-full ring-2 ring-[var(--color-bg-card)]">
          <EntityBadge
            src={row.teamLogo}
            name={row.teamName ?? ''}
            hashSeed={row.teamName ?? row.athleteId}
            size={16}
            className="rounded-full"
          />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium truncate">{row.name}</div>
        <div className="text-text-muted text-[10px] truncate">
          {row.teamName ?? ''}
          {row.matches !== null && (row.teamName ? ' · ' : '') + t('statsPlayerMatches').replace('{0}', String(row.matches))}
        </div>
      </div>

      <div className="text-end shrink-0">
        <div className="font-mono text-base tabular-nums text-white font-semibold leading-none">
          {row.value}
        </div>
        <div className="text-text-muted text-[9px] uppercase tracking-wider mt-0.5">{unit}</div>
      </div>
    </GlassCard>
  );
}
