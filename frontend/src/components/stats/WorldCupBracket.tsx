import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, Calendar, MapPin, Globe, Users, Target, CalendarDays, Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLangStore } from '../../stores/langStore';
import { type TranslationKey } from '../../lib/i18n';
import {
  WC2026_INFO,
  WC2026_GROUPS,
  WC2026_R32, WC2026_R16, WC2026_QF, WC2026_SF,
  WC2026_THIRD, WC2026_FINAL,
  WC2026_PHASES,
  WC2026_STADIUMS,
  WC2026_STADIUM_BY_ID,
  type WCGroup, type WCTeam, type WCKnockoutMatch, type WCStadium, type WCPhase,
} from '../../lib/worldCup2026';

type T = (key: TranslationKey) => string;
type Tone = 'muted' | 'accent-soft' | 'accent' | 'gold';
type KickoffState = { days: number; phase: 'pre' | 'live' | 'ended' };

export function WorldCupBracket() {
  const { t, lang } = useLangStore();
  const locale = lang === 'he' ? 'he-IL' : 'en-US';

  const kickoff = useMemo<KickoffState>(() => {
    const start = new Date(WC2026_INFO.startDate).getTime();
    const end = new Date(WC2026_INFO.endDate).getTime() + 86400000; // include final day
    const now = Date.now();
    if (now < start) return { days: Math.ceil((start - now) / 86400000), phase: 'pre' };
    if (now < end)   return { days: Math.ceil((end - now) / 86400000),   phase: 'live' };
    return { days: 0, phase: 'ended' };
  }, []);

  const longDateFmt  = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }), [locale]);
  const shortDateFmt = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }), [locale]);

  return (
    <div className="space-y-6">
      <Hero t={t} kickoff={kickoff} longDateFmt={longDateFmt} />
      <StatStrip t={t} />
      <KeyMatches t={t} longDateFmt={longDateFmt} />
      <PhaseTimeline t={t} phases={WC2026_PHASES} shortDateFmt={shortDateFmt} />
      <GroupsSection t={t} groups={WC2026_GROUPS} />
      <KnockoutSection t={t} shortDateFmt={shortDateFmt} />
      <StadiumsSection t={t} stadiums={WC2026_STADIUMS} />
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
      {/* Drifting radial mesh */}
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
      {/* Dot grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(189,232,245,0.7) 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      />

      <div className="relative px-5 py-6 md:px-10 md:py-10">
        <div className="flex items-start gap-4 md:gap-6">
          <motion.div
            className="shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-accent-green/10 border border-accent-green/30 flex items-center justify-center"
            animate={{ y: [0, -4, 0], rotate: [0, -2, 0, 2, 0] }}
            transition={{ duration: 6, ease: 'easeInOut' as const, repeat: Infinity }}
            style={{ boxShadow: '0 0 28px rgba(73,136,196,0.4)' }}
          >
            <Trophy className="text-accent-green w-8 h-8 md:w-10 md:h-10" strokeWidth={1.75} />
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="text-accent-green text-[11px] font-bold uppercase tracking-[0.28em]">
              {t('wcRouteToTrophy')}
            </div>
            <h2 className="font-barlow font-extrabold text-3xl md:text-5xl uppercase tracking-wide text-white leading-[1.05] mt-1">
              {WC2026_INFO.name}
            </h2>
            <div className="text-text-muted text-xs md:text-sm mt-1.5 font-medium">
              {t('wcPathToGlory')}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 text-text-muted text-xs md:text-[13px]">
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

        <div className="mt-5 md:mt-6">
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
        className="rounded-2xl border border-accent-green/45 bg-accent-green/10 px-5 py-4 flex items-center gap-4"
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
      <div className="rounded-2xl border border-border-subtle bg-bg-card px-5 py-4">
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
      className="rounded-2xl border border-accent-green/30 bg-bg-card/60 backdrop-blur-sm px-5 py-4 flex items-center gap-5"
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

/* ═════════════════════════ STATS ═════════════════════════ */

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

/* ═════════════════ OPENING & FINAL SPOTLIGHTS ═════════════════ */

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

/* ═════════════════════ PHASE TIMELINE ═════════════════════ */

function PhaseTimeline({ t, phases, shortDateFmt }: {
  t: T; phases: WCPhase[]; shortDateFmt: Intl.DateTimeFormat;
}) {
  const now = Date.now();
  return (
    <section className="space-y-3">
      <SectionHeader label={t('wcTournamentPhases')} />
      <div data-lenis-prevent className="overflow-x-auto overscroll-contain pb-1">
        <div className="flex gap-2 min-w-max">
          {phases.map((p, i) => {
            const start = new Date(p.startDate).getTime();
            const end = new Date(p.endDate).getTime() + 86400000;
            const status: 'past' | 'current' | 'upcoming' =
              now >= end ? 'past' : now >= start ? 'current' : 'upcoming';
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -6 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04, duration: 0.28, ease: 'easeOut' as const }}
                className={cn(
                  'rounded-xl border px-3.5 py-3 min-w-[150px]',
                  status === 'current'
                    ? 'border-accent-green/50 bg-accent-green/10'
                    : status === 'past'
                    ? 'border-border-subtle bg-bg-card/40 opacity-75'
                    : 'border-border-subtle bg-bg-card',
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      status === 'current' ? 'bg-accent-green' : 'bg-text-muted/60',
                    )}
                  />
                  <div className="font-barlow text-[10px] font-bold uppercase tracking-widest text-text-muted">
                    {p.matches} {t('wcStatMatches').toLowerCase()}
                  </div>
                </div>
                <div className="font-barlow font-bold text-[13px] uppercase tracking-wide text-white mt-1.5 leading-tight">
                  {t(p.labelKey)}
                </div>
                <div className="text-[10px] text-text-muted/80 mt-1 leading-tight">
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
      </div>
    </section>
  );
}

/* ═════════════════════════ GROUPS ═════════════════════════ */

function GroupsSection({ t, groups }: { t: T; groups: WCGroup[] }) {
  return (
    <section className="space-y-3">
      <SectionHeader label={t('wcGroupStage')} count={`${groups.length} ${t('wcGroups')}`} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {groups.map((g, i) => <GroupCard key={g.id} group={g} index={i} />)}
      </div>
    </section>
  );
}

function GroupCard({ group, index }: { group: WCGroup; index: number }) {
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
          {`Group ${group.id}`}
        </div>
        <span className="text-[10px] font-mono tabular-nums text-accent-green bg-accent-green/10 border border-accent-green/25 rounded-full px-1.5 py-0.5 leading-none">
          {group.teams.length}
        </span>
      </div>
      <ul>
        {group.teams.map((team, i) => (
          <TeamRow key={i} team={team} position={i + 1} />
        ))}
      </ul>
    </motion.div>
  );
}

function TeamRow({ team, position }: { team: WCTeam; position: number }) {
  const isTbd = team.code === 'TBD';
  return (
    <li className={cn(
      'flex items-center gap-3 px-4 py-2.5 border-t border-border-subtle/40 first:border-t-0',
      isTbd ? 'opacity-45' : '',
    )}>
      <span className="w-4 text-end text-text-muted font-mono text-[11px] tabular-nums shrink-0">
        {position}
      </span>
      <span aria-hidden className="text-lg leading-none shrink-0 w-5 text-center">
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
          HOST
        </span>
      )}
    </li>
  );
}

