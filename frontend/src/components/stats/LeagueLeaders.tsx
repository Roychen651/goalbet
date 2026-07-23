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
  // V5 Sprint 55 — optional. A league/season ESPN doesn't expose this for
  // simply omits the sub-nav pill entirely — same "hidden until real data
  // exists" treatment every other category here already gets.
  goalkeepers?: LeaderRow[];
}

type Category = 'scorers' | 'assists' | 'discipline' | 'goalkeepers';

// V4 Sprint 27 — the Player Leaders Hub. Replaces the old static two-column
// layout with a premium sub-nav (Scorers / Assists / Discipline) driving a
// single micro-glass card list, reusing the same shared-layoutId pill morph
// technique HomePage's Segmented Snapper established (§34 Commit 1) instead
// of a plain conditional-class tab strip. V5 Sprint 55 adds a Goalkeepers
// category and a top-3 "spotlight" hero treatment above the flat grid.
export function LeagueLeaders({ scorers, assists, discipline, goalkeepers = [] }: LeagueLeadersProps) {
  const { t } = useLangStore();
  const hasScorers = scorers && scorers.length > 0;
  const hasAssists = assists && assists.length > 0;
  const hasDiscipline = discipline && discipline.length > 0;
  const hasGoalkeepers = goalkeepers && goalkeepers.length > 0;

  const categories: { id: Category; rows: LeaderRow[]; label: TranslationKey; unit: TranslationKey; has: boolean }[] = [
    { id: 'scorers', rows: scorers, label: 'statsTopScorers', unit: 'statsGoals', has: hasScorers },
    { id: 'assists', rows: assists, label: 'statsTopAssists', unit: 'statsAssists', has: hasAssists },
    { id: 'discipline', rows: discipline, label: 'statsDiscipline', unit: 'statsCards', has: hasDiscipline },
    { id: 'goalkeepers', rows: goalkeepers, label: 'statsCleanSheets', unit: 'statsCleanSheets', has: hasGoalkeepers },
  ];
  const available = categories.filter(c => c.has);

  const [active, setActive] = useState<Category | null>(available[0]?.id ?? null);
  const activeCategory = categories.find(c => c.id === active) ?? available[0];

  if (available.length === 0) return null;

  const top3 = activeCategory?.rows.slice(0, 3) ?? [];
  const rest = activeCategory?.rows.slice(3, 10) ?? [];

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
                  // V5 Sprint 55 — a 4th pill (Goalkeepers) made "Clean
                  // Sheets" the longest label in this row; min-w-0 on the
                  // flex item (flex items default to min-width:auto, the
                  // classic flexbox truncation trap) + block truncate on
                  // the inner span (a bare <span> ignores `truncate`
                  // without `block`/`inline-block`) is what actually clips
                  // it at 320px instead of overflowing the page — caught
                  // live via a real narrow-viewport render, not assumed.
                  'relative min-w-0 flex-1 rounded-lg px-2 py-2 font-barlow text-xs font-bold uppercase tracking-wider transition-colors',
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
                <span className="relative z-10 block truncate" title={t(cat.label)}>{t(cat.label)}</span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>

      {activeCategory && activeCategory.rows.length === 0 && (
        <div className="rounded-xl border border-border-subtle bg-bg-card/40 px-4 py-6 text-center text-sm text-text-muted">
          {t('statsNoLeadersInCategory')}
        </div>
      )}

      {top3.length > 0 && (
        <LeaderSpotlight rows={top3} category={activeCategory!.id} unit={t(activeCategory!.unit)} />
      )}

      {rest.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {rest.map((row) => (
            <LeaderCard key={row.athleteId || `${row.rank}-${row.name}`} row={row} category={activeCategory!.id} unit={t(activeCategory!.unit)} />
          ))}
        </div>
      )}
    </div>
  );
}

// V5 Sprint 55 — top-3 glassmorphic "spotlight" hero cards, using the same
// gold/silver/bronze tier language WeeklyPodiumModal/TrophyCabinet already
// established elsewhere in this app (no new color palette). #1 is visually
// dominant (larger badge, centered gold ring); #2/#3 flank it, smaller and
// desaturated a step — the same podium-shape convention this codebase's
// own leaderboard podium already uses, applied here to player leaders for
// the first time.
const SPOTLIGHT_TIERS = [
  { ring: 'ring-[#FFC94A]/70', glow: 'shadow-[0_0_28px_rgba(255,201,74,0.3)]', size: 60, order: 'sm:order-2', medal: '🥇', lift: 'sm:-translate-y-2' },
  { ring: 'ring-white/25', glow: '', size: 44, order: 'sm:order-1', medal: '🥈', lift: '' },
  { ring: 'ring-[#CD7F32]/50', glow: '', size: 44, order: 'sm:order-3', medal: '🥉', lift: '' },
] as const;

