import { useMemo, useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Trophy, Calendar, MapPin, Globe, Users, Target, CalendarDays, Zap,
  LayoutGrid, ListOrdered, GitBranch, Building2, ChevronRight,
  Sparkles, Radio,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLangStore } from '../../stores/langStore';
import { type TranslationKey } from '../../lib/i18n';
import {
  WC2026_INFO,
  WC2026_GROUPS,
  WC2026_GROUP_MATCHES,
  WC2026_R32, WC2026_R16, WC2026_QF, WC2026_SF,
  WC2026_THIRD, WC2026_FINAL,
  WC2026_PHASES,
  WC2026_STADIUMS,
  WC2026_STADIUM_BY_ID,
  type WCGroup, type WCTeam, type WCGroupMatch, type WCKnockoutMatch,
  type WCStadium, type WCPhase, type WCMatchday,
} from '../../lib/worldCup2026';

type T = (key: TranslationKey) => string;
type KickoffState = { days: number; phase: 'pre' | 'live' | 'ended' };
type TabId = 'overview' | 'groups' | 'fixtures' | 'knockouts' | 'venues';
type BracketRound = 'r32' | 'r16' | 'qf' | 'sf' | 'final' | 'third';

const tabFade: Variants = {
  enter:  { opacity: 0, y: 8 },
  center: { opacity: 1, y: 0, transition: { duration: 0.26, ease: 'easeOut' as const } },
  exit:   { opacity: 0, y: -6, transition: { duration: 0.16, ease: 'easeIn' as const } },
};

export function WorldCupBracket() {
  const { t, lang } = useLangStore();
  const locale = lang === 'he' ? 'he-IL' : 'en-US';
  const [tab, setTab] = useState<TabId>('overview');

  const kickoff = useMemo<KickoffState>(() => {
    const start = new Date(WC2026_INFO.startDate).getTime();
    const end = new Date(WC2026_INFO.endDate).getTime() + 86400000;
    const now = Date.now();
    if (now < start) return { days: Math.ceil((start - now) / 86400000), phase: 'pre' };
    if (now < end)   return { days: Math.ceil((end - now) / 86400000),   phase: 'live' };
    return { days: 0, phase: 'ended' };
  }, []);

  const longDateFmt  = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }), [locale]);
  const shortDateFmt = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }), [locale]);
  const dayDateFmt   = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }), [locale]);

  return (
    <div className="space-y-5">
      <Hero t={t} kickoff={kickoff} longDateFmt={longDateFmt} />
      <TabBar t={t} active={tab} onChange={setTab} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          variants={tabFade}
          initial="enter"
          animate="center"
          exit="exit"
          className="space-y-5"
        >
          {tab === 'overview' && (
            <OverviewTab
              t={t}
              longDateFmt={longDateFmt}
              shortDateFmt={shortDateFmt}
              dayDateFmt={dayDateFmt}
              onGoTo={setTab}
            />
          )}
          {tab === 'groups'    && <GroupsTab    t={t} />}
          {tab === 'fixtures'  && <FixturesTab  t={t} dayDateFmt={dayDateFmt} shortDateFmt={shortDateFmt} />}
          {tab === 'knockouts' && <KnockoutsTab t={t} shortDateFmt={shortDateFmt} />}
          {tab === 'venues'    && <VenuesTab    t={t} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ═════════════════════════ HERO ═════════════════════════ */

function Hero({ t, kickoff, longDateFmt }: { t: T; kickoff: KickoffState; longDateFmt: Intl.DateTimeFormat }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' as const }}
      className="relative rounded-3xl border border-border-subtle overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, rgba(73,136,196,0.24) 0%, rgba(189,232,245,0.08) 45%, rgba(15,40,84,0.35) 100%)',
      }}
    >
      <motion.div
        aria-hidden
        className="absolute inset-0 opacity-[0.16] pointer-events-none"
        initial={{ backgroundPosition: '0% 0%' }}
        animate={{ backgroundPosition: '100% 100%' }}
        transition={{ duration: 18, ease: 'linear' as const, repeat: Infinity, repeatType: 'reverse' as const }}
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, rgba(189,232,245,0.55) 0, transparent 38%), radial-gradient(circle at 80% 70%, rgba(73,136,196,0.55) 0, transparent 40%)',
          backgroundSize: '200% 200%',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(189,232,245,0.7) 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      />

      <div className="relative px-5 py-6 md:px-8 md:py-8 lg:px-10 lg:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-5 lg:gap-8 items-center">
          {/* Title block */}
          <div className="flex items-start gap-4 md:gap-5 min-w-0">
            <motion.div
              className="shrink-0 w-14 h-14 md:w-[72px] md:h-[72px] rounded-2xl bg-accent-green/10 border border-accent-green/30 flex items-center justify-center"
              animate={{ y: [0, -4, 0], rotate: [0, -2, 0, 2, 0] }}
              transition={{ duration: 6, ease: 'easeInOut' as const, repeat: Infinity }}
              style={{ boxShadow: '0 0 28px rgba(73,136,196,0.4)' }}
            >
              <Trophy className="text-accent-green w-7 h-7 md:w-9 md:h-9" strokeWidth={1.75} />
            </motion.div>

            <div className="flex-1 min-w-0">
              <div className="text-accent-green text-[11px] font-bold uppercase tracking-[0.28em]">
                {t('wcRouteToTrophy')}
              </div>
              <h2 className="font-barlow font-extrabold text-2xl md:text-4xl lg:text-5xl uppercase tracking-wide text-white leading-[1.05] mt-1">
                {WC2026_INFO.name}
              </h2>
              <div className="text-text-muted text-xs md:text-sm mt-1.5 font-medium">
                {t('wcPathToGlory')}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-text-muted text-[11px] md:text-[13px]">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={13} className="text-accent-green" />
                  {longDateFmt.format(new Date(WC2026_INFO.startDate))}
                  <span className="opacity-50">–</span>
                  {longDateFmt.format(new Date(WC2026_INFO.endDate))}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Globe size={13} className="text-accent-green" />
                  {WC2026_INFO.hosts.map(h => h.flag).join(' ')}
                  <span className="ms-1">{t('wcHostNations')}</span>
                </span>
              </div>
            </div>
          </div>

          <Countdown t={t} kickoff={kickoff} />
        </div>
      </div>
    </motion.section>
  );
}

function Countdown({ t, kickoff }: { t: T; kickoff: KickoffState }) {
  if (kickoff.phase === 'live') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.18, duration: 0.35, ease: 'easeOut' as const }}
        className="rounded-2xl border border-accent-green/45 bg-accent-green/10 px-5 py-4 flex items-center gap-4 lg:min-w-[260px]"
        style={{ boxShadow: '0 0 40px rgba(189,232,245,0.28)' }}
      >
        <motion.span
          aria-hidden
          className="w-3 h-3 rounded-full bg-accent-green"
          animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.25, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' as const }}
        />
        <div className="flex-1">
          <div className="font-barlow font-extrabold text-2xl uppercase text-white tracking-wide leading-tight">
            {t('wcLiveNow')}
          </div>
        </div>
      </motion.div>
    );
  }
  if (kickoff.phase === 'ended') {
    return (
      <div className="rounded-2xl border border-border-subtle bg-bg-card px-5 py-4 lg:min-w-[260px]">
        <div className="font-barlow font-bold text-xl uppercase text-white tracking-wide">
          {t('wcTournamentEnded')}
        </div>
      </div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18, duration: 0.35, ease: 'easeOut' as const }}
      className="rounded-2xl border border-accent-green/30 bg-bg-card/60 backdrop-blur-sm px-5 py-4 flex items-center gap-5 lg:min-w-[280px]"
      style={{ boxShadow: '0 0 40px rgba(73,136,196,0.18)' }}
    >
      <div className="shrink-0 w-14 h-14 rounded-xl bg-accent-green/10 border border-accent-green/25 flex items-center justify-center">
        <Zap size={24} className="text-accent-green" strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <motion.span
            key={kickoff.days}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="font-barlow font-extrabold text-4xl md:text-5xl text-accent-green tabular-nums leading-none"
          >
            {kickoff.days}
          </motion.span>
          <span className="font-barlow font-bold text-sm uppercase tracking-widest text-text-muted">
            {t('wcStatDays')}
          </span>
        </div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted mt-1 font-bold">
          {t('wcDaysToKickoff')}
        </div>
      </div>
    </motion.div>
  );
}

