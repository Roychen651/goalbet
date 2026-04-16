import { motion } from 'framer-motion';
import { Trophy, Calendar, MapPin, Globe } from 'lucide-react';
import { useLangStore } from '../../stores/langStore';
import {
  WC2026_INFO,
  WC2026_GROUPS,
  WC2026_R32,
  WC2026_R16,
  WC2026_QF,
  WC2026_SF,
  WC2026_THIRD,
  WC2026_FINAL,
  type WCGroup,
  type WCTeam,
  type WCKnockoutMatch,
} from '../../lib/worldCup2026';

export function WorldCupBracket() {
  const { t, lang } = useLangStore();
  const dateFmt = new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* ─────── Hero banner ─────── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative rounded-2xl border border-border-subtle overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, rgba(73,136,196,0.12) 0%, rgba(189,232,245,0.05) 100%)',
        }}
      >
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(189,232,245,0.6) 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="relative px-5 py-6 md:px-8 md:py-8">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-accent-green/10 border border-accent-green/25 flex items-center justify-center">
              <Trophy size={28} className="text-accent-green" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-accent-green text-[11px] font-bold uppercase tracking-[0.2em]">
                {t('wcRouteToTrophy')}
              </div>
              <h2 className="font-barlow font-extrabold text-3xl md:text-4xl uppercase tracking-wide text-white leading-tight mt-1">
                {WC2026_INFO.name}
              </h2>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 text-text-muted text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={13} className="text-accent-green" />
                  {dateFmt.format(new Date(WC2026_INFO.startDate))}
                  {' – '}
                  {dateFmt.format(new Date(WC2026_INFO.endDate))}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Globe size={13} className="text-accent-green" />
                  {WC2026_INFO.hosts.map(h => h.flag).join(' ')}{' '}
                  <span className="ms-1">{t('wcHostNations')}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Stat strip */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Stat label={t('wcStatTeams')} value={WC2026_INFO.totalTeams} />
            <Stat label={t('wcStatMatches')} value={WC2026_INFO.totalMatches} />
            <Stat label={t('wcStatCities')} value={WC2026_INFO.hostCities} />
          </div>

          {/* Opening + Final */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <KeyMatchPill
              label={t('wcOpeningMatch')}
              venue={WC2026_INFO.opening.venue}
              city={WC2026_INFO.opening.city}
              date={dateFmt.format(new Date(WC2026_INFO.opening.date))}
            />
            <KeyMatchPill
              label={t('wcFinalMatch')}
              venue={WC2026_INFO.final.venue}
              city={WC2026_INFO.final.city}
              date={dateFmt.format(new Date(WC2026_INFO.final.date))}
              accent
            />
          </div>
        </div>
      </motion.section>

      {/* ─────── Group Stage ─────── */}
      <section className="space-y-3">
        <SectionHeader label={t('wcGroupStage')} count={`${WC2026_GROUPS.length} ${t('wcGroups')}`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {WC2026_GROUPS.map((g, i) => (
            <GroupCard key={g.id} group={g} index={i} />
          ))}
        </div>
      </section>

      {/* ─────── Knockout bracket ─────── */}
      <section className="space-y-3">
        <SectionHeader label={t('wcKnockoutStage')} count={`${WC2026_R32.length + WC2026_R16.length + WC2026_QF.length + WC2026_SF.length + 2} ${t('wcMatches')}`} />

        <div
          data-lenis-prevent
          className="overflow-x-auto overscroll-contain pb-2"
        >
          <div className="flex gap-4 min-w-max">
            <BracketColumn label={t('wcR32')} matches={WC2026_R32} tone="muted" />
            <BracketColumn label={t('wcR16')} matches={WC2026_R16} tone="muted" />
            <BracketColumn label={t('wcQF')}  matches={WC2026_QF}  tone="muted" />
            <BracketColumn label={t('wcSF')}  matches={WC2026_SF}  tone="accent" />
            <BracketColumn
              label={t('wcFinal')}
              matches={[WC2026_FINAL]}
              tone="gold"
              extra={
                <MatchCard
                  match={WC2026_THIRD}
                  tone="muted"
                  caption={t('wcThirdPlace')}
                />
              }
            />
          </div>
        </div>
      </section>
    </div>
  );
}

/* ───────────────────────── helpers ───────────────────────── */

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-card px-3 py-2.5">
      <div className="font-barlow font-bold text-2xl tabular-nums text-white leading-none">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-text-muted mt-1">
        {label}
      </div>
    </div>
  );
}

