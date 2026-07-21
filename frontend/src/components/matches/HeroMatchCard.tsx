import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Match, Prediction } from '../../lib/supabase';
import { EntityBadge } from '../ui/EntityBadge';
import { MatchStatusBadge } from './MatchStatusBadge';
import { cn, formatKickoffTime, getLiveClock, isMatchLocked } from '../../lib/utils';
import { teamHaloColor } from '../../lib/oklch';
import { tTeam } from '../../lib/dictionaries/teamsHe';
import { haptic } from '../../lib/haptics';
import { LIVE_STATUSES, FOOTBALL_LEAGUES, tLeagueName } from '../../lib/constants';
import { useLangStore } from '../../stores/langStore';
import { useUIStore } from '../../stores/uiStore';
import { useLiveClock } from '../../hooks/useLiveClock';

// V6 Sprint 50 — "The Hero Matchday Spotlight." A net-new component (grep
// confirmed zero prior hero/featured/spotlight concept anywhere in this
// codebase before this sprint). One instance ever renders per Home Feed
// view — the "single instance -> Framer, many simultaneous -> CSS" split
// this codebase applies repeatedly (leaderboard #1 halo, streak-tier
// avatar halo, §37) points at Framer Motion here, not a new CSS-keyframe
// system.
//
// The 3D perspective root and the ambient mesh/blur layer are DELIBERATELY
// separate elements — the exact WebKit backdrop-filter+transform-on-one-
// element trap that has shipped broken in production twice already in this
// app (PredictionModal's Vaul sheet, BottomNav's scroll drift) and was
// correctly avoided a third time by MatchCard's own ambient mesh (§58).
// The perspective root below carries ONLY transforms (rotateY/translateZ on
// the badges); the mesh is a sibling with no transform of its own.
//
// "Momentum" intensity is NOT a fabricated continuous metric — this app
// already killed a feature (§47's Live Pressure Cooker) for inventing
// precision a sparse ESPN feed couldn't honestly back. Instead this reuses
// the exact same real, already-proven signal MatchCard.tsx's own
// goal-flash effect already keys off (a genuine score change), with an
// honest decay window — never a synthesized "attacking pressure" number.

const RECENT_GOAL_WINDOW_MS = 60_000;

interface HeroMatchCardProps {
  match: Match;
  prediction?: Prediction;
}

