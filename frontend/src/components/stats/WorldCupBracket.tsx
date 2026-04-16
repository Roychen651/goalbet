import { useMemo, useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Trophy, Calendar, MapPin, Globe, Users, Target, CalendarDays, Zap,
  LayoutGrid, ListOrdered, GitBranch, Building2, ChevronRight,
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
type Tone = 'muted' | 'accent-soft' | 'accent' | 'gold';
type KickoffState = { days: number; phase: 'pre' | 'live' | 'ended' };
type TabId = 'overview' | 'groups' | 'fixtures' | 'knockouts' | 'venues';

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
    <li className={cn(
      'flex items-center gap-3 px-4 py-2.5 border-t border-border-subtle/40 first:border-t-0',
      isTbd ? 'opacity-45' : '',
    )}>
      <span className="w-4 text-end text-text-muted font-mono text-[11px] tabular-nums shrink-0">
        {position}
      </span>
      <span aria-hidden className="text-lg leading-none shrink-0 w-6 text-center">
        {team.flag}
      </span>
      <span className={cn(
        'flex-1 min-w-0 text-sm truncate',
        isTbd ? 'text-text-muted italic' : 'text-white font-medium',
      )}>
        {team.name}
      </span>
      {team.host && (
        <span className="text-[9px] font-bold uppercase tracking-wider text-accent-green bg-accent-green/10 border border-accent-green/25 rounded-full px-1.5 py-0.5 leading-none">
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
    <div className="flex items-center gap-2.5">
      <span aria-hidden className="text-base leading-none shrink-0 w-6 text-center">
        {team.flag}
      </span>
      <span className="flex-1 min-w-0 font-medium text-sm text-white truncate">
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
    <div className="space-y-5">
      <KnockoutRound
        t={t} shortDateFmt={shortDateFmt}
        label={t('wcR32')}
        matches={WC2026_R32}
        tone="muted"
        gridClass="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        dateRange={`${shortDateFmt.format(new Date('2026-06-28'))} – ${shortDateFmt.format(new Date('2026-07-03'))}`}
      />
      <KnockoutRound
        t={t} shortDateFmt={shortDateFmt}
        label={t('wcR16')}
        matches={WC2026_R16}
        tone="accent-soft"
        gridClass="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        dateRange={`${shortDateFmt.format(new Date('2026-07-04'))} – ${shortDateFmt.format(new Date('2026-07-07'))}`}
      />
      <KnockoutRound
        t={t} shortDateFmt={shortDateFmt}
        label={t('wcQF')}
        matches={WC2026_QF}
        tone="accent"
        gridClass="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        dateRange={`${shortDateFmt.format(new Date('2026-07-09'))} – ${shortDateFmt.format(new Date('2026-07-11'))}`}
      />
      <KnockoutRound
        t={t} shortDateFmt={shortDateFmt}
        label={t('wcSF')}
        matches={WC2026_SF}
        tone="accent"
        gridClass="grid-cols-1 sm:grid-cols-2"
        dateRange={`${shortDateFmt.format(new Date('2026-07-14'))} – ${shortDateFmt.format(new Date('2026-07-15'))}`}
      />
      <KnockoutRound
        t={t} shortDateFmt={shortDateFmt}
        label={t('wcThirdPlace')}
        matches={[WC2026_THIRD]}
        tone="accent-soft"
        gridClass="grid-cols-1"
        dateRange={shortDateFmt.format(new Date('2026-07-18'))}
      />
      <FinalRound t={t} match={WC2026_FINAL} shortDateFmt={shortDateFmt} />
    </div>
  );
}

function KnockoutRound({ t, label, matches, tone, gridClass, dateRange, shortDateFmt }: {
  t: T;
  label: string;
  matches: WCKnockoutMatch[];
  tone: Tone;
  gridClass: string;
  dateRange: string;
  shortDateFmt: Intl.DateTimeFormat;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className={cn(
          'font-barlow text-sm md:text-base font-bold uppercase tracking-[0.22em]',
          tone === 'gold' ? 'text-accent-green' : 'text-white/90',
        )}>
          {label}
        </h3>
        <span className="text-[10px] text-text-muted uppercase tracking-wider tabular-nums">
          {dateRange} · {matches.length} {t('wcStatMatches').toLowerCase()}
        </span>
      </div>
      <div className={cn('grid gap-2.5', gridClass)}>
        {matches.map((m, i) => (
          <KnockoutMatchCard key={m.id} t={t} match={m} tone={tone} shortDateFmt={shortDateFmt} delay={i * 0.03} />
        ))}
      </div>
    </section>
  );
}

function FinalRound({ t, match, shortDateFmt }: {
  t: T; match: WCKnockoutMatch; shortDateFmt: Intl.DateTimeFormat;
}) {
  const stadium = match.venueId ? WC2026_STADIUM_BY_ID[match.venueId] : undefined;
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="font-barlow text-sm md:text-base font-bold uppercase tracking-[0.22em] text-accent-green">
          {t('wcFinal')}
        </h3>
        <span className="text-[10px] text-text-muted uppercase tracking-wider tabular-nums">
          {shortDateFmt.format(new Date(match.date))}
        </span>
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.4, ease: 'easeOut' as const }}
        className="relative rounded-3xl border border-accent-green/45 overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, rgba(189,232,245,0.14) 0%, rgba(73,136,196,0.10) 55%, rgba(15,40,84,0.30) 100%)',
          boxShadow: '0 0 56px rgba(189,232,245,0.24)',
        }}
      >
        <motion.div
          aria-hidden
          className="absolute -top-16 -end-16 w-56 h-56 rounded-full bg-accent-green/15 blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.45, 0.85, 0.45] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' as const }}
        />
        <div className="relative px-5 py-6 md:px-8 md:py-8 flex flex-col md:flex-row items-center gap-5">
          <div className="shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-accent-green/15 border border-accent-green/40 flex items-center justify-center">
            <Trophy className="text-accent-green w-9 h-9 md:w-10 md:h-10" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0 text-center md:text-start">
            <div className="text-accent-green text-[10px] font-bold uppercase tracking-[0.28em]">
              {t('wcMatchNumber')} {match.label} · {t('wcFinal')}
            </div>
            <div className="flex items-center justify-center md:justify-start gap-3 md:gap-5 mt-2">
              <div className="font-barlow font-extrabold text-lg md:text-2xl uppercase text-white tracking-wide truncate">
                {match.home}
              </div>
              <div className="text-accent-green/70 text-[11px] font-bold uppercase tracking-[0.22em]">vs</div>
              <div className="font-barlow font-extrabold text-lg md:text-2xl uppercase text-white tracking-wide truncate">
                {match.away}
              </div>
            </div>
            {stadium && (
              <div className="flex items-center justify-center md:justify-start gap-2 text-text-muted text-[11px] md:text-xs mt-2.5">
                <MapPin size={12} />
                <span>{stadium.name}</span>
                <span className="opacity-40">·</span>
                <span>{stadium.city}</span>
                <span aria-hidden>{stadium.countryFlag}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function KnockoutMatchCard({ t, match, tone, shortDateFmt, delay }: {
  t: T;
  match: WCKnockoutMatch;
  tone: Tone;
  shortDateFmt: Intl.DateTimeFormat;
  delay: number;
}) {
  const stadium = match.venueId ? WC2026_STADIUM_BY_ID[match.venueId] : undefined;

  const frame =
    tone === 'gold'
      ? 'border-accent-green/50 bg-gradient-to-br from-accent-green/15 to-accent-green/5'
      : tone === 'accent'
      ? 'border-accent-green/30 bg-accent-green/5'
      : tone === 'accent-soft'
      ? 'border-accent-green/20 bg-bg-card'
      : 'border-border-subtle bg-bg-card';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 4 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ delay, duration: 0.24, ease: 'easeOut' as const }}
      whileHover={{ y: -2 }}
      className={cn('rounded-xl border overflow-hidden', frame)}
      style={tone === 'gold' ? { boxShadow: '0 0 36px rgba(189,232,245,0.22)' } : undefined}
    >
      <div className="px-3 pt-2.5 pb-1 flex items-center justify-between gap-2">
        <span className={cn(
          'inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider tabular-nums rounded-full px-2 py-0.5 border leading-none',
          tone === 'gold'
            ? 'border-accent-green/45 bg-accent-green/15 text-accent-green'
            : 'border-border-subtle bg-bg-card/60 text-text-muted',
        )}>
          <Calendar size={10} />
          {shortDateFmt.format(new Date(match.date))}
        </span>
        <span className="text-[9px] font-mono tabular-nums text-text-muted/70">
          {t('wcMatchNumber')} {match.label}
        </span>
      </div>
      <div className="px-3 py-2">
        <BracketSlot label={match.home} tone={tone} />
        <div className="flex items-center gap-2 my-1.5">
          <span className="flex-1 h-px bg-border-subtle/60" />
          <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-text-muted/80">vs</span>
          <span className="flex-1 h-px bg-border-subtle/60" />
        </div>
        <BracketSlot label={match.away} tone={tone} />
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

function BracketSlot({ label, tone }: { label: string; tone: Tone }) {
  const textClass =
    tone === 'gold' ? 'text-accent-green'
    : tone === 'accent' ? 'text-white'
    : tone === 'accent-soft' ? 'text-white/95'
    : 'text-white/85';
  return (
    <div className={cn('font-barlow font-bold text-sm uppercase tracking-wide truncate leading-tight', textClass)}>
      {label}
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
