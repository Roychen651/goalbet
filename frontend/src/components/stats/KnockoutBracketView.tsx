import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLangStore } from '../../stores/langStore';
import { useKnockoutMatches } from '../../hooks/useKnockoutMatches';
import { classifyBracketStage, BRACKET_STAGE_ORDER, BRACKET_STAGE_LABEL_KEY, type BracketStage } from '../../lib/knockoutStages';
import { tTeam } from '../../lib/dictionaries/teamsHe';
import { EntityBadge } from '../ui/EntityBadge';
import { MatchStatusBadge } from '../matches/MatchStatusBadge';
import { GlassCard } from '../ui/GlassCard';
import { EmptyState } from '../ui/EmptyState';
import { PageLoader } from '../ui/LoadingSpinner';
import { FINISHED_STATUSES } from '../../lib/constants';
import type { Match } from '../../lib/supabase';
import type { TranslationKey } from '../../lib/i18n';

// V7 Sprint 56 — "The Knockout Path": a dynamic knockout-stage bracket for
// UEFA's Swiss-model club competitions (Champions/Europa/Conference League).
// Unlike the World Cup bracket (lib/worldCup2026.ts), there is no static
// draw to scaffold against — the play-off/R16/QF/SF/final matchups aren't
// known until each round is actually drawn. This view is therefore purely
// DERIVED from real synced `matches` rows, grouped by `classifyBracketStage
// (match.round)` — never a hand-authored bracket shape.
//
// Deliberately READ-ONLY / informational, not a second predict-from-here
// surface. Every match rendered here is a normal synced row already
// reachable from the Home Feed's own predict flow — wiring a full
// PredictionModal + usePredictions here would duplicate that flow for
// marginal benefit. Instead, tapping a card deep-links into the Home Feed
// via the exact `?focus=<match_id>` mechanism already proven for
// notification "View Match" CTAs (Sprint 23, §38), extended with a small
// `?tab=` override so a live/upcoming knockout match doesn't land on the
// notification-only default of the 'completed' tab (where it would show
// "no matches found" since it hasn't finished yet).

const KNOCKOUT_LEAGUE_IDS = new Set<number>([4346, 4399, 4877]);

export function isKnockoutCapableLeague(leagueId: number | null): boolean {
  return leagueId != null && KNOCKOUT_LEAGUE_IDS.has(leagueId);
}

function scoreDisplay(match: Match): { home: number | string; away: number | string; suffix: string | null } {
  // Rule 4.7 — scoring (and the honest final-score read) always prefers
  // regulation_home/away for ET/PEN matches, falling back to the plain
  // score for matches that never went to extra time.
  const home = match.regulation_home ?? match.home_score;
  const away = match.regulation_away ?? match.away_score;
  if (home == null || away == null) return { home: '–', away: '–', suffix: null };
  if (match.went_to_penalties && match.penalty_home != null && match.penalty_away != null) {
    return { home, away, suffix: `(${match.penalty_home}-${match.penalty_away} pen.)` };
  }
  if (match.regulation_home != null && match.home_score != null && match.regulation_home !== match.home_score) {
    return { home, away, suffix: 'AET' };
  }
  return { home, away, suffix: null };
}