function KeyMatchPill({
  label,
  venue,
  city,
  date,
  accent = false,
}: {
  label: string;
  venue: string;
  city: string;
  date: string;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        'rounded-xl border px-3 py-2.5',
        accent
          ? 'border-accent-green/30 bg-accent-green/5'
          : 'border-border-subtle bg-bg-card',
      ].join(' ')}
    >
      <div
        className={[
          'text-[10px] uppercase tracking-[0.2em] font-bold',
          accent ? 'text-accent-green' : 'text-text-muted',
        ].join(' ')}
      >
        {label}
      </div>
      <div className="font-barlow font-bold text-sm uppercase text-white mt-1 truncate">
        {venue}
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-text-muted mt-0.5">
        <MapPin size={11} />
        <span className="truncate">{city}</span>
        <span className="mx-1 opacity-40">·</span>
        <Calendar size={11} />
        <span>{date}</span>
      </div>
    </div>
  );
}

function SectionHeader({ label, count }: { label: string; count?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="font-barlow text-xs font-bold uppercase tracking-widest text-text-muted">
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

function GroupCard({ group, index }: { group: WCGroup; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.025, duration: 0.25 }}
      className="rounded-xl border border-border-subtle bg-bg-card overflow-hidden"
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border-subtle/60">
        <div className="font-barlow font-bold text-sm uppercase tracking-widest text-white">
          {`Group ${group.id}`}
        </div>
        <span className="text-[10px] font-mono tabular-nums text-text-muted">
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
    <li
      className={[
        'flex items-center gap-3 px-3.5 py-2 border-t border-border-subtle/50 first:border-t-0',
        isTbd ? 'opacity-50' : '',
      ].join(' ')}
    >
      <span className="w-4 text-end text-text-muted font-mono text-[11px] tabular-nums shrink-0">
        {position}
      </span>
      <span className="text-lg leading-none shrink-0 w-5 text-center">
        {team.flag}
      </span>
      <span
        className={[
          'flex-1 min-w-0 text-sm truncate',
          isTbd ? 'text-text-muted italic' : 'text-white font-medium',
        ].join(' ')}
      >
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

function BracketColumn({
  label,
  matches,
  tone,
  extra,
}: {
  label: string;
  matches: WCKnockoutMatch[];
  tone: 'muted' | 'accent' | 'gold';
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 w-[180px] md:w-[200px] shrink-0">
      <div className="font-barlow text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted pb-1">
        {label}
      </div>
      <div className="flex flex-col justify-around gap-2 min-h-[720px]">
        {matches.map(m => (
          <MatchCard key={m.id} match={m} tone={tone} />
        ))}
      </div>
      {extra && <div className="pt-2">{extra}</div>}
    </div>
  );
}

function MatchCard({
  match,
  tone,
  caption,
}: {
  match: WCKnockoutMatch;
  tone: 'muted' | 'accent' | 'gold';
  caption?: string;
}) {
  const toneStyles =
    tone === 'gold'
      ? 'border-accent-green/40 bg-accent-green/10'
      : tone === 'accent'
      ? 'border-accent-green/25 bg-accent-green/5'
      : 'border-border-subtle bg-bg-card';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.22 }}
      className={`rounded-xl border ${toneStyles} overflow-hidden`}
    >
      {caption && (
        <div className="px-3 pt-2 text-[9px] font-bold uppercase tracking-widest text-text-muted">
          {caption}
        </div>
      )}
      <div className="px-3 py-2.5">
        <BracketSlot label={match.home} tone={tone} />
        <div className="flex items-center gap-2 my-1.5">
          <span className="flex-1 h-px bg-border-subtle" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted">
            vs
          </span>
          <span className="flex-1 h-px bg-border-subtle" />
        </div>
        <BracketSlot label={match.away} tone={tone} />
      </div>
      <div className="px-3 py-1.5 border-t border-border-subtle/50 text-[9px] font-mono uppercase tracking-wider text-text-muted text-center">
        {match.id}
      </div>
    </motion.div>
  );
}

function BracketSlot({ label, tone }: { label: string; tone: 'muted' | 'accent' | 'gold' }) {
  const textClass =
    tone === 'gold'
      ? 'text-accent-green'
      : tone === 'accent'
      ? 'text-white'
      : 'text-white/85';
  return (
    <div className={`font-barlow font-bold text-sm uppercase tracking-wide truncate ${textClass}`}>
      {label}
    </div>
  );
}
