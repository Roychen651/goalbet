import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Match, Prediction } from '../../lib/supabase';
import { GlassCard } from '../ui/GlassCard';
import { MatchStatusBadge } from './MatchStatusBadge';
import { PredictionForm, PredictionData } from './PredictionForm';
import { Avatar } from '../ui/Avatar';
import { cn, formatKickoffTime, getLiveClock, calcLiveBreakdown } from '../../lib/utils';
import { LIVE_STATUSES, FINISHED_STATUSES, FOOTBALL_LEAGUES } from '../../lib/constants';
import { useLangStore } from '../../stores/langStore';
import { useLiveClock } from '../../hooks/useLiveClock';
import { useAuthStore } from '../../stores/authStore';

interface MatchCardProps {
  match: Match;
  prediction?: Prediction;
  predictors?: { user_id: string; avatar_url: string | null; username: string }[];
  onSavePrediction: (data: PredictionData) => Promise<void>;
  savingMatchId: string | null;
}

export function MatchCard({ match, prediction, predictors = [], onSavePrediction, savingMatchId }: MatchCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useLangStore();
  const { user, profile } = useAuthStore();
  // Re-render every 20s so countdown ("6m", "1h 6m", etc.) stays accurate.
  // This does NOT refetch data — PredictionForm and expanded state are preserved.
  useLiveClock(20_000);
  const isLive = LIVE_STATUSES.includes(match.status);
  const isFinished = FINISHED_STATUSES.includes(match.status);
  // NS match that has passed kickoff — backend hasn't updated status yet
  const isPastKickoffNS = match.status === 'NS' && new Date(match.kickoff_time).getTime() < Date.now();
  const isInProgress = isLive || isPastKickoffNS;
  const liveClock = isInProgress ? getLiveClock(match) : null;
  // "refreshed X ago" — how stale is the DB data
  const updatedAgoSecs = Math.floor((Date.now() - new Date(match.updated_at).getTime()) / 1000);
  const updatedAgoLabel = updatedAgoSecs < 60
    ? `${updatedAgoSecs}s ago`
    : `${Math.floor(updatedAgoSecs / 60)}m ago`;
  const hasPrediction = !!prediction;
  const { date, time, countdown, lockCountdown } = formatKickoffTime(match.kickoff_time);
  // True when kickoff is within the next 5 minutes
  const startingSoon = !isLive && !isFinished && !isPastKickoffNS && (() => {
    const diffMs = new Date(match.kickoff_time).getTime() - Date.now();
    return diffMs > 0 && diffMs < 5 * 60 * 1000;
  })();
  const leagueInfo = FOOTBALL_LEAGUES.find(l => l.id === match.league_id);
  const leagueBadge = leagueInfo?.badge;
  const leagueEspnId = leagueInfo?.espnLogoId ?? null;

  // Leading team during live — used for score + team highlighting
  const homeLeading = isInProgress && match.home_score !== null && match.away_score !== null && match.home_score > match.away_score;
  const awayLeading = isInProgress && match.home_score !== null && match.away_score !== null && match.away_score > match.home_score;

  // Predicted live cards get a blue glow — visually distinct from unpredicted live (green)
  const cardVariant = isInProgress
    ? (hasPrediction ? 'live-predicted' : 'live')
    : 'default';

  return (
    <GlassCard
      as="article"
      variant={cardVariant}
      className="overflow-hidden"
    >
      {/* Card header */}
      <button
        className="w-full p-4 text-start group hover:bg-white/3 transition-colors duration-150 rounded-t-2xl"
        onClick={() => setExpanded(prev => !prev)}
      >
        {/* League + status row */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-text-muted text-xs truncate me-2">
            {match.league_name}
            {match.round && ` · R${match.round}`}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {hasPrediction && isFinished && prediction?.is_resolved && (prediction?.points_earned ?? 0) > 0 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1 bg-accent-green/12 border border-accent-green/25 rounded-full px-2 py-0.5 text-accent-green text-xs font-bold"
              >
                +{prediction.points_earned} {t('pts')}
              </motion.span>
            )}
            {hasPrediction && isFinished && prediction?.is_resolved && (prediction?.points_earned ?? 0) === 0 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-white/25 text-xs"
              >
                0 {t('pts')}
              </motion.span>
            )}
            {hasPrediction && isInProgress && prediction && (() => {
              const tiers = calcLiveBreakdown(prediction, match);
              const livePts = tiers ? tiers.filter(r => r.earned && !r.pending).reduce((s, r) => s + r.pts, 0) : 0;
              return livePts > 0 ? (
                <motion.span
                  key={livePts}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1 bg-blue-500/12 border border-blue-500/25 rounded-full px-2 py-0.5 text-blue-400 text-xs font-bold"
                >
                  +{livePts} {t('pts')}
                </motion.span>
              ) : (
                <motion.span
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1 text-accent-green text-xs"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                  {t('predicted')}
                </motion.span>
              );
            })()}
            {hasPrediction && !isFinished && !isInProgress && (
              <motion.span
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1 text-accent-green text-xs"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                {t('predicted')}
              </motion.span>
            )}
            <MatchStatusBadge status={match.status} />
          </div>
        </div>

        {/* Teams + score */}
        <div className="flex items-center gap-3">
          <TeamBlock
            name={match.home_team}
            badge={match.home_team_badge}
            score={isLive || isFinished ? match.home_score : null}
            isWinner={isFinished && match.home_score !== null && match.away_score !== null && match.home_score > match.away_score}
            isLeading={homeLeading}
          />

          <div className="flex-1 flex flex-col items-center">
            {isLive || isFinished || (isPastKickoffNS && match.home_score !== null) ? (
              <div className="flex flex-col items-center gap-0.5">
                <motion.span
                  key={`${match.home_score}-${match.away_score}`}
                  initial={{ scale: 1.15 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  className="text-2xl font-bebas tracking-widest"
                >
                  <span className={homeLeading ? 'text-accent-green' : awayLeading ? 'text-white/50' : 'text-white'}>{match.home_score ?? 0}</span>
                  <span className="text-white/40"> — </span>
                  <span className={awayLeading ? 'text-accent-green' : homeLeading ? 'text-white/50' : 'text-white'}>{match.away_score ?? 0}</span>
                </motion.span>
                {isInProgress && liveClock && (
                  <motion.span
                    key={liveClock}
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                    className="text-xs font-bold text-accent-green tracking-wider"
                  >
                    {liveClock}
                  </motion.span>
                )}
                {isInProgress && (
                  <span className="text-[9px] text-white/25 mt-0.5">
                    ↻ {updatedAgoLabel}
                  </span>
                )}
              </div>
            ) : isPastKickoffNS ? (
              // Kicked off but backend hasn't polled ESPN yet
              <div className="flex flex-col items-center gap-1">
                <motion.span
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="text-xl font-bebas tracking-widest text-accent-green"
                >
                  — —
                </motion.span>
                <motion.span
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  className="text-[10px] text-accent-green/70"
                >
                  {liveClock ?? t('live_status')}
                </motion.span>
                <span className="text-[9px] text-white/25">↻ {updatedAgoLabel}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                {leagueEspnId !== null ? (
                  <img
                    src={`https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/${leagueEspnId}.png&h=80&w=80`}
                    className="w-6 h-6 object-contain mb-0.5"
                    alt={match.league_name}
                    title={match.league_name}
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = 'none';
                      if (img.nextSibling === null && leagueBadge) {
                        const span = document.createElement('span');
                        span.textContent = leagueBadge;
                        span.className = 'text-base leading-none mb-0.5';
                        img.parentNode?.appendChild(span);
                      }
                    }}
                  />
                ) : leagueBadge ? (
                  <span className="text-base leading-none mb-0.5" title={match.league_name}>{leagueBadge}</span>
                ) : null}
                <span className="text-text-muted text-xs">{date}</span>
                <span className="text-white font-semibold text-sm">{time}</span>
                {startingSoon ? (
                  <motion.span
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="text-accent-green text-xs font-semibold"
                  >
                    {t('startingNow')}
                  </motion.span>
                ) : countdown ? (
                  <span className="text-accent-green text-xs">{countdown}</span>
                ) : null}
              </div>
            )}
            {isFinished && match.halftime_home !== null && (
              <span className="text-text-muted text-xs mt-1">
                {t('halfTime')}: {match.halftime_home}–{match.halftime_away}
              </span>
            )}
            {/* Lock countdown — shown only for upcoming matches not yet locked */}
            {!isLive && !isFinished && !isPastKickoffNS && lockCountdown && (
              <span className="text-orange-400/80 text-[10px] mt-0.5 flex items-center gap-0.5">
                <span>🔒</span>
                <span>{lockCountdown}</span>
              </span>
            )}
          </div>

          <TeamBlock
            name={match.away_team}
            badge={match.away_team_badge}
            score={isLive || isFinished ? match.away_score : null}
            isWinner={isFinished && match.home_score !== null && match.away_score !== null && match.away_score > match.home_score}
            isLeading={awayLeading}
            right
          />
        </div>

        {/* Predictors row — who has predicted */}
        {predictors.length > 0 && !isFinished && (
          <div className="flex items-center gap-1.5 mt-2.5">
            <div className="flex -space-x-1.5">
              {predictors.slice(0, 5).map(p => (
                <div
                  key={p.user_id}
                  className="border border-bg-base shrink-0"
                  title={p.username}
                >
                  <Avatar
                    src={p.user_id === user?.id ? (profile?.avatar_url ?? p.avatar_url) : p.avatar_url}
                    name={p.username}
                    size="sm"
                  />
                </div>
              ))}
              {predictors.length > 5 && (
                <div className="w-5 h-5 rounded-full border border-bg-base bg-white/10 flex items-center justify-center text-[8px] text-white/50">
                  +{predictors.length - 5}
                </div>
              )}
            </div>
            <span className="text-white/30 text-[10px]">{t('predicted')}</span>
          </div>
        )}

        {/* Expand chevron */}
        <div className="flex justify-center mt-2">
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-text-muted text-xs group-hover:text-white/60 transition-colors"
          >
            ▾
          </motion.div>
        </div>
      </button>

      {/* Prediction form — animated */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="prediction-form"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-white/5 pt-4">
              <PredictionForm
                match={match}
                existingPrediction={prediction}
                onSave={async (data) => { await onSavePrediction(data); setExpanded(false); }}
                saving={savingMatchId === match.id}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

function TeamBlock({ name, badge, score, isWinner, isLeading, right }: {
  name: string; badge: string | null; score: number | null;
  isWinner: boolean; isLeading?: boolean; right?: boolean;
}) {
  const shortName = name.length > 12 ? name.split(' ').pop() || name : name;
  const highlight = isWinner || isLeading;
  return (
    <div className={cn('flex flex-col items-center gap-1.5 w-[80px]', right && '')}>
      {badge ? (
        <img
          src={badge}
          alt={name}
          className={cn(
            'w-9 h-9 object-contain transition-all duration-200',
            highlight && 'drop-shadow-[0_0_8px_rgba(0,255,135,0.5)] scale-105',
          )}
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-base">⚽</div>
      )}
      <span className={cn(
        'text-center text-xs leading-tight transition-colors duration-300',
        highlight ? 'text-accent-green font-semibold' : 'text-text-muted',
      )}>
        {shortName}
      </span>
    </div>
  );
}