// V7 Sprint 57 — a real design pass following the top-3 spotlight's own
// established podium language (WeeklyPodiumModal/LeaderboardRow already
// use 🥇🥈🥉 for exactly this — reused verbatim rather than a new icon
// system). #1 also gets a genuine size/elevation lift (bigger badge,
// -translate-y on desktop) so the visual hierarchy reads at a glance, not
// just via a slightly brighter ring. The rank-number caption is now a
// medal instead of a bare "#N" — this codebase's own dashboard-viz
// discipline treats a number-only rank indicator as the weaker signal.
function LeaderSpotlight({ rows, category, unit }: { rows: LeaderRow[]; category: Category; unit: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 items-end">
      {rows.map((row, i) => {
        const tier = SPOTLIGHT_TIERS[i];
        return (
          <div key={row.athleteId || `${row.rank}-${row.name}`} className={cn('min-w-0 flex flex-col items-center', tier.order, tier.lift)}>
            {/* w-full + min-w-0 on the card itself, not just its grid-item
                parent — a flex/grid CHILD defaults to min-width:auto too,
                so the 60px #1 badge could still force this card wider than
                its 91px column at 320px even with the parent already fixed.
                Caught live via a real narrow-viewport Playwright render,
                not assumed — the classic "min-width:0 needs setting at
                every nested flex/grid level" trap. */}
            <GlassCard tactile grain className="w-full min-w-0" contentClassName={cn('flex flex-col items-center gap-1.5 px-2 py-3 text-center', tier.glow)}>
              <span className="text-lg leading-none" aria-label={`#${row.rank}`}>{tier.medal}</span>
              <div className="relative isolate shrink-0">
                <EntityBadge
                  src={row.photo}
                  name={row.name}
                  hashSeed={row.athleteId || row.name}
                  size={tier.size}
                  className={cn('rounded-full ring-2', tier.ring)}
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
              <div className="text-white text-xs font-semibold truncate max-w-full">{row.name}</div>
              <DisciplineOrValue row={row} category={category} unit={unit} compact />
            </GlassCard>
          </div>
        );
      })}
    </div>
  );
}

function LeaderCard({ row, category, unit }: { row: LeaderRow; category: Category; unit: string }) {
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

      <DisciplineOrValue row={row} category={category} unit={unit} />
    </GlassCard>
  );
}

// V5 Sprint 55 — a `discipline` row's `value` is a weighted composite
// (yellow + red*2, see stats.ts's combineDisciplineLists), which would be
// a dishonest, confusing number to show as-is next to a "Cards" unit
// label — a viewer would read "5" and reasonably assume 5 cards, not a
// weighted score. Discipline rows render the two REAL counts instead;
// every other category renders its plain value + unit exactly as before.
function DisciplineOrValue({ row, category, unit, compact }: { row: LeaderRow; category: Category; unit: string; compact?: boolean }) {
  const { t } = useLangStore();

  if (category === 'discipline' && (row.yellowCards != null || row.redCards != null)) {
    return (
      <div className={cn('flex items-center gap-1.5 shrink-0', compact ? 'justify-center' : 'text-end')}>
        <span className="flex items-center gap-0.5" aria-label={t('statsYellowCards')}>
          <span className="w-2.5 h-3.5 rounded-[1px] bg-[#F5C518]" />
          <span className="font-mono text-xs tabular-nums text-white">{row.yellowCards ?? 0}</span>
        </span>
        {(row.redCards ?? 0) > 0 && (
          <span className="flex items-center gap-0.5" aria-label={t('statsRedCards')}>
            <span className="w-2.5 h-3.5 rounded-[1px] bg-accent-orange" />
            <span className="font-mono text-xs tabular-nums text-white">{row.redCards}</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn('shrink-0', compact ? 'text-center' : 'text-end')}>
      <div className="font-mono text-base tabular-nums text-white font-semibold leading-none">
        {row.value}
      </div>
      <div className="text-text-muted text-[9px] uppercase tracking-wider mt-0.5">{unit}</div>
    </div>
  );
}