/* ═════════════════════════ BRACKET ═════════════════════════ */

function KnockoutSection({ t, shortDateFmt }: { t: T; shortDateFmt: Intl.DateTimeFormat }) {
  const total = WC2026_R32.length + WC2026_R16.length + WC2026_QF.length + WC2026_SF.length + 2;
  return (
    <section className="space-y-3">
      <SectionHeader label={t('wcKnockoutStage')} count={`${total} ${t('wcStatMatches').toLowerCase()}`} />
      <div data-lenis-prevent className="overflow-x-auto overscroll-contain pb-2">
        <div className="flex gap-3 min-w-max items-stretch">
          <BracketColumn
            t={t}
            label={t('wcR32')}
            matches={WC2026_R32}
            tone="muted"
            dateRange={`${shortDateFmt.format(new Date('2026-06-28'))} – ${shortDateFmt.format(new Date('2026-07-03'))}`}
            widthClass="w-[200px]"
            shortDateFmt={shortDateFmt}
          />
          <BracketColumn
            t={t}
            label={t('wcR16')}
            matches={WC2026_R16}
            tone="accent-soft"
            dateRange={`${shortDateFmt.format(new Date('2026-07-04'))} – ${shortDateFmt.format(new Date('2026-07-07'))}`}
            widthClass="w-[210px]"
            shortDateFmt={shortDateFmt}
          />
          <BracketColumn
            t={t}
            label={t('wcQF')}
            matches={WC2026_QF}
            tone="accent"
            dateRange={`${shortDateFmt.format(new Date('2026-07-09'))} – ${shortDateFmt.format(new Date('2026-07-11'))}`}
            widthClass="w-[220px]"
            shortDateFmt={shortDateFmt}
          />
          <BracketColumn
            t={t}
            label={t('wcSF')}
            matches={WC2026_SF}
            tone="accent"
            dateRange={`${shortDateFmt.format(new Date('2026-07-14'))} – ${shortDateFmt.format(new Date('2026-07-15'))}`}
            widthClass="w-[230px]"
            shortDateFmt={shortDateFmt}
          />
          <BracketColumn
            t={t}
            label={t('wcFinal')}
            matches={[WC2026_FINAL]}
            tone="gold"
            dateRange={shortDateFmt.format(new Date('2026-07-19'))}
            widthClass="w-[250px]"
            shortDateFmt={shortDateFmt}
            extra={
              <MatchCard
                t={t}
                match={WC2026_THIRD}
                tone="muted"
                shortDateFmt={shortDateFmt}
                caption={t('wcThirdPlace')}
              />
            }
          />
        </div>
      </div>
    </section>
  );
}