/* ═════════════════════════ TAB BAR ═════════════════════════ */

function TabBar({ t, active, onChange }: { t: T; active: TabId; onChange: (id: TabId) => void }) {
  const tabs: { id: TabId; labelKey: TranslationKey; icon: typeof LayoutGrid }[] = [
    { id: 'overview',  labelKey: 'wcOverview',  icon: LayoutGrid },
    { id: 'groups',    labelKey: 'wcGroups',    icon: Users },
    { id: 'fixtures',  labelKey: 'wcFixtures',  icon: ListOrdered },
    { id: 'knockouts', labelKey: 'wcKnockouts', icon: GitBranch },
    { id: 'venues',    labelKey: 'wcVenues',    icon: Building2 },
  ];
  return (
    <nav
      data-lenis-prevent
      className="overflow-x-auto overscroll-contain -mx-1 px-1 pb-1 scrollbar-thin"
    >
      <div className="inline-flex min-w-full md:w-full gap-1.5 p-1 rounded-2xl border border-border-subtle bg-bg-card/60 backdrop-blur-sm">
        {tabs.map(tab => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 md:px-4 md:py-2.5 transition-colors whitespace-nowrap',
                isActive ? 'text-white' : 'text-text-muted hover:text-white/90',
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="wc-tab-indicator"
                  className="absolute inset-0 rounded-xl bg-accent-green/15 border border-accent-green/35"
                  style={{ boxShadow: '0 0 22px rgba(73,136,196,0.25)' }}
                  transition={{ type: 'spring', stiffness: 360, damping: 32 }}
                />
              )}
              <span className="relative inline-flex items-center gap-2">
                <tab.icon size={14} className={cn(isActive ? 'text-accent-green' : 'text-text-muted')} />
                <span className="font-barlow text-[12px] md:text-[13px] font-bold uppercase tracking-[0.18em] leading-none">
                  {t(tab.labelKey)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ═════════════════════════ OVERVIEW TAB ═════════════════════════ */

function OverviewTab({ t, longDateFmt, shortDateFmt, dayDateFmt, onGoTo }: {
  t: T;
  longDateFmt: Intl.DateTimeFormat;
  shortDateFmt: Intl.DateTimeFormat;
  dayDateFmt: Intl.DateTimeFormat;
  onGoTo: (id: TabId) => void;
}) {
  const next3 = useMemo(() => {
    const now = Date.now();
    return WC2026_GROUP_MATCHES
      .filter(m => new Date(m.date).getTime() + 86400000 > now)
      .slice(0, 3);
  }, []);

  return (
    <>
      <StatStrip t={t} />
      <KeyMatches t={t} longDateFmt={longDateFmt} />
      <PhaseTimeline t={t} phases={WC2026_PHASES} shortDateFmt={shortDateFmt} />
      {next3.length > 0 && (
        <NextMatches
          t={t}
          matches={next3}
          dayDateFmt={dayDateFmt}
          onSeeAll={() => onGoTo('fixtures')}
        />
      )}
    </>
  );
}

function StatStrip({ t }: { t: T }) {
  const stats = [
    { icon: Users,        label: t('wcStatTeams'),   value: WC2026_INFO.totalTeams },
    { icon: Target,       label: t('wcStatMatches'), value: WC2026_INFO.totalMatches },
    { icon: MapPin,       label: t('wcStatCities'),  value: WC2026_INFO.hostCities },
    { icon: CalendarDays, label: t('wcStatDays'),    value: WC2026_INFO.totalDays },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ delay: i * 0.06, duration: 0.3, ease: 'easeOut' as const }}
          className="rounded-2xl border border-border-subtle bg-bg-card/70 px-4 py-3.5"
        >
          <div className="flex items-center gap-2.5">
            <div className="shrink-0 w-9 h-9 rounded-lg bg-accent-green/10 border border-accent-green/20 flex items-center justify-center">
              <s.icon size={16} className="text-accent-green" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-barlow font-extrabold text-2xl md:text-[28px] text-white tabular-nums leading-none">
                {s.value}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-text-muted mt-0.5 truncate">
                {s.label}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function KeyMatches({ t, longDateFmt }: { t: T; longDateFmt: Intl.DateTimeFormat }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <KeyMatchCard
        label={t('wcOpeningMatch')}
        venue={WC2026_INFO.opening.venue}
        city={WC2026_INFO.opening.city}
        date={longDateFmt.format(new Date(WC2026_INFO.opening.date))}
        tone="accent"
        delay={0}
      />
      <KeyMatchCard
        label={t('wcFinalMatch')}
        venue={WC2026_INFO.final.venue}
        city={WC2026_INFO.final.city}
        date={longDateFmt.format(new Date(WC2026_INFO.final.date))}
        tone="gold"
        delay={0.08}
      />
    </div>
  );
}

function KeyMatchCard({ label, venue, city, date, tone, delay }: {
  label: string; venue: string; city: string; date: string;
  tone: 'accent' | 'gold'; delay: number;
}) {
  const isGold = tone === 'gold';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' as const }}
      className={cn(
        'relative rounded-2xl border px-4 py-4 overflow-hidden',
        isGold
          ? 'border-accent-green/40 bg-gradient-to-br from-accent-green/10 to-accent-green/5'
          : 'border-border-subtle bg-bg-card',
      )}
      style={isGold ? { boxShadow: '0 0 48px rgba(189,232,245,0.22)' } : undefined}
    >
      {isGold && (
        <motion.div
          aria-hidden
          className="absolute -top-12 -end-10 w-32 h-32 rounded-full bg-accent-green/15 blur-2xl"
          animate={{ scale: [1, 1.12, 1], opacity: [0.45, 0.8, 0.45] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' as const }}
        />
      )}
      <div className="relative flex items-start justify-between gap-2">
        <div className={cn(
          'text-[10px] font-bold uppercase tracking-[0.24em]',
          isGold ? 'text-accent-green' : 'text-text-muted',
        )}>
          {label}
        </div>
        {isGold && <Trophy size={14} className="text-accent-green shrink-0" />}
      </div>
      <div className="relative font-barlow font-extrabold text-lg md:text-xl uppercase text-white mt-2 leading-tight">
        {venue}
      </div>
      <div className="relative flex items-center gap-2 text-text-muted text-[11px] mt-1.5">
        <span className="inline-flex items-center gap-1">
          <MapPin size={11} />
          {city}
        </span>
        <span className="opacity-30">·</span>
        <span className="inline-flex items-center gap-1">
          <Calendar size={11} />
          {date}
        </span>
      </div>
    </motion.div>
  );
}

function PhaseTimeline({ t, phases, shortDateFmt }: {
  t: T; phases: WCPhase[]; shortDateFmt: Intl.DateTimeFormat;
}) {
  const now = Date.now();
  return (
    <section className="space-y-3">
      <SectionHeader label={t('wcTournamentPhases')} />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {phases.map((p, i) => {
          const start = new Date(p.startDate).getTime();
          const end = new Date(p.endDate).getTime() + 86400000;
          const status: 'past' | 'current' | 'upcoming' =
            now >= end ? 'past' : now >= start ? 'current' : 'upcoming';
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: i * 0.035, duration: 0.28, ease: 'easeOut' as const }}
              className={cn(
                'rounded-xl border px-3 py-3',
                status === 'current'
                  ? 'border-accent-green/50 bg-accent-green/10'
                  : status === 'past'
                  ? 'border-border-subtle bg-bg-card/40 opacity-75'
                  : 'border-border-subtle bg-bg-card',
              )}
            >
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    status === 'current' ? 'bg-accent-green' : 'bg-text-muted/60',
                  )}
                />
                <div className="font-barlow text-[10px] font-bold uppercase tracking-widest text-text-muted truncate">
                  {p.matches} {t('wcStatMatches').toLowerCase()}
                </div>
              </div>
              <div className="font-barlow font-bold text-[13px] uppercase tracking-wide text-white mt-1.5 leading-tight">
                {t(p.labelKey)}
              </div>
              <div className="text-[10px] text-text-muted/80 mt-1 leading-tight tabular-nums">
                {shortDateFmt.format(new Date(p.startDate))}
                {p.startDate !== p.endDate && (
                  <>
                    <span className="opacity-40"> – </span>
                    {shortDateFmt.format(new Date(p.endDate))}
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function NextMatches({ t, matches, dayDateFmt, onSeeAll }: {
  t: T; matches: WCGroupMatch[]; dayDateFmt: Intl.DateTimeFormat; onSeeAll: () => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-barlow text-sm md:text-base font-bold uppercase tracking-[0.22em] text-white/90">
          {t('wcNext')} · {t('wcFixtures')}
        </h3>
        <button
          type="button"
          onClick={onSeeAll}
          className="inline-flex items-center gap-1 text-accent-green text-[11px] font-bold uppercase tracking-widest hover:text-white transition-colors"
        >
          {t('wcView')}
          <ChevronRight size={13} className="rtl:rotate-180" />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {matches.map((m, i) => (
          <GroupFixtureCard key={m.id} match={m} dayDateFmt={dayDateFmt} delay={i * 0.05} />
        ))}
      </div>
    </section>
  );
}

/* ═════════════════════════ GROUPS TAB ═════════════════════════ */

function GroupsTab({ t }: { t: T }) {
  return (
    <section className="space-y-3">
      <SectionHeader label={t('wcGroupStage')} count={`${WC2026_GROUPS.length} ${t('wcGroups')}`} />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {WC2026_GROUPS.map((g, i) => <GroupCard key={g.id} group={g} index={i} t={t} />)}
      </div>
    </section>
  );
}

function GroupCard({ group, index, t }: { group: WCGroup; index: number; t: T }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ delay: index * 0.03, duration: 0.28, ease: 'easeOut' as const }}
      whileHover={{ y: -2 }}
      className="rounded-2xl border border-border-subtle bg-bg-card overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle/60 bg-gradient-to-r from-accent-green/10 to-transparent">
        <div className="font-barlow font-extrabold text-base uppercase tracking-widest text-white">
          Group {group.id}
        </div>
        <span className="text-[10px] font-mono tabular-nums text-accent-green bg-accent-green/10 border border-accent-green/25 rounded-full px-1.5 py-0.5 leading-none">
          {group.teams.length}
        </span>
      </div>
      <ul>
        {group.teams.map((team, i) => (
          <TeamRow key={i} team={team} position={i + 1} t={t} />
        ))}
      </ul>
    </motion.div>
  );
}

function TeamRow({ team, position, t }: { team: WCTeam; position: number; t: T }) {
  const isTbd = team.code === 'TBD';
  return (
    <li
      className={cn(
        'flex items-center gap-2.5 px-3.5 py-2.5 border-t border-border-subtle/40 first:border-t-0',
        isTbd ? 'opacity-45' : '',
      )}
      title={team.name}
    >
      <span className="w-4 text-end text-text-muted/70 font-mono text-[11px] tabular-nums shrink-0">
        {position}
      </span>
      <span aria-hidden className="text-[17px] leading-none shrink-0 w-6 text-center">
        {team.flag}
      </span>
      <span className="font-mono tabular-nums text-[10px] font-bold tracking-wider text-accent-green/90 bg-accent-green/8 border border-accent-green/20 rounded px-1.5 py-0.5 leading-none shrink-0">
        {team.code}
      </span>
      <span
        className={cn(
          'flex-1 min-w-0 text-sm truncate',
          isTbd ? 'text-text-muted italic' : 'text-white font-medium',
        )}
      >
        {team.name}
      </span>
      {team.host && (
        <span className="text-[9px] font-bold uppercase tracking-wider text-accent-green bg-accent-green/10 border border-accent-green/25 rounded-full px-1.5 py-0.5 leading-none shrink-0">
          {t('wcHost')}
        </span>
      )}
    </li>
  );
}

/* ═════════════════════════ FIXTURES TAB ═════════════════════════ */

function FixturesTab({ t, dayDateFmt, shortDateFmt }: {
  t: T; dayDateFmt: Intl.DateTimeFormat; shortDateFmt: Intl.DateTimeFormat;
}) {
  const [md, setMd] = useState<'all' | WCMatchday>('all');
  const matches = useMemo(
    () => md === 'all' ? WC2026_GROUP_MATCHES : WC2026_GROUP_MATCHES.filter(m => m.matchday === md),
    [md],
  );

  const byDate = useMemo(() => {
    const map = new Map<string, WCGroupMatch[]>();
    for (const m of matches) {
      const list = map.get(m.date) ?? [];
      list.push(m);
      map.set(m.date, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [matches]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <SectionHeader
          label={t('wcGroupFixtures')}
          count={`${matches.length} ${t('wcStatMatches').toLowerCase()}`}
        />
        <MatchdayPicker t={t} active={md} onChange={setMd} />
      </div>

      <div className="space-y-4">
        {byDate.map(([date, day]) => (
          <DaySection
            key={date}
            date={date}
            matches={day}
            dayDateFmt={dayDateFmt}
            shortDateFmt={shortDateFmt}
          />
        ))}
      </div>
    </section>
  );
}

function MatchdayPicker({ t, active, onChange }: {
  t: T; active: 'all' | WCMatchday; onChange: (v: 'all' | WCMatchday) => void;
}) {
  const options: { id: 'all' | WCMatchday; label: string }[] = [
    { id: 'all', label: t('wcAllMatchdays') },
    { id: 1,     label: `${t('wcMatchday')} 1` },
    { id: 2,     label: `${t('wcMatchday')} 2` },
    { id: 3,     label: `${t('wcMatchday')} 3` },
  ];
  return (
    <div className="inline-flex gap-1 p-1 rounded-xl border border-border-subtle bg-bg-card/60">
      {options.map(o => {
        const isActive = o.id === active;
        return (
          <button
            key={String(o.id)}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn(
              'relative rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] font-barlow transition-colors',
              isActive ? 'text-white' : 'text-text-muted hover:text-white/90',
            )}
          >
            {isActive && (
              <motion.span
                layoutId="wc-md-indicator"
                className="absolute inset-0 rounded-lg bg-accent-green/15 border border-accent-green/35"
                transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function DaySection({ date, matches, dayDateFmt, shortDateFmt }: {
  date: string; matches: WCGroupMatch[]; dayDateFmt: Intl.DateTimeFormat; shortDateFmt: Intl.DateTimeFormat;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateObj = new Date(date);
  const isToday = dateObj.toDateString() === today.toDateString();
  const isPast = dateObj.getTime() + 86400000 < Date.now();
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 px-1">
        <span
          aria-hidden
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            isToday ? 'bg-accent-green' : isPast ? 'bg-text-muted/40' : 'bg-text-muted/70',
          )}
        />
        <span className="font-barlow text-[11px] md:text-[12px] font-bold uppercase tracking-[0.18em] text-white/85">
          {dayDateFmt.format(dateObj)}
        </span>
        <span className="text-[10px] text-text-muted/70">
          · {matches.length} {matches.length === 1 ? 'match' : 'matches'}
        </span>
        <span className="flex-1 h-px bg-border-subtle/40" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {matches.map((m, i) => (
          <GroupFixtureCard key={m.id} match={m} dayDateFmt={shortDateFmt} delay={i * 0.02} />
        ))}
      </div>
    </div>
  );
}

function GroupFixtureCard({ match, dayDateFmt, delay }: {
  match: WCGroupMatch; dayDateFmt: Intl.DateTimeFormat; delay: number;
}) {
  const stadium = WC2026_STADIUM_BY_ID[match.venueId];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ delay, duration: 0.24, ease: 'easeOut' as const }}
      whileHover={{ y: -2 }}
      className="rounded-xl border border-border-subtle bg-bg-card overflow-hidden"
    >
      <div className="px-3 pt-2.5 pb-1 flex items-center justify-between gap-2 border-b border-border-subtle/40">
        <span className="inline-flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-wider text-accent-green">
          <span className="w-5 text-center tabular-nums bg-accent-green/10 border border-accent-green/25 rounded-full py-0.5 leading-none">
            {match.group}
          </span>
          <span className="text-text-muted/80 font-mono">#{match.number}</span>
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-text-muted tabular-nums">
          <Calendar size={10} />
          {dayDateFmt.format(new Date(match.date))}
        </span>
      </div>

      <div className="px-3 py-2.5">
        <TeamLine team={match.home} />
        <div className="flex items-center gap-2 my-1.5">
          <span className="flex-1 h-px bg-border-subtle/50" />
          <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-text-muted/70">vs</span>
          <span className="flex-1 h-px bg-border-subtle/50" />
        </div>
        <TeamLine team={match.away} />
      </div>

      {stadium && (
        <div className="px-3 py-1.5 border-t border-border-subtle/40 flex items-center gap-1.5">
          <MapPin size={10} className="text-text-muted/70 shrink-0" />
          <span className="text-[10px] text-text-muted truncate flex-1 min-w-0">{stadium.city}</span>
          <span aria-hidden className="text-[10px] leading-none">{stadium.countryFlag}</span>
        </div>
      )}
    </motion.div>
  );
}

function TeamLine({ team }: { team: WCTeam }) {
  return (
    <div className="flex items-center gap-2" title={team.name}>
      <span aria-hidden className="text-base leading-none shrink-0 w-6 text-center">
        {team.flag}
      </span>
      <span className="font-mono tabular-nums text-[10px] font-bold tracking-wider text-accent-green/90 shrink-0">
        {team.code}
      </span>
      <span className="flex-1 min-w-0 font-medium text-sm text-white line-clamp-1 break-words">
        {team.name}
      </span>
      {team.host && (
        <span
          aria-hidden
          className="w-1.5 h-1.5 rounded-full bg-accent-green shrink-0"
          title="Host"
        />
      )}
    </div>
  );
}

/* ═════════════════════════ KNOCKOUTS TAB ═════════════════════════ */

function KnockoutsTab({ t, shortDateFmt }: { t: T; shortDateFmt: Intl.DateTimeFormat }) {
  return (
    <section className="space-y-4">
      <BracketHero t={t} />

      {/* Desktop: full bracket tree */}
      <div className="hidden lg:block">
        <BracketTreeDesktop t={t} shortDateFmt={shortDateFmt} />
      </div>

      {/* Tablet/Mobile: stacked rounds with flow hints */}
      <div className="lg:hidden">
        <BracketStackedMobile t={t} shortDateFmt={shortDateFmt} />
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  HERO HEADER — WC 2026 tri-host identity
//  The three host nations (US/CA/MX) are the anchor visual here; their
//  flags sit alongside "Road to MetLife" (the final's venue) as a
//  tournament-specific identity. This replaces the generic "Road to
//  Glory" title + separate Auto-Update badge with a single cohesive
//  hero that immediately signals "this is WC 2026, not any bracket".
// ═══════════════════════════════════════════════════════════════════
function BracketHero({ t }: { t: T }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-accent-green/30 bg-gradient-to-br from-accent-green/10 via-bg-card/50 to-bg-card/20 backdrop-blur-sm">
      {/* Tricolor ribbon — the three host nations as a subtle top-edge accent */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-[2px] grid grid-cols-3">
        <span className="bg-gradient-to-r from-[#B22234] via-[#FFFFFF] to-[#3C3B6E]" />
        <span className="bg-gradient-to-r from-[#D52B1E] via-[#FFFFFF] to-[#D52B1E]" />
        <span className="bg-gradient-to-r from-[#006847] via-[#FFFFFF] to-[#CE1126]" />
      </div>

      {/* Ambient trophy glow top-right */}
      <motion.div
        aria-hidden
        className="absolute -top-10 end-0 w-52 h-52 rounded-full bg-accent-green/15 blur-3xl pointer-events-none"
        animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.1, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' as const }}
      />

      <div className="relative px-5 py-5 md:px-7 md:py-6 flex items-center gap-4 md:gap-6 flex-wrap">
        {/* Trophy orb */}
        <motion.div
          className="shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-accent-green/15 border border-accent-green/40 flex items-center justify-center"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' as const }}
          style={{ boxShadow: '0 0 28px rgba(189,232,245,0.3)' }}
        >
          <Trophy size={26} className="text-accent-green" strokeWidth={1.8} />
        </motion.div>

        {/* Title + tagline */}
        <div className="flex-1 min-w-[220px]">
          <h3 className="font-barlow text-lg md:text-2xl font-extrabold uppercase tracking-[0.18em] text-white leading-tight">
            {t('wcBracketTitle')}
          </h3>
          <p className="text-text-muted text-[11px] md:text-[13px] mt-1 leading-snug max-w-xl">
            {t('wcBracketSub')}
          </p>
        </div>

        {/* Host-nation flags — the three co-hosts, shown with subtle borders */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="hidden md:inline text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted me-1">
            {t('wcHostNations')}
          </span>
          {(['🇺🇸', '🇨🇦', '🇲🇽'] as const).map((flag, i) => (
            <motion.span
              key={flag}
              aria-hidden
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.3, ease: 'easeOut' as const }}
              className="inline-flex w-9 h-9 md:w-10 md:h-10 items-center justify-center rounded-xl border border-accent-green/25 bg-bg-card/70 text-xl md:text-2xl leading-none"
              whileHover={{ scale: 1.1, y: -2 }}
            >
              {flag}
            </motion.span>
          ))}
        </div>
      </div>

      {/* Bottom strip: round progression + live badge */}
      <div className="relative px-5 md:px-7 pb-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-text-muted/80">
          <RoundPill label={t('wcR32')} tone="cool" />
          <ChevronRight size={11} className="opacity-40 rtl:rotate-180" />
          <RoundPill label={t('wcR16')} tone="cool" />
          <ChevronRight size={11} className="opacity-40 rtl:rotate-180" />
          <RoundPill label={t('wcQF')} tone="warm" />
          <ChevronRight size={11} className="opacity-40 rtl:rotate-180" />
          <RoundPill label={t('wcSF')} tone="warmer" />
          <ChevronRight size={11} className="opacity-40 rtl:rotate-180" />
          <RoundPill label={t('wcFinal')} tone="hot" />
        </div>
        <div className="inline-flex items-center gap-2 text-[10px]">
          <span className="relative inline-flex w-2 h-2 rounded-full bg-accent-green">
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full bg-accent-green"
              animate={{ scale: [1, 2.2], opacity: [0.8, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' as const }}
            />
          </span>
          <span className="font-bold uppercase tracking-widest text-accent-green">
            {t('wcLiveAuto')}
          </span>
        </div>
      </div>
    </div>
  );
}

// Round-progression pill with color-temperature escalation (cool → hot).
// Visually encodes stakes: early rounds read cool, final reads hot-gold.
function RoundPill({ label, tone }: { label: string; tone: 'cool' | 'warm' | 'warmer' | 'hot' }) {
  const toneMap = {
    cool:   'text-text-muted/80 border-border-subtle bg-bg-card/40',
    warm:   'text-[#E6C558]/90 border-[#E6C558]/25 bg-[#E6C558]/5',
    warmer: 'text-[#F0B23A]/95 border-[#F0B23A]/30 bg-[#F0B23A]/8',
    hot:    'text-[#FFC94A] border-[#FFC94A]/50 bg-[#FFC94A]/10',
  } as const;
  return (
    <span className={cn(
      'rounded-full border px-2 py-0.5 leading-none',
      toneMap[tone],
    )}>
      {label}
    </span>
  );
}

// Legacy header kept for any external ref — now unused by KnockoutsTab.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _LegacyBracketHeader({ t }: { t: T }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h3 className="font-barlow text-base md:text-lg font-extrabold uppercase tracking-[0.22em] text-white/95">
          {t('wcBracketTitle')}
        </h3>
        <p className="text-text-muted text-[11px] md:text-xs mt-0.5">{t('wcBracketSub')}</p>
      </div>
      <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-text-muted">
        <span>{t('wcR32')}</span>
        <ChevronRight size={12} className="opacity-50 rtl:rotate-180" />
        <span>{t('wcR16')}</span>
        <ChevronRight size={12} className="opacity-50 rtl:rotate-180" />
        <span>{t('wcQF')}</span>
        <ChevronRight size={12} className="opacity-50 rtl:rotate-180" />
        <span>{t('wcSF')}</span>
        <ChevronRight size={12} className="opacity-50 rtl:rotate-180" />
        <span className="text-accent-green">{t('wcFinal')}</span>
      </div>
    </div>
  );
}

function AutoUpdateBadge({ t }: { t: T }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' as const }}
      className="rounded-2xl border border-accent-green/25 bg-accent-green/5 px-4 py-3 flex items-center gap-3"
    >
      <span className="shrink-0 relative inline-flex w-8 h-8 rounded-full bg-accent-green/10 border border-accent-green/30 items-center justify-center">
        <Radio size={14} className="text-accent-green" strokeWidth={2} />
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full border border-accent-green/40"
          animate={{ scale: [1, 1.35], opacity: [0.8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' as const }}
        />
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-barlow font-bold text-[11px] uppercase tracking-[0.2em] text-accent-green leading-none">
          {t('wcLiveAuto')}
        </div>
        <div className="text-[11px] md:text-xs text-text-muted mt-1 leading-snug">
          {t('wcLiveAutoDesc')}
        </div>
      </div>
    </motion.div>
  );
}

/* ──────── Desktop bracket tree ──────── */
// Strategy: 5-column CSS grid over 32 rows. R32 cards span 2 rows, R16 span 4,
// QF 8, SF 16, Final 32 — so each card is vertically centered at the midpoint
// of its two children. Connectors are drawn with ::before/::after pseudo
// elements on the grid cells; the vertical fork span is exactly the card's
// own height (100%) because sibling centers are one card-height apart.

// Bracket dimensions — chosen so R32 cards fit ~80px content (M#/date + two
// slot lines + tiny venue flag) without overflowing. 32 rows × 2.5rem = 80rem
// (1280px) tall; R32 cards span 2 rows = 5rem (80px), R16 span 4 = 10rem,
// QF span 8 = 20rem, SF span 16 = 40rem, Final spans 32 = whole column.
// The fork connector's vertical leg = 100% of card height because sibling
// R32 card centers are exactly one card-height apart.
const BRACKET_CSS = `
.wc-bracket {
  display: grid;
  grid-template-columns:
    minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.25fr);
  grid-template-rows: repeat(32, 2.5rem);
  column-gap: 2.25rem;
  position: relative;
}
.wc-cell {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
}
.wc-cell[data-connect-in='true']::before {
  content: '';
  position: absolute;
  inset-inline-end: 100%;
  top: 50%;
  width: 1.125rem;
  height: 1px;
  background: rgba(189,232,245,0.30);
  pointer-events: none;
}
.wc-cell[data-connect-out='top']::after {
  content: '';
  position: absolute;
  inset-inline-start: 100%;
  top: 50%;
  width: 1.125rem;
  height: 100%;
  border-top: 1px solid rgba(189,232,245,0.30);
  border-inline-end: 1px solid rgba(189,232,245,0.30);
  pointer-events: none;
}
.wc-cell[data-connect-out='bot']::after {
  content: '';
  position: absolute;
  inset-inline-start: 100%;
  bottom: 50%;
  width: 1.125rem;
  height: 100%;
  border-bottom: 1px solid rgba(189,232,245,0.30);
  border-inline-end: 1px solid rgba(189,232,245,0.30);
  pointer-events: none;
}
/* RTL: the horizontal inset already flips via inset-inline-*, but the
   vertical border needs to be on the opposite visual edge. */
[dir='rtl'] .wc-cell[data-connect-out='top']::after,
[dir='rtl'] .wc-cell[data-connect-out='bot']::after {
  border-inline-end: none;
  border-inline-start: 1px solid rgba(189,232,245,0.30);
}
/* Connector accent: warmer rounds get a hotter line tint */
.wc-cell[data-tone='warm']::before, .wc-cell[data-tone='warm']::after {
  border-color: rgba(230,197,88,0.35) !important;
  background: rgba(230,197,88,0.35);
}
.wc-cell[data-tone='warmer']::before, .wc-cell[data-tone='warmer']::after {
  border-color: rgba(240,178,58,0.45) !important;
  background: rgba(240,178,58,0.45);
}
.wc-cell[data-tone='hot']::before, .wc-cell[data-tone='hot']::after {
  border-color: rgba(255,201,74,0.6) !important;
  background: rgba(255,201,74,0.6);
}
`;

function BracketTreeDesktop({ t, shortDateFmt }: { t: T; shortDateFmt: Intl.DateTimeFormat }) {
  return (
    <div className="rounded-3xl border border-border-subtle bg-gradient-to-b from-bg-card/40 to-bg-card/10 backdrop-blur-sm p-5 xl:p-7 relative overflow-hidden w-full">
      <style>{BRACKET_CSS}</style>

      {/* Ambient golden glow escalating toward the Final column */}
      <motion.div
        aria-hidden
        className="absolute top-1/2 end-0 -translate-y-1/2 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,201,74,0.18) 0%, rgba(189,232,245,0.08) 40%, transparent 70%)' }}
        animate={{ opacity: [0.45, 0.85, 0.45], scale: [1, 1.08, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' as const }}
      />
      <motion.div
        aria-hidden
        className="absolute top-1/2 start-0 -translate-y-1/2 w-52 h-52 rounded-full bg-accent-green/8 blur-3xl pointer-events-none"
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' as const }}
      />

      {/* Column headers — label each round above the tree */}
      <div className="relative grid mb-4" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.25fr)', columnGap: '2.25rem' }}>
        {([
          { label: t('wcR32'), count: 16, tone: 'cool' as const },
          { label: t('wcR16'), count: 8,  tone: 'cool' as const },
          { label: t('wcQF'),  count: 4,  tone: 'warm' as const },
          { label: t('wcSF'),  count: 2,  tone: 'warmer' as const },
          { label: t('wcFinal'), count: 1, tone: 'hot' as const },
        ]).map((h, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0">
            <span className={cn(
              'w-1.5 h-1.5 rounded-full shrink-0',
              h.tone === 'cool' ? 'bg-accent-green/50' :
              h.tone === 'warm' ? 'bg-[#E6C558]/70' :
              h.tone === 'warmer' ? 'bg-[#F0B23A]/80' :
              'bg-[#FFC94A]',
            )} />
            <span className={cn(
              'font-barlow text-[11px] font-extrabold uppercase tracking-[0.22em] truncate',
              h.tone === 'cool' ? 'text-white/85' :
              h.tone === 'warm' ? 'text-[#E6C558]' :
              h.tone === 'warmer' ? 'text-[#F0B23A]' :
              'text-[#FFC94A]',
            )}>
              {h.label}
            </span>
            <span className="text-[9px] font-mono tabular-nums text-text-muted/60 shrink-0">{h.count}</span>
          </div>
        ))}
      </div>

      <div className="relative wc-bracket">
        {/* R32 — col 1 */}
        {WC2026_R32.map((m, i) => (
          <div
            key={m.id}
            className="wc-cell"
            data-connect-out={i % 2 === 0 ? 'top' : 'bot'}
            data-tone="cool"
            style={{ gridColumn: 1, gridRow: `${i * 2 + 1} / span 2` }}
          >
            <BracketMatchCard match={m} round="r32" shortDateFmt={shortDateFmt} />
          </div>
        ))}

        {/* R16 — col 2 */}
        {WC2026_R16.map((m, i) => (
          <div
            key={m.id}
            className="wc-cell"
            data-connect-in="true"
            data-connect-out={i % 2 === 0 ? 'top' : 'bot'}
            data-tone="cool"
            style={{ gridColumn: 2, gridRow: `${i * 4 + 1} / span 4` }}
          >
            <BracketMatchCard match={m} round="r16" shortDateFmt={shortDateFmt} />
          </div>
        ))}

        {/* QF — col 3, warm gold */}
        {WC2026_QF.map((m, i) => (
          <div
            key={m.id}
            className="wc-cell"
            data-connect-in="true"
            data-connect-out={i % 2 === 0 ? 'top' : 'bot'}
            data-tone="warm"
            style={{ gridColumn: 3, gridRow: `${i * 8 + 1} / span 8` }}
          >
            <BracketMatchCard match={m} round="qf" shortDateFmt={shortDateFmt} />
          </div>
        ))}

        {/* SF — col 4, warmer gold */}
        {WC2026_SF.map((m, i) => (
          <div
            key={m.id}
            className="wc-cell"
            data-connect-in="true"
            data-connect-out={i === 0 ? 'top' : 'bot'}
            data-tone="warmer"
            style={{ gridColumn: 4, gridRow: `${i * 16 + 1} / span 16` }}
          >
            <BracketMatchCard match={m} round="sf" shortDateFmt={shortDateFmt} />
          </div>
        ))}

        {/* Final — col 5, hot gold */}
        <div
          className="wc-cell"
          data-connect-in="true"
          data-tone="hot"
          style={{ gridColumn: 5, gridRow: '1 / span 32' }}
        >
          <FinalApex t={t} match={WC2026_FINAL} shortDateFmt={shortDateFmt} />
        </div>
      </div>

      {/* 3rd-place — "the other final", lower-key */}
      <div className="relative mt-8 pt-5 border-t border-border-subtle/40">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-text-muted/60" aria-hidden />
          <span className="font-barlow text-[11px] md:text-xs font-extrabold uppercase tracking-[0.22em] text-white/80">
            {t('wcThirdPlace')}
          </span>
          <span className="text-[10px] text-text-muted/70 tabular-nums">
            {shortDateFmt.format(new Date(WC2026_THIRD.date))}
          </span>
          <span className="flex-1 h-px bg-border-subtle/30" />
        </div>
        <div className="max-w-md">
          <BracketMatchCard match={WC2026_THIRD} round="third" shortDateFmt={shortDateFmt} />
        </div>
      </div>
    </div>
  );
}

/* ──────── Bracket match card (compact, used in the tree) ──────── */

// Tone palette for round-based gold progression.
// Cool navy early → warm gold at the stakes rounds → hot gold at the Final.
const ROUND_TONES: Record<BracketRound, {
  border: string; glow: string | null; accentText: string; dot: string;
  bg: string; winnerIcon: string;
}> = {
  r32: {
    border: 'rgba(189,232,245,0.22)',
    glow: null,
    accentText: 'text-accent-green/80',
    dot: 'bg-accent-green/40',
    bg: 'bg-bg-card/80',
    winnerIcon: 'text-accent-green/70',
  },
  r16: {
    border: 'rgba(189,232,245,0.30)',
    glow: '0 0 16px rgba(73,136,196,0.12)',
    accentText: 'text-accent-green',
    dot: 'bg-accent-green/55',
    bg: 'bg-bg-card/85',
    winnerIcon: 'text-accent-green',
  },
  qf: {
    border: 'rgba(230,197,88,0.40)',
    glow: '0 0 22px rgba(230,197,88,0.14)',
    accentText: 'text-[#E6C558]',
    dot: 'bg-[#E6C558]/75',
    bg: 'bg-gradient-to-br from-[#E6C558]/6 to-bg-card/85',
    winnerIcon: 'text-[#E6C558]',
  },
  sf: {
    border: 'rgba(240,178,58,0.50)',
    glow: '0 0 28px rgba(240,178,58,0.22)',
    accentText: 'text-[#F0B23A]',
    dot: 'bg-[#F0B23A]',
    bg: 'bg-gradient-to-br from-[#F0B23A]/8 to-bg-card/85',
    winnerIcon: 'text-[#F0B23A]',
  },
  final: {
    border: 'rgba(255,201,74,0.7)',
    glow: '0 0 48px rgba(255,201,74,0.35)',
    accentText: 'text-[#FFC94A]',
    dot: 'bg-[#FFC94A]',
    bg: 'bg-gradient-to-br from-[#FFC94A]/15 to-bg-card/85',
    winnerIcon: 'text-[#FFC94A]',
  },
  third: {
    border: 'rgba(189,232,245,0.20)',
    glow: null,
    accentText: 'text-text-muted',
    dot: 'bg-text-muted/50',
    bg: 'bg-bg-card/60',
    winnerIcon: 'text-text-muted/80',
  },
};

function BracketMatchCard({ match, round, shortDateFmt }: {
  match: WCKnockoutMatch;
  round: BracketRound;
  shortDateFmt: Intl.DateTimeFormat;
}) {
  const stadium = match.venueId ? WC2026_STADIUM_BY_ID[match.venueId] : undefined;
  if (round === 'final') return null; // handled by FinalApex

  const tone = ROUND_TONES[round];
  const showCity = round !== 'r32'; // R32 cards are too tight for a city row

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.22, ease: 'easeOut' as const }}
      whileHover={{ scale: 1.03, y: -1 }}
      className={cn(
        'w-full rounded-lg border backdrop-blur-sm overflow-hidden',
        tone.bg,
      )}
      style={{
        borderColor: tone.border,
        boxShadow: tone.glow ?? undefined,
      }}
    >
      {/* Header row: M-label + date + mini host flag on the end */}
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-white/5">
        <span
          className={cn(
            'text-[9.5px] font-mono font-extrabold tabular-nums tracking-wider shrink-0',
            tone.accentText,
          )}
          title={`Match ${match.label}`}
        >
          M{match.label}
        </span>
        <span className="text-[9px] text-text-muted/70 tabular-nums truncate flex-1">
          {shortDateFmt.format(new Date(match.date))}
        </span>
        {stadium && (
          <span aria-hidden className="text-[10px] leading-none shrink-0" title={`${stadium.city} · ${stadium.name}`}>
            {stadium.countryFlag}
          </span>
        )}
      </div>

      {/* Two slots — dense, one line each */}
      <div className="px-2 py-1.5">
        <BracketSlot label={match.home} tone={tone} />
        <div className="h-px bg-white/5 my-1" />
        <BracketSlot label={match.away} tone={tone} />
      </div>

      {/* City pill — only on R16+ where we have vertical room */}
      {showCity && stadium && (
        <div className="px-2 pb-1 pt-0.5 flex items-center gap-1 border-t border-white/5">
          <MapPin size={9} className={cn('shrink-0', tone.accentText, 'opacity-70')} />
          <span className="text-[9.5px] text-text-muted/85 truncate flex-1 min-w-0" title={stadium.name}>
            {stadium.city}
          </span>
        </div>
      )}
    </motion.div>
  );
}

function BracketSlot({ label, tone }: {
  label: string;
  tone: typeof ROUND_TONES[BracketRound];
}) {
  const slot = parseSlotLabel(label);
  return (
    <div className="flex items-center gap-1.5 min-w-0 py-0.5">
      <span className={cn('w-1 h-1 rounded-full shrink-0', tone.dot)} aria-hidden />
      <span className="font-barlow font-bold text-[11.5px] uppercase tracking-wide text-white/95 truncate leading-tight">
        {slot.primary}
      </span>
      {slot.hint && (
        <span className="text-[9px] text-text-muted/65 font-mono truncate">
          {slot.hint}
        </span>
      )}
    </div>
  );
}

/** Parses FIFA slot labels into a primary label + helper hint.
 *  "1A"            → { primary: "1A",       hint: null }
 *  "W 73"          → { primary: "W 73",     hint: null }
 *  "3[D/E/F/J]"    → { primary: "3rd",      hint: "D/E/F/J" } — keeps the card readable
 */
function parseSlotLabel(label: string): { primary: string; hint: string | null } {
  const m = label.match(/^3\[([A-Z/]+)\]$/);
  if (m) return { primary: '3rd', hint: m[1] };
  return { primary: label, hint: null };
}

/* ──────── Final apex card (the climax) ──────── */

function FinalApex({ t, match, shortDateFmt }: {
  t: T; match: WCKnockoutMatch; shortDateFmt: Intl.DateTimeFormat;
}) {
  const stadium = match.venueId ? WC2026_STADIUM_BY_ID[match.venueId] : undefined;
  const toneFinal = ROUND_TONES.final;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: 'easeOut' as const }}
      className="relative w-full rounded-2xl border overflow-hidden"
      style={{
        borderColor: toneFinal.border,
        background:
          'linear-gradient(135deg, rgba(255,201,74,0.18) 0%, rgba(230,156,56,0.10) 45%, rgba(15,40,84,0.55) 100%)',
        boxShadow: '0 0 64px rgba(255,201,74,0.28)',
      }}
    >
      {/* Shimmering gold orb behind the trophy */}
      <motion.div
        aria-hidden
        className="absolute -top-14 -end-14 w-48 h-48 rounded-full blur-2xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,201,74,0.55) 0%, rgba(240,178,58,0.2) 50%, transparent 75%)' }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.55, 0.95, 0.55] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' as const }}
      />

      {/* Subtle ray lines — conveys "destination" without going loud */}
      <svg aria-hidden className="absolute inset-0 w-full h-full opacity-[0.08] pointer-events-none" preserveAspectRatio="none">
        <defs>
          <linearGradient id="wc-ray" x1="0" y1="0" x2="1" y2="0.5">
            <stop offset="0" stopColor="#FFC94A" stopOpacity="0" />
            <stop offset="0.5" stopColor="#FFC94A" stopOpacity="1" />
            <stop offset="1" stopColor="#FFC94A" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.15, 0.35, 0.6, 0.8].map(y => (
          <line key={y} x1="0%" y1={`${y * 100}%`} x2="100%" y2={`${(y + 0.08) * 100}%`} stroke="url(#wc-ray)" strokeWidth="1" />
        ))}
      </svg>

      {/* Header: Trophy orb + FINAL label + date */}
      <div className="relative flex items-center gap-3 px-4 pt-4 pb-2.5">
        <motion.div
          className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(255,201,74,0.28) 0%, rgba(240,178,58,0.14) 100%)',
            border: '1px solid rgba(255,201,74,0.55)',
            boxShadow: '0 0 20px rgba(255,201,74,0.35)',
          }}
          animate={{ y: [0, -2.5, 0], rotate: [0, -3, 3, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' as const }}
        >
          <Trophy size={22} className="text-[#FFC94A]" strokeWidth={1.85} />
        </motion.div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[#FFC94A] text-[10px] font-extrabold uppercase tracking-[0.28em] leading-none">
              {t('wcFinal')}
            </span>
            <Sparkles size={10} className="text-[#FFC94A]/80" />
          </div>
          <div className="text-[10.5px] text-white/80 tabular-nums mt-1">
            {t('wcMatch')} {match.label} · {shortDateFmt.format(new Date(match.date))}
          </div>
        </div>
      </div>

      {/* Matchup */}
      <div className="relative px-4 py-2 space-y-1.5">
        <BracketSlot label={match.home} tone={toneFinal} />
        <div className="flex items-center gap-2">
          <span className="flex-1 h-px bg-[#FFC94A]/30" />
          <span className="text-[9px] font-extrabold uppercase tracking-[0.28em] text-[#FFC94A]/85">vs</span>
          <span className="flex-1 h-px bg-[#FFC94A]/30" />
        </div>
        <BracketSlot label={match.away} tone={toneFinal} />
      </div>

      {/* Stadium — the headline: MetLife, NY/NJ */}
      {stadium && (
        <div className="relative mx-3 mt-2 mb-2 rounded-xl border border-[#FFC94A]/30 bg-[#FFC94A]/5 px-3 py-2">
          <div className="flex items-center gap-1.5 mb-0.5">
            <MapPin size={10} className="text-[#FFC94A]/90 shrink-0" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#FFC94A]/90">
              {t('wcFinalVenue')}
            </span>
            <span aria-hidden className="ms-auto text-[11px] leading-none">{stadium.countryFlag}</span>
          </div>
          <div className="font-barlow font-extrabold text-[13px] uppercase tracking-wide text-white leading-tight truncate" title={stadium.name}>
            {stadium.name}
          </div>
          <div className="text-[10px] text-white/60 truncate">{stadium.city}</div>
        </div>
      )}

      {/* Champion ribbon */}
      <div className="relative px-4 pb-3 pt-1 flex items-center gap-2">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#FFC94A]/50 to-transparent" />
        <span className="text-[9px] font-extrabold uppercase tracking-[0.32em] text-[#FFC94A]">
          {t('wcChampion')}
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#FFC94A]/50 to-transparent" />
      </div>
    </motion.div>
  );
}

/* ──────── Mobile stacked view ──────── */

function BracketStackedMobile({ t, shortDateFmt }: { t: T; shortDateFmt: Intl.DateTimeFormat }) {
  const rounds: { label: string; matches: WCKnockoutMatch[]; round: BracketRound; cols: string }[] = [
    { label: t('wcR32'), matches: WC2026_R32, round: 'r32', cols: 'grid-cols-1 sm:grid-cols-2' },
    { label: t('wcR16'), matches: WC2026_R16, round: 'r16', cols: 'grid-cols-1 sm:grid-cols-2' },
    { label: t('wcQF'),  matches: WC2026_QF,  round: 'qf',  cols: 'grid-cols-1 sm:grid-cols-2' },
    { label: t('wcSF'),  matches: WC2026_SF,  round: 'sf',  cols: 'grid-cols-1 sm:grid-cols-2' },
  ];

  return (
    <div className="space-y-5">
      {rounds.map((r, idx) => (
        <div key={r.label}>
          <div className="flex items-center gap-3 mb-2.5">
            <span
              aria-hidden
              className="w-1.5 h-1.5 rounded-full bg-accent-green/70 shrink-0"
            />
            <span className="font-barlow text-[12px] font-bold uppercase tracking-[0.22em] text-white/90">
              {r.label}
            </span>
            <span className="text-[10px] text-text-muted/70 tabular-nums">
              · {r.matches.length} {t('wcStatMatches').toLowerCase()}
            </span>
            <span className="flex-1 h-px bg-border-subtle/30" />
          </div>
          <div className={cn('grid gap-2', r.cols)}>
            {r.matches.map(m => (
              <BracketMatchCard key={m.id} match={m} round={r.round} shortDateFmt={shortDateFmt} />
            ))}
          </div>
          {idx < rounds.length - 1 && (
            <div aria-hidden className="flex justify-center mt-3">
              <motion.span
                className="w-px bg-gradient-to-b from-accent-green/40 to-transparent"
                style={{ height: 18 }}
                animate={{ opacity: [0.4, 0.9, 0.4] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' as const }}
              />
            </div>
          )}
        </div>
      ))}

      {/* Final — full-width hero */}
      <div className="pt-2">
        <FinalApex t={t} match={WC2026_FINAL} shortDateFmt={shortDateFmt} />
      </div>

      {/* 3rd place — muted */}
      <div>
        <div className="flex items-center gap-3 mb-2.5">
          <span className="font-barlow text-[12px] font-bold uppercase tracking-[0.22em] text-white/80">
            {t('wcThirdPlace')}
          </span>
          <span className="text-[10px] text-text-muted/70 tabular-nums">
            {shortDateFmt.format(new Date(WC2026_THIRD.date))}
          </span>
          <span className="flex-1 h-px bg-border-subtle/30" />
        </div>
        <BracketMatchCard match={WC2026_THIRD} round="third" shortDateFmt={shortDateFmt} />
      </div>
    </div>
  );
}

/* ═════════════════════════ VENUES TAB ═════════════════════════ */

function VenuesTab({ t }: { t: T }) {
  return (
    <section className="space-y-3">
      <SectionHeader label={t('wcHostStadiums')} count={`${WC2026_STADIUMS.length} ${t('wcStatCities').toLowerCase()}`} />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {WC2026_STADIUMS.map((s, i) => <StadiumCard key={s.id} stadium={s} index={i} t={t} />)}
      </div>
    </section>
  );
}

function StadiumCard({ stadium, index, t }: { stadium: WCStadium; index: number; t: T }) {
  const roleMap: Record<NonNullable<WCStadium['role']>, { key: TranslationKey; style: string }> = {
    final:        { key: 'wcRoleFinal',    style: 'text-accent-green border-accent-green/40 bg-accent-green/15' },
    semifinal:    { key: 'wcRoleSemi',     style: 'text-accent-green/90 border-accent-green/25 bg-accent-green/10' },
    third:        { key: 'wcRoleThird',    style: 'text-accent-green/80 border-accent-green/20 bg-accent-green/5' },
    quarterfinal: { key: 'wcRoleQuarter',  style: 'text-accent-green/80 border-accent-green/20 bg-accent-green/5' },
    opening:      { key: 'wcRoleOpening',  style: 'text-accent-green border-accent-green/35 bg-accent-green/10' },
  };
  const role = stadium.role ? roleMap[stadium.role] : null;
  const isMarquee = stadium.role === 'final' || stadium.role === 'opening';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ delay: index * 0.025, duration: 0.24, ease: 'easeOut' as const }}
      whileHover={{ y: -2 }}
      className={cn(
        'rounded-xl border px-3 py-3 relative overflow-hidden',
        isMarquee
          ? 'border-accent-green/35 bg-gradient-to-br from-accent-green/10 to-transparent'
          : 'border-border-subtle bg-bg-card',
      )}
      style={isMarquee ? { boxShadow: '0 0 32px rgba(189,232,245,0.14)' } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <span aria-hidden className="text-lg leading-none">{stadium.countryFlag}</span>
        {role && (
          <span className={cn(
            'text-[9px] font-bold uppercase tracking-widest rounded-full px-1.5 py-0.5 border leading-none',
            role.style,
          )}>
            {t(role.key)}
          </span>
        )}
      </div>
      <div className="font-barlow font-extrabold text-[13px] uppercase tracking-wide text-white leading-tight mt-2.5 truncate">
        {stadium.name}
      </div>
      <div className="text-[10.5px] text-text-muted mt-0.5 truncate">
        {stadium.city}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-subtle/40">
        <span className="text-[9px] uppercase tracking-widest text-text-muted/70">
          {t('wcCapacity')}
        </span>
        <span className="text-[11px] font-mono tabular-nums font-bold text-white">
          {stadium.capacity.toLocaleString()}
        </span>
      </div>
    </motion.div>
  );
}

/* ═════════════════════════ SHARED ═════════════════════════ */

function SectionHeader({ label, count }: { label: string; count?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="font-barlow text-sm md:text-base font-bold uppercase tracking-[0.22em] text-white/90">
        {label}
      </h3>
      {count && (
        <span className="text-[10px] text-text-muted uppercase tracking-wider">
          {count}
        </span>
      )}
    </div>
  );
}