function StageMatchCard({ match, lang, onOpen }: { match: Match; lang: 'en' | 'he'; onOpen: (m: Match) => void }) {
  const { home, away, suffix } = scoreDisplay(match);
  const isFinished = FINISHED_STATUSES.includes(match.status);
  const homeName = lang === 'he' ? tTeam(match.home_team) : match.home_team;
  const awayName = lang === 'he' ? tTeam(match.away_team) : match.away_team;

  return (
    <button
      type="button"
      onClick={() => onOpen(match)}
      className="w-full text-start"
    >
      <GlassCard
        variant="elevated"
        edgeGradient
        className="px-3 py-2.5 hover:border-accent-green/30 transition-colors"
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <MatchStatusBadge status={match.status} className="text-[9px]" />
          {suffix && (
            // Hand-built Latin+digit string ("(5-4 pen.)" / "AET") embedded
            // under a possibly-RTL ancestor — dir="ltr" pins it explicitly
            // so the browser's bidi algorithm never reorders it (the exact
            // "(.pen 5-4)" scramble this shipped with once already, caught
            // live in this sprint's own Hebrew verification screenshot).
            <span dir="ltr" className="font-mono text-[9px] text-text-muted/70 tracking-wide">{suffix}</span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <EntityBadge src={match.home_team_badge} name={homeName} hashSeed={match.home_team} size={22} />
            <span className="truncate font-barlow font-bold text-[13px] text-white">{homeName}</span>
          </div>
          <span className="font-mono tabular-nums font-bold text-sm text-white shrink-0 min-w-[1.5rem] text-center">
            {home}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 min-w-0 mt-1">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <EntityBadge src={match.away_team_badge} name={awayName} hashSeed={match.away_team} size={22} />
            <span className="truncate font-barlow font-bold text-[13px] text-white">{awayName}</span>
          </div>
          <span className="font-mono tabular-nums font-bold text-sm text-white shrink-0 min-w-[1.5rem] text-center">
            {away}
          </span>
        </div>

        {!isFinished && (
          <div className="mt-1.5 pt-1.5 border-t border-white/5">
            <span className="text-[10px] font-mono tabular-nums text-text-muted/70">
              {new Date(match.kickoff_time).toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}
      </GlassCard>
    </button>
  );
}

export function KnockoutBracketView({ leagueId, season, isCurrentSeason = true }: { leagueId: number; season?: number | null; isCurrentSeason?: boolean }) {
  const { t, lang } = useLangStore();
  const navigate = useNavigate();
  const { matches, loading } = useKnockoutMatches(leagueId, season ?? null);

  const stageGroups = useMemo(() => {
    const groups = new Map<BracketStage, Match[]>();
    for (const m of matches) {
      const stage = classifyBracketStage(m.round);
      if (!stage) continue; // league-phase/matchday row — not a knockout stage, not rendered here
      const existing = groups.get(stage) ?? [];
      existing.push(m);
      groups.set(stage, existing);
    }
    // Chronological within a stage
    for (const list of groups.values()) {
      list.sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime());
    }
    return groups;
  }, [matches]);

  const orderedStages = BRACKET_STAGE_ORDER.filter(s => (stageGroups.get(s)?.length ?? 0) > 0);

  const openMatch = (m: Match) => {
    const isLive = ['1H', 'HT', '2H', 'ET1', 'ET2', 'PEN'].includes(m.status);
    const tab = FINISHED_STATUSES.includes(m.status) ? 'completed' : isLive ? 'live' : 'all';
    navigate(`/?focus=${m.id}&tab=${tab}`);
  };

  if (loading) return <PageLoader />;

  if (orderedStages.length === 0) {
    // V7 Sprint 57 — "not started yet" is only ever true for the CURRENT
    // season. A genuinely past/archived season with zero rows here means
    // something different (most likely: those matches predate Sprint 48's
    // round-capture fix and haven't been backfilled — see
    // backfillMatchRounds.ts) — a distinct, honest message rather than
    // implying the tournament simply hasn't happened yet.
    return (
      <EmptyState
        icon="🏆"
        title={t((isCurrentSeason ? 'bracketNoDataTitle' : 'bracketNoDataTitleArchived') as TranslationKey)}
        description={t((isCurrentSeason ? 'bracketNoDataDescription' : 'bracketNoDataDescriptionArchived') as TranslationKey)}
      />
    );
  }

  return (
    <div className="space-y-5">
      {orderedStages.map((stage, stageIdx) => {
        const stageMatches = stageGroups.get(stage) ?? [];
        return (
          <div key={stage}>
            <div className="flex items-center gap-2 mb-2.5">
              {stage === 'final' ? (
                <Trophy size={14} className="text-[#FFC94A]" aria-hidden />
              ) : (
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  stage === 'sf' ? 'bg-accent-orange' : stage === 'qf' ? 'bg-accent-green' : 'bg-accent-secondary',
                )} aria-hidden />
              )}
              <h3 className="font-barlow font-bold text-sm uppercase tracking-wider text-white">
                {t(BRACKET_STAGE_LABEL_KEY[stage] as TranslationKey)}
              </h3>
              <span className="font-mono tabular-nums text-[10px] text-text-muted/60">
                {stageMatches.length}
              </span>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: stageIdx * 0.04, ease: 'easeOut' as const }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
            >
              {stageMatches.map(m => (
                <StageMatchCard key={m.id} match={m} lang={lang} onOpen={openMatch} />
              ))}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
