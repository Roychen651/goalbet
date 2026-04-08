import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { Avatar } from '../ui/Avatar';
import { useLangStore } from '../../stores/langStore';
import { FINISHED_STATUSES, LIVE_STATUSES } from '../../lib/constants';
import { cn } from '../../lib/utils';
import type { TranslationKey } from '../../lib/i18n';

// ── Types ────────────────────────────────────────────────────────────────────

interface MatchInfo {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
}

interface SimplePred {
  id: string;
  match_id: string;
  predicted_outcome: string | null;
  predicted_home_score: number | null;
  predicted_away_score: number | null;
  points_earned: number;
  is_resolved: boolean;
  match: MatchInfo;
}

export interface H2HUser {
  user_id: string;
  username: string;
  avatar_url: string | null;
  weekly_points: number;
  total_points?: number;
  last_week_points?: number;
}

type H2HPeriod = 'allTime' | 'weekly' | 'lastWeek';

interface H2HModalProps {
  me: H2HUser;
  friend: H2HUser;
  groupId: string;
  onClose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPeriodBoundsMs(period: H2HPeriod): { start: number | null; end: number | null } {
  if (period === 'allTime') return { start: null, end: null };
  const now = new Date();
  const thisSunday = new Date(now);
  thisSunday.setUTCDate(now.getUTCDate() - now.getUTCDay());
  thisSunday.setUTCHours(0, 0, 0, 0);
  if (period === 'weekly') {
    return { start: thisSunday.getTime(), end: null };
  }
  const lastSunday = new Date(thisSunday);
  lastSunday.setUTCDate(thisSunday.getUTCDate() - 7);
  return { start: lastSunday.getTime(), end: thisSunday.getTime() };
}

function isLocked(match: MatchInfo): boolean {
  return match.status === 'NS' && new Date(match.kickoff_time).getTime() > Date.now();
}

// Shorten long team names to last 2 words max
function shortTeam(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 2 ? parts.slice(-2).join(' ') : name;
}

function outcomeWord(outcome: string | null, t: (k: TranslationKey) => string): string {
  switch (outcome) {
    case 'H': return t('home');
    case 'D': return t('draw');
    case 'A': return t('away');
    default: return '—';
  }
}

async function fetchPreds(userId: string, groupId: string, period: H2HPeriod): Promise<SimplePred[]> {
  const { data } = await supabase
    .from('predictions')
    .select(`
      id, match_id, predicted_outcome, predicted_home_score, predicted_away_score,
      points_earned, is_resolved,
      match:matches(id, home_team, away_team, kickoff_time, status, home_score, away_score)
    `)
    .eq('user_id', userId)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(100);

  const all = (data as unknown as SimplePred[]) ?? [];
  if (period === 'allTime') return all;

  const { start, end } = getPeriodBoundsMs(period);
  return all.filter(p => {
    const kickoff = new Date(p.match?.kickoff_time ?? 0).getTime();
    return (start === null || kickoff >= start) && (end === null || kickoff < end);
  });
}

// ── PredCell ─────────────────────────────────────────────────────────────────

function PredCell({
  pred,
  locked,
  label,
  isWinner,
  isLoser,
  t,
}: {
  pred: SimplePred | null;
  locked: boolean;
  label: string;
  isWinner: boolean;
  isLoser: boolean;
  t: (k: TranslationKey) => string;
}) {
  const pts = pred?.points_earned ?? 0;
  const correct = !!pred?.is_resolved && pts > 0;
  const wrong = !!pred?.is_resolved && pts === 0 && !!pred?.predicted_outcome;

  return (
    <div className={cn(
      'px-3 py-3 flex flex-col gap-1.5 transition-colors',
      isWinner && 'bg-accent-green/8',
      isLoser && 'opacity-60',
    )}>
      {/* Cell label — "You" or friend's first name */}
      <span className={cn(
        'text-[9px] uppercase tracking-widest font-semibold leading-none',
        isWinner ? 'text-accent-green/70' : 'text-white/30',
      )}>
        {label}
      </span>

      {locked ? (
        <span className="text-white/30 text-xs flex items-center gap-1">
          🔒 <span>{t('h2hLocked')}</span>
        </span>
      ) : !pred || !pred.predicted_outcome ? (
        <span className="text-white/20 text-xs">—</span>
      ) : (
        <>
          {/* Outcome word + exact score */}
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className={cn(
              'text-sm font-semibold leading-tight',
              correct ? 'text-accent-green' : wrong ? 'text-white/45' : 'text-white/80',
            )}>
              {outcomeWord(pred.predicted_outcome, t)}
            </span>
            {pred.predicted_home_score !== null && pred.predicted_away_score !== null && (
              <span className={cn(
                'text-[10px] tabular-nums font-medium',
                correct ? 'text-accent-green/65' : 'text-white/30',
              )}>
                {pred.predicted_home_score}–{pred.predicted_away_score}
              </span>
            )}
          </div>

          {/* Points + result tick */}
          {pred.is_resolved ? (
            <div className="flex items-center gap-1">
              <span className={cn(
                'font-bebas text-base leading-none',
                pts > 0 ? 'text-accent-green' : 'text-white/25',
              )}>
                {pts > 0 ? `+${pts}` : '0'}
              </span>
              <span className={cn('text-[10px]', pts > 0 ? 'text-white/40' : 'text-white/20')}>
                {t('pts')}
              </span>
              <span className={cn('text-xs ms-0.5', correct ? 'text-accent-green' : 'text-red-400/60')}>
                {correct ? '✓' : '✗'}
              </span>
            </div>
          ) : (
            <span className="text-[9px] text-accent-green/45 leading-none">{t('predicted')}</span>
          )}
        </>
      )}
    </div>
  );
}

// ── Comparative Bars ────────────────────────────────────────────────────────

function ComparativeBars({
  me,
  friend,
  myPreds,
  friendPreds,
  myPeriodPts,
  friendPeriodPts,
  t,
}: {
  me: H2HUser;
  friend: H2HUser;
  myPreds: SimplePred[];
  friendPreds: SimplePred[];
  myPeriodPts: number;
  friendPeriodPts: number;
  t: (k: TranslationKey) => string;
}) {
  const myMade = myPreds.filter(p => p.is_resolved && p.predicted_outcome).length;
  const myCorrect = myPreds.filter(p => p.is_resolved && p.points_earned > 0).length;
  const friendMade = friendPreds.filter(p => p.is_resolved && p.predicted_outcome).length;
  const friendCorrect = friendPreds.filter(p => p.is_resolved && p.points_earned > 0).length;

  const myAcc = myMade > 0 ? Math.round((myCorrect / myMade) * 100) : 0;
  const friendAcc = friendMade > 0 ? Math.round((friendCorrect / friendMade) * 100) : 0;

  const bars: { label: string; myVal: number; friendVal: number; suffix: string }[] = [
    { label: t('h2hAccuracy'), myVal: myAcc, friendVal: friendAcc, suffix: '%' },
    { label: t('h2hTotalPoints'), myVal: myPeriodPts, friendVal: friendPeriodPts, suffix: '' },
  ];

  return (
    <div className="px-4 py-3 border-b border-white/6 space-y-3 shrink-0">
      {bars.map(bar => {
        const max = Math.max(bar.myVal, bar.friendVal, 1);
        const myPct = Math.round((bar.myVal / max) * 100);
        const friendPct = Math.round((bar.friendVal / max) * 100);
        const myLeads = bar.myVal >= bar.friendVal;

        return (
          <div key={bar.label}>
            <div className="text-[10px] text-text-muted uppercase tracking-widest font-semibold mb-1.5">
              {bar.label}
            </div>

            {/* My bar */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-white/50 w-12 truncate">{me.username.split(' ')[0]}</span>
              <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden relative">
                <motion.div
                  className={cn(
                    'h-full rounded-full',
                    myLeads ? 'bg-accent-green/60' : 'bg-white/15',
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${myPct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' as const, delay: 0.15 }}
                />
              </div>
              <span className={cn(
                'text-xs font-bebas w-10 text-end tabular-nums',
                myLeads ? 'text-accent-green' : 'text-white/50',
              )}>
                {bar.myVal}{bar.suffix}
              </span>
            </div>

            {/* Friend bar */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/50 w-12 truncate">{friend.username.split(' ')[0]}</span>
              <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden relative">
                <motion.div
                  className={cn(
                    'h-full rounded-full',
                    !myLeads ? 'bg-accent-green/60' : 'bg-white/15',
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${friendPct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' as const, delay: 0.25 }}
                />
              </div>
              <span className={cn(
                'text-xs font-bebas w-10 text-end tabular-nums',
                !myLeads ? 'text-accent-green' : 'text-white/50',
              )}>
                {bar.friendVal}{bar.suffix}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function H2HModal({ me, friend, groupId, onClose }: H2HModalProps) {
  const { t, lang } = useLangStore();
  const isHe = lang === 'he';
  const [period, setPeriod] = useState<H2HPeriod>('allTime');
  const [myPreds, setMyPreds] = useState<SimplePred[]>([]);
  const [friendPreds, setFriendPreds] = useState<SimplePred[]>([]);
  const [loading, setLoading] = useState(true);

  // Lock body scroll while modal is open (prevents background scroll-through on iOS)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchPreds(me.user_id, groupId, period),
      fetchPreds(friend.user_id, groupId, period),
    ]).then(([mine, theirs]) => {
      setMyPreds(mine);
      setFriendPreds(theirs);
      setLoading(false);
    });
  }, [me.user_id, friend.user_id, groupId, period]);

  // Merge into per-match rows sorted newest kickoff first
  const rows = useMemo(() => {
    const map = new Map<string, { match: MatchInfo; myPred: SimplePred | null; friendPred: SimplePred | null }>();
    for (const p of myPreds) map.set(p.match_id, { match: p.match, myPred: p, friendPred: null });
    for (const p of friendPreds) {
      const ex = map.get(p.match_id);
      if (ex) ex.friendPred = p;
      else map.set(p.match_id, { match: p.match, myPred: null, friendPred: p });
    }
    return [...map.values()].sort(
      (a, b) => new Date(b.match?.kickoff_time ?? 0).getTime() - new Date(a.match?.kickoff_time ?? 0).getTime()
    );
  }, [myPreds, friendPreds]);

  // Period-specific points derived from fetched predictions (avoids stale DB columns)
  const myPeriodPts = useMemo(() =>
    myPreds.filter(p => p.is_resolved).reduce((s, p) => s + p.points_earned, 0),
    [myPreds]);
  const friendPeriodPts = useMemo(() =>
    friendPreds.filter(p => p.is_resolved).reduce((s, p) => s + p.points_earned, 0),
    [friendPreds]);

  // Match-level win tally (only resolved head-to-head matches)
  const { myWins, friendWins, matchTies } = useMemo(() => {
    let myW = 0, friendW = 0, ties = 0;
    for (const { myPred, friendPred } of rows) {
      if (!myPred?.is_resolved || !friendPred?.is_resolved) continue;
      const mP = myPred.points_earned ?? 0;
      const fP = friendPred.points_earned ?? 0;
      if (mP > fP) myW++;
      else if (fP > mP) friendW++;
      else ties++;
    }
    return { myWins: myW, friendWins: friendW, matchTies: ties };
  }, [rows]);

  const meLeading = myPeriodPts > friendPeriodPts;
  const tied = myPeriodPts === friendPeriodPts;
  const firstName = (name: string) => name.split(' ')[0];

  const PERIOD_TABS: { key: H2HPeriod; label: string }[] = [
    { key: 'allTime', label: isHe ? 'כל הזמן' : 'All Time' },
    { key: 'weekly',  label: t('thisWeek') },
    { key: 'lastWeek', label: t('lastWeek') },
  ];

  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      <motion.div
        className="relative w-full max-w-sm"
        initial={{ opacity: 0, y: 48, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="rounded-2xl card-elevated border border-white/10 overflow-hidden flex flex-col"
          style={{ maxHeight: 'min(88vh, calc(100svh - 2rem))' }}
        >

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="px-5 pt-5 pb-4 border-b border-white/8 shrink-0 bg-white/2">
            <div className="flex items-center gap-3">

              {/* Me */}
              <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                <div className={cn(
                  'p-0.5 rounded-full',
                  meLeading ? 'ring-2 ring-accent-green ring-offset-1 ring-offset-transparent' : '',
                )}>
                  <Avatar src={me.avatar_url} name={me.username} size="lg" />
                </div>
                <span className="text-white text-[11px] font-semibold truncate max-w-full mt-0.5">
                  {me.username}
                </span>
                <span className={cn(
                  'font-bebas text-3xl leading-none tracking-wide',
                  meLeading ? 'text-accent-green' : tied ? 'text-white' : 'text-white/40',
                )}>
                  {myPeriodPts}
                  <span className="text-sm font-sans font-normal ms-0.5 tracking-normal">{t('pts')}</span>
                </span>
              </div>

              {/* Centre */}
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <span className="text-[9px] text-text-muted uppercase tracking-widest mb-1">{t('h2hTitle')}</span>

                {/* Match wins tally — W · D · W */}
                <div className="flex items-center gap-1.5 bg-white/6 border border-white/10 rounded-xl px-3 py-1.5">
                  <span className={cn('font-bebas text-xl leading-none', myWins > friendWins ? 'text-accent-green' : 'text-white/50')}>
                    {myWins}
                  </span>
                  <span className="text-white/20 text-xs">·</span>
                  <span className="font-bebas text-xl leading-none text-yellow-400/70">{matchTies}</span>
                  <span className="text-white/20 text-xs">·</span>
                  <span className={cn('font-bebas text-xl leading-none', friendWins > myWins ? 'text-accent-green' : 'text-white/50')}>
                    {friendWins}
                  </span>
                </div>

                <span className={cn(
                  'text-[9px] font-bold uppercase tracking-widest mt-1',
                  tied ? 'text-yellow-400' : 'text-accent-green',
                )}>
                  {tied
                    ? t('h2hTied')
                    : meLeading
                    ? `▲ ${firstName(me.username)}`
                    : `▲ ${firstName(friend.username)}`}
                </span>
              </div>

              {/* Friend */}
              <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                <div className={cn(
                  'p-0.5 rounded-full',
                  !meLeading && !tied ? 'ring-2 ring-accent-green ring-offset-1 ring-offset-transparent' : '',
                )}>
                  <Avatar src={friend.avatar_url} name={friend.username} size="lg" />
                </div>
                <span className="text-white text-[11px] font-semibold truncate max-w-full mt-0.5">
                  {friend.username}
                </span>
                <span className={cn(
                  'font-bebas text-3xl leading-none tracking-wide',
                  !meLeading && !tied ? 'text-accent-green' : tied ? 'text-white' : 'text-white/40',
                )}>
                  {friendPeriodPts}
                  <span className="text-sm font-sans font-normal ms-0.5 tracking-normal">{t('pts')}</span>
                </span>
              </div>
            </div>

            {/* Period tabs */}
            <div className="flex gap-1 mt-3 bg-white/5 rounded-xl p-1">
              {PERIOD_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setPeriod(tab.key)}
                  className={cn(
                    'flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all duration-150',
                    period === tab.key
                      ? 'bg-accent-green text-bg-base shadow-glow-green-sm'
                      : 'text-text-muted hover:text-white',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Comparative Stats Bars ──────────────────────────────────────── */}
          {!loading && (myPreds.length > 0 || friendPreds.length > 0) && (
            <ComparativeBars me={me} friend={friend} myPreds={myPreds} friendPreds={friendPreds} myPeriodPts={myPeriodPts} friendPeriodPts={friendPeriodPts} t={t} />
          )}

          {/* ── Match list ───────────────────────────────────────────────────── */}
          <div className="overflow-y-auto overscroll-contain px-3 py-3 space-y-2 flex-1">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="rounded-xl border border-white/6 bg-white/3 animate-pulse h-[88px]" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="py-10 text-center text-text-muted text-sm">{t('h2hNoData')}</div>
            ) : (
              rows.map(({ match, myPred, friendPred }, i) => {
                const locked = isLocked(match);
                const isFinished = FINISHED_STATUSES.includes(match.status);
                const isLive = LIVE_STATUSES.includes(match.status);

                // Who won this specific match?
                const bothResolved = myPred?.is_resolved && friendPred?.is_resolved;
                const myMatchPts = myPred?.points_earned ?? 0;
                const friendMatchPts = friendPred?.points_earned ?? 0;
                const iWonMatch = !!(bothResolved && myMatchPts > friendMatchPts);
                const friendWonMatch = !!(bothResolved && friendMatchPts > myMatchPts);

                return (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.045, type: 'spring', stiffness: 200, damping: 24 }}
                    className="rounded-xl border border-white/8 overflow-hidden"
                  >
                    {/* Match header */}
                    <div className={cn(
                      'flex items-center px-3 py-2 border-b border-white/6',
                      isLive ? 'bg-accent-green/6' : 'bg-white/3',
                    )}>
                      {/* Teams */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-white/70 font-medium truncate">{shortTeam(match.home_team)}</span>
                          <span className="text-white/25 shrink-0">vs</span>
                          <span className="text-white/70 font-medium truncate">{shortTeam(match.away_team)}</span>
                        </div>
                      </div>

                      {/* Score / status */}
                      <div className="shrink-0 ms-2 text-end">
                        {isLive ? (
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                            <span className="font-bebas text-sm text-accent-green tracking-wide">
                              {match.home_score ?? 0}–{match.away_score ?? 0}
                            </span>
                          </div>
                        ) : isFinished && match.home_score !== null ? (
                          <span className="font-bebas text-sm text-white/65 tracking-wide">
                            {match.home_score}–{match.away_score}
                          </span>
                        ) : (
                          <span className="text-[10px] text-white/30">
                            {new Date(match.kickoff_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Side-by-side predictions */}
                    <div className="grid grid-cols-2 divide-x divide-white/6">
                      <PredCell
                        pred={myPred}
                        locked={false}
                        label={t('you')}
                        isWinner={iWonMatch}
                        isLoser={friendWonMatch}
                        t={t}
                      />
                      <PredCell
                        pred={friendPred}
                        locked={locked}
                        label={firstName(friend.username)}
                        isWinner={friendWonMatch}
                        isLoser={iWonMatch}
                        t={t}
                      />
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* ── Close ───────────────────────────────────────────────────────── */}
          <div className="px-4 pb-4 pt-2 shrink-0 border-t border-white/5">
            <button
              onClick={onClose}
              className="w-full py-2 rounded-xl border border-white/10 text-text-muted text-sm hover:text-white hover:bg-white/5 transition-all"
            >
              ✕
            </button>
          </div>

        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