function BracketColumn({ t, label, matches, tone, dateRange, widthClass, shortDateFmt, extra }: {
  t: T;
  label: string;
  matches: WCKnockoutMatch[];
  tone: Tone;
  dateRange: string;
  widthClass: string;
  shortDateFmt: Intl.DateTimeFormat;
  extra?: React.ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-2 shrink-0', widthClass)}>
      <div className="border-b border-border-subtle/60 pb-2 mb-1">
        <div className={cn(
          'font-barlow text-[11px] font-bold uppercase tracking-[0.22em]',
          tone === 'gold' ? 'text-accent-green' : 'text-text-muted',
        )}>
          {label}
        </div>
        <div className="text-[10px] text-text-muted/70 mt-0.5 tabular-nums">
          {dateRange}
        </div>
      </div>
      <div className="flex flex-col justify-around gap-2 min-h-[780px]">
        {matches.map(m => (
          <MatchCard key={m.id} t={t} match={m} tone={tone} shortDateFmt={shortDateFmt} />
        ))}
      </div>
      {extra && (
        <div className="pt-3 mt-2 border-t border-border-subtle/40">
          {extra}
        </div>
      )}
    </div>
  );
}

function MatchCard({ t, match, tone, shortDateFmt, caption }: {
  t: T;
  match: WCKnockoutMatch;
  tone: Tone;
  shortDateFmt: Intl.DateTimeFormat;
  caption?: string;
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
      initial={{ opacity: 0, scale: 0.96, y: 4 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.24, ease: 'easeOut' as const }}
      whileHover={{ y: -2 }}
      className={cn('rounded-xl border overflow-hidden', frame)}
      style={tone === 'gold' ? { boxShadow: '0 0 36px rgba(189,232,245,0.22)' } : undefined}
    >
      {caption && (
        <div className="px-3 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-text-muted">
          {caption}
        </div>
      )}
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

/* ═════════════════════ HOST STADIUMS ═════════════════════ */

function StadiumsSection({ t, stadiums }: { t: T; stadiums: WCStadium[] }) {
  return (
    <section className="space-y-3">
      <SectionHeader label={t('wcHostStadiums')} count={`${stadiums.length} ${t('wcStatCities').toLowerCase()}`} />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {stadiums.map((s, i) => <StadiumCard key={s.id} stadium={s} index={i} t={t} />)}
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
