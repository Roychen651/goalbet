import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase, Prediction, Match } from '../../lib/supabase';
import { Avatar } from '../ui/Avatar';
import { formatKickoffTime } from '../../lib/utils';
import { useLangStore } from '../../stores/langStore';
import { LeaderboardType } from '../../hooks/useLeaderboard';

interface UserInfo {
  user_id: string;
  username: string;
  avatar_url: string | null;
}

interface PredictionWithMatch extends Prediction {
  match: Match;
}

interface UserMatchHistoryModalProps {
  user: UserInfo;
  groupId: string;
  type: LeaderboardType;
  onClose: () => void;
}

// Week = Sunday 00:00 UTC → Saturday 23:59:59 UTC
function getWeekBounds(type: LeaderboardType): { start: number | null; end: number | null } {
  if (type === 'total') return { start: null, end: null };

  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 6=Sat

  const thisSunday = new Date(now);
  thisSunday.setUTCDate(now.getUTCDate() - dayOfWeek);
  thisSunday.setUTCHours(0, 0, 0, 0);

  if (type === 'weekly') {
    return { start: thisSunday.getTime(), end: null };
  } else {
    const lastSunday = new Date(thisSunday);
    lastSunday.setUTCDate(thisSunday.getUTCDate() - 7);
    const lastSaturday = new Date(thisSunday.getTime() - 1);
    return { start: lastSunday.getTime(), end: lastSaturday.getTime() };
  }
}

export function UserMatchHistoryModal({ user, groupId, type, onClose }: UserMatchHistoryModalProps) {
  const { t } = useLangStore();
  const [history, setHistory] = useState<PredictionWithMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('predictions')
      .select(`
        id, match_id, points_earned, is_resolved,
        predicted_outcome, predicted_home_score, predicted_away_score,
        predicted_halftime_outcome, predicted_halftime_home, predicted_halftime_away,
        predicted_btts, predicted_over_under,
        match:matches(id, home_team, away_team, kickoff_time, status, home_score, away_score, halftime_home, halftime_away)
      `)
      .eq('user_id', user.user_id)
      .eq('group_id', groupId)
      .eq('is_resolved', true)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        const all = (data as unknown as PredictionWithMatch[]) || [];
        const { start, end } = getWeekBounds(type);
        const filtered = all.filter(p => {
          const kickoff = new Date(p.match?.kickoff_time ?? 0).getTime();
          if (start && kickoff < start) return false;
          if (end && kickoff > end) return false;
          return true;
        });
        setHistory(filtered);
        setLoading(false);
      });
  }, [user.user_id, groupId, type]);

  const predRows = history.map(pred => ({ pred, pts: pred.points_earned ?? 0 }));
  const totalPoints = history.reduce((sum, p) => sum + (p.points_earned ?? 0), 0);
  const periodLabel = type === 'weekly' ? t('thisWeek') : type === 'lastWeek' ? t('lastWeek') : t('allTime');

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
        <div className="relative rounded-2xl card-elevated border border-white/10 overflow-hidden max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/8 shrink-0">
            <div className="flex items-center gap-3">
              <Avatar src={user.avatar_url} name={user.username} size="md" />
              <div>
                <p className="text-white font-semibold text-sm">{user.username}</p>
                <p className="text-text-muted text-xs">
                  {totalPoints} {t('pts')} · {history.length} {t('matches')} · {periodLabel}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/8 border border-white/15 flex items-center justify-center text-text-muted hover:text-white hover:bg-white/15 transition-all text-sm"
            >
              ✕
            </button>
          </div>

          {/* Match list */}
          <div className="overflow-y-auto px-4 py-3 space-y-1.5" onWheel={(e) => e.stopPropagation()}>
            {loading ? (
              <div className="py-8 text-center text-text-muted text-sm">Loading...</div>
            ) : history.length === 0 ? (
              <div className="py-8 text-center text-text-muted text-sm">
                No resolved predictions for {periodLabel.toLowerCase()}
              </div>
            ) : (
              <>
                {predRows.map(({ pred, pts }, i) => (
                  <motion.div
                    key={pred.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm ${
                      pts > 0
                        ? 'bg-accent-green/6 border border-accent-green/12'
                        : 'bg-white/3 border border-white/5'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white/90 text-xs font-medium truncate">
                          {pred.match?.home_team} vs {pred.match?.away_team}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-text-muted text-[10px]">
                          {formatKickoffTime(pred.match?.kickoff_time ?? '').date}
                        </span>
                        {pred.match?.home_score !== null && pred.match?.away_score !== null && (
                          <span className="text-white/40 text-[10px]">
                            {pred.match.home_score}–{pred.match.away_score}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`font-bebas text-lg shrink-0 ${pts > 0 ? 'text-accent-green' : 'text-white/25'}`}>
                      {pts > 0 ? `+${pts}` : '0'}
                    </div>
                  </motion.div>
                ))}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