export function HeroMatchCard({ match, prediction }: HeroMatchCardProps) {
  const { t, lang } = useLangStore();
  const openPredictionModal = useUIStore(s => s.openPredictionModal);
  const isRTL = lang === 'he';

  const isLive = LIVE_STATUSES.includes(match.status);
  const isPastKickoffNS = match.status === 'NS' && new Date(match.kickoff_time).getTime() < Date.now();
  const isInProgress = isLive || isPastKickoffNS;

  useLiveClock(20_000);
  const liveClock = isInProgress ? getLiveClock(match) : null;
  const { date, time, countdown } = formatKickoffTime(match.kickoff_time, lang);
  const locked = isMatchLocked(match.kickoff_time);
  const hasPrediction = !!prediction;

  // Real, discrete "a goal just happened" signal — never a synthesized
  // continuous momentum score. Decays back to calm after RECENT_GOAL_WINDOW_MS.
  const prevScoreRef = useRef<{ home: number | null; away: number | null } | null>(null);
  const [recentGoalAt, setRecentGoalAt] = useState<number | null>(null);
  useEffect(() => {
    const prev = prevScoreRef.current;
    if (prev && isLive && (prev.home !== match.home_score || prev.away !== match.away_score)) {
      setRecentGoalAt(Date.now());
    }
    prevScoreRef.current = { home: match.home_score, away: match.away_score };
  }, [match.home_score, match.away_score, isLive]);
  const [intense, setIntense] = useState(false);
  useEffect(() => {
    if (!recentGoalAt) { setIntense(false); return; }
    setIntense(true);
    const remaining = RECENT_GOAL_WINDOW_MS - (Date.now() - recentGoalAt);
    if (remaining <= 0) { setIntense(false); return; }
    const id = setTimeout(() => setIntense(false), remaining);
    return () => clearTimeout(id);
  }, [recentGoalAt]);

  const homeName = lang === 'he' ? tTeam(match.home_team) : match.home_team;
  const awayName = lang === 'he' ? tTeam(match.away_team) : match.away_team;
  const homeHalo = teamHaloColor(match.home_team, 0.22);
  const awayHalo = teamHaloColor(match.away_team, 0.22);
  const meshHomeSide = isRTL ? 'right' : 'left';
  const meshAwaySide = isRTL ? 'left' : 'right';
  const meshBackground = `radial-gradient(circle at ${meshHomeSide} 40%, ${homeHalo} 0%, transparent 62%), radial-gradient(circle at ${meshAwaySide} 40%, ${awayHalo} 0%, transparent 62%)`;

  const leagueInfo = FOOTBALL_LEAGUES.find(l => l.id === match.league_id);
  const localizedLeagueName = tLeagueName(match.league_id, match.league_name, lang);

  const handleTap = () => {
    if (match.status === 'NS' && !locked) {
      haptic('light');
      openPredictionModal(match.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'relative rounded-[24px] overflow-hidden border border-white/10 hero-spotlight-shell',
        intense ? 'hero-spotlight-ring-intense' : 'hero-spotlight-ring-calm'
      )}
      style={{ perspective: 1000 }}
    >
      {/* Ambient mesh — sibling of the perspective/transform layer below,
          never combined with it on one element (see header comment). CSS-
          only breathing, single instance so Framer would also be safe, but
          CSS keeps this consistent with every other ambient mesh in the app. */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 [mix-blend-mode:screen] hero-spotlight-mesh',
          intense ? 'hero-spotlight-mesh-intense' : 'hero-spotlight-mesh-calm'
        )}
        style={{ background: meshBackground }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/30 pointer-events-none" />

      <button
        type="button"
        onClick={handleTap}
        disabled={match.status !== 'NS' || locked}
        className="relative w-full text-start px-5 pt-4 pb-5 sm:px-7 sm:pt-6 sm:pb-7"
      >
        {/* Eyebrow row */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-white/60 text-[11px] font-display font-bold uppercase tracking-[0.18em]">
            {isLive ? t('liveNow') : t('matchOfTheDay')}
          </span>
          <MatchStatusBadge status={isPastKickoffNS ? 'DELAYED' : match.status} />
        </div>

        {/* 3D perspective layer — badges only. transform-style + fixed,
            non-pointer-tracked rotateY/translateZ offsets (this must read
            correctly on touch devices with no cursor, so it's a fixed
            spatial arrangement, not useTactileTilt-driven like a hover
            surface would be). */}
        <div className="flex items-center justify-center gap-4 sm:gap-8 mb-2" style={{ transformStyle: 'preserve-3d' }}>
          <div className="flex flex-col items-center gap-2 w-24 sm:w-32" style={{ transform: 'rotateY(10deg) translateZ(6px)' }}>
            <EntityBadge
              src={match.home_team_badge}
              name={homeName}
              hashSeed={match.home_team}
              size={64}
              className="w-14 h-14 sm:w-16 sm:h-16 drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]"
            />
            <span className="text-white text-xs sm:text-sm font-barlow font-bold text-center leading-tight truncate max-w-full">
              {homeName}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1 shrink-0 min-w-[90px]">
            {isInProgress || match.status === 'FT' ? (
              <>
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={`${match.home_score}-${match.away_score}`}
                    initial={{ scale: 1.15, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    className="text-4xl sm:text-5xl font-mono font-bold tabular-nums text-white leading-none"
                  >
                    {match.home_score ?? 0}
                    <span className="text-white/30 mx-1">–</span>
                    {match.away_score ?? 0}
                  </motion.span>
                </AnimatePresence>
                {isInProgress && liveClock && (
                  <span
                    className={cn(
                      'text-xs font-mono font-bold tabular-nums live-clock-pulse-green',
                      intense && 'hero-live-clock-intense'
                    )}
                  >
                    {liveClock}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="text-white/25 text-2xl font-display font-bold">{t('vsLabel')}</span>
                <span className="text-white/50 text-[11px]">{date}</span>
                <span className="text-white text-sm font-bold font-display tabular-nums">{time}</span>
                {countdown && <span className="text-accent-green/70 text-[10px] mt-0.5">{countdown}</span>}
              </>
            )}
          </div>

          <div className="flex flex-col items-center gap-2 w-24 sm:w-32" style={{ transform: 'rotateY(-10deg) translateZ(6px)' }}>
            <EntityBadge
              src={match.away_team_badge}
              name={awayName}
              hashSeed={match.away_team}
              size={64}
              className="w-14 h-14 sm:w-16 sm:h-16 drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]"
            />
            <span className="text-white text-xs sm:text-sm font-barlow font-bold text-center leading-tight truncate max-w-full">
              {awayName}
            </span>
          </div>
        </div>

        <p className="text-center text-white/35 text-[11px] mt-2 truncate">{localizedLeagueName}</p>

        {match.status === 'NS' && !locked && (
          <div className="mt-4 flex justify-center">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-display font-bold transition-all',
                hasPrediction
                  ? 'bg-white/8 border border-white/15 text-white/80'
                  : 'bg-accent-green/15 border border-accent-green/40 text-accent-green'
              )}
            >
              {hasPrediction ? t('updatePrediction') : t('lockInPrediction')}
            </span>
          </div>
        )}
      </button>
    </motion.div>
  );
}
