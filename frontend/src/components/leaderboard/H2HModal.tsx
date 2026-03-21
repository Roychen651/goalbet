import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { Avatar } from '../ui/Avatar';
import { useLangStore } from '../../stores/langStore';
import { FINISHED_STATUSES, LIVE_STATUSES } from '../../lib/constants';
import type { TranslationKey } from '../../lib/i18n';

// ── Types ───────────────────────────────────────────────────────────────────

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
}

interface H2HModalProps {
  me: H2HUser;
  friend: H2HUser;
  groupId: string;
  onClose: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Current week starts on Sunday 00:00 UTC */
function thisWeekStart(): number {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setUTCDate(now.getUTCDate() - now.getUTCDay());
  sunday.setUTCHours(0, 0, 0, 0);
  return sunday.getTime();
}

/** A match is "locked" (friend's pick hidden) while it hasn't kicked off yet */
function isLocked(match: MatchInfo): boolean {
  return match.status === 'NS' && new Date(match.kickoff_time).getTime() > Date.now();
}

async function fetchWeeklyPreds(userId: string, groupId: string): Promise<SimplePred[]> {
  const start = thisWeekStart();
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
    .limit(60);

  const all = (data as unknown as SimplePred[]) ?? [];
  return all.filter(p => new Date(p.match?.kickoff_time ?? 0).getTime() >= start);
}

// ── Sub-components ───────────────────────────────────────────────────────────

function PredCell({
  pred,
  locked,
  isMe,
  t,
}: {
  pred: SimplePred | null;
  locked: boolean;
  isMe: boolean;
  t: (k: TranslationKey) => string;
}) {
  if (locked) {
    return (
      <div className="px-3 py-3 flex items-center justify-center gap-1">
        <span className="text-[11px] text-white/25">🔒 {t('h2hLocked')}</span>
      </div>
    );
  }

  if (!pred) {
    return (
      <div className="px-3 py-3 flex items-center justify-center">
        <span className="text-white/20 text-xs">—</span>
      </div>
    );
  }

  const pts = pred.points_earned ?? 0;
  const correct = pred.is_resolved && pts > 0;
  const wrong = pred.is_resolved && !correct;

  return (
    <div className="px-3 py-3 flex flex-col gap-0.5">
      {isMe && (
        <span className="text-[8px] text-white/20 uppercase tracking-widest mb-0.5">{t('you')}</span>
      )}

      {pred.predicted_outcome ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-sm font-bold ${
            correct ? 'text-accent-green' : wrong ? 'text-red-400/70' : 'text-white/75'
          }`}>
            {pred.predicted_outcome}
          </span>
          {pred.predicted_home_score !== null && pred.predicted_away_score !== null && (
            <span className={`text-[10px] tabular-nums ${
              correct ? 'text-accent-green/70' : 'text-white/30'
            }`}>
              {pred.predicted_home_score}–{pred.predicted_away_score}
            </span>
          )}
          {pred.is_resolved && (
            <span className={`text-xs leading-none ${correct ? 'text-accent-green' : 'text-red-400/60'}`}>
              {correct ? '✓' : '✗'}
            </span>
          )}
        </div>
      ) : (
        <span className="text-white/25 text-xs">—</span>
      )}

      {pred.is_resolved ? (
        <span className={`font-bebas text-sm leading-none ${pts > 0 ? 'text-accent-green' : 'text-white/25'}`}>
          {pts > 0 ? `+${pts}` : '0'} <span className="text-xs font-sans font-normal">{t('pts')}</span>
        </span>
      ) : (
        <span className="text-[9px] text-accent-green/50">{t('predicted')}</span>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function H2HModal({ me, friend, groupId, onClose }: H2HModalProps) {
  const { t } = useLangStore();
  const [myPreds, setMyPreds] = useState<SimplePred[]>([]);
  const [friendPreds, setFriendPreds] = useState<SimplePred[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchWeeklyPreds(me.user_id, groupId),
      fetchWeeklyPreds(friend.user_id, groupId),
    ]).then(([mine, theirs]) => {
      setMyPreds(mine);
      setFriendPreds(theirs);
      setLoading(false);
    });
  }, [me.user_id, friend.user_id, groupId]);

  // Merge into per-match rows, sorted by kickoff
  const rows = (() => {
    const map = new Map<string, {
      match: MatchInfo;
      myPred: SimplePred | null;
      friendPred: SimplePred | null;
    }>();

    for (const p of myPreds) {
      map.set(p.match_id, { match: p.match, myPred: p, friendPred: null });
    }
    for (const p of friendPreds) {
      const ex = map.get(p.match_id);
      if (ex) {
        ex.friendPred = p;
      } else {
        map.set(p.match_id, { match: p.match, myPred: null, friendPred: p });
      }
    }

    return [...map.values()].sort(
      (a, b) => new Date(a.match?.kickoff_time ?? 0).getTime() - new Date(b.match?.kickoff_time ?? 0).getTime()
    );
  })();

  const mePts = me.weekly_points;
  const friendPts = friend.weekly_points;
  const meLeading = mePts > friendPts;
  const tied = mePts === friendPts;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

      <motion.div
        className="relative w-full max-w-sm"
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="rounded-2xl card-elevated border border-white/10 overflow-hidden max-h-[85vh] flex flex-col">

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="px-4 pt-5 pb-4 border-b border-white/8 shrink-0">
            <div className="flex items-center gap-2">

              {/* Me */}
              <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                <Avatar src={me.avatar_url} name={me.username} size="lg" />
                <span className="text-white text-xs font-semibold truncate max-w-full">{me.username}</span>
                <span className={`font-bebas text-2xl leading-none ${
                  meLeading ? 'text-accent-green text-glow-green' : tied ? 'text-white' : 'text-white/45'
                }`}>
                  {mePts}
                  <span className="text-sm font-sans font-normal ms-0.5">{t('pts')}</span>
                </span>
              </div>

              {/* Centre ⚔️ */}
              <div className="flex flex-col items-center gap-1 shrink-0 px-1">
                <span className="text-2xl">⚔️</span>
                <span className="text-text-muted text-[9px] uppercase tracking-widest">{t('h2hTitle')}</span>
                <span className={`text-[9px] font-bold uppercase tracking-widest ${
                  tied ? 'text-yellow-400' : 'text-accent-green'
                }`}>
                  {tied
                    ? t('h2hTied')
                    : meLeading
                    ? `↑ ${me.username.split(' ')[0]}`
                    : `↑ ${friend.username.split(' ')[0]}`}
                </span>
              </div>

              {/* Friend */}
              <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                <Avatar src={friend.avatar_url} name={friend.username} size="lg" />
                <span className="text-white text-xs font-semibold truncate max-w-full">{friend.username}</span>
                <span className={`font-bebas text-2xl leading-none ${
                  !meLeading && !tied ? 'text-accent-green text-glow-green' : tied ? 'text-white' : 'text-white/45'
                }`}>
                  {friendPts}
                  <span className="text-sm font-sans font-normal ms-0.5">{t('pts')}</span>
                </span>
              </div>
            </div>
          </div>

          {/* ── Match list ──────────────────────────────────────────────── */}
          <div className="overflow-y-auto px-3 py-3 space-y-2 flex-1">
            {loading ? (
              // Skeleton rows
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="rounded-xl border border-white/6 bg-white/3 animate-pulse h-[72px]" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="py-10 text-center text-text-muted text-sm">{t('h2hNoData')}</div>
            ) : (
              rows.map(({ match, myPred, friendPred }, i) => {
                const locked = isLocked(match);
                const isFinished = FINISHED_STATUSES.includes(match.status);
                const isLive = LIVE_STATUSES.includes(match.status);

                return (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-xl border border-white/8 bg-white/3 overflow-hidden"
                  >
                    {/* Match info header */}
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-white/2">
                      <span className="text-white/55 text-[10px] truncate">
                        {match.home_team} vs {match.away_team}
                      </span>
                      <span className={`text-[10px] font-semibold shrink-0 ms-2 ${
                        isLive ? 'text-accent-green' : isFinished ? 'text-white/45' : 'text-white/30'
                      }`}>
                        {isLive && (
                          <span className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse inline-block" />
                            LIVE
                          </span>
                        )}
                        {isFinished && match.home_score !== null &&
                          `FT ${match.home_score}–${match.away_score}`
                        }
                        {!isLive && !isFinished &&
                          new Date(match.kickoff_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }
                      </span>
                    </div>

                    {/* Side-by-side predictions — grid stays same in RTL; first col = logical start */}
                    <div className="grid grid-cols-2 divide-x divide-white/5">
                      <PredCell pred={myPred} locked={false} isMe t={t} />
                      <PredCell pred={friendPred} locked={locked} isMe={false} t={t} />
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* ── Close ───────────────────────────────────────────────────── */}
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
    </motion.div>
  );
}
