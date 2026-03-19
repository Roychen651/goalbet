import { supabaseAdmin } from '../lib/supabaseAdmin';
import { fetchLeagueMatches, fetchMatchHalftimeScore, LEAGUE_ESPN_MAP, DBMatchWithClock } from './espn';
import { calculatePoints } from './pointsEngine';
import { logger } from '../lib/logger';

interface PendingMatch {
  id: string;
  external_id: string;
  league_id: number;
  home_score: number | null;
  away_score: number | null;
  status: string;
  halftime_home: number | null;
  halftime_away: number | null;
  corners_total: number | null;
  regulation_home: number | null;
  regulation_away: number | null;
  went_to_penalties: boolean;
  penalty_home: number | null;
  penalty_away: number | null;
  red_cards_home: number | null;
  red_cards_away: number | null;
}

interface Prediction {
  id: string;
  user_id: string;
  match_id: string;
  group_id: string;
  predicted_outcome: 'H' | 'D' | 'A' | null;
  predicted_home_score: number | null;
  predicted_away_score: number | null;
  predicted_corners: 'under9' | 'ten' | 'over11' | null;
  predicted_btts: boolean | null;
  predicted_over_under: 'over' | 'under' | null;
}

// Find all matches that need processing:
// 1. In-progress matches (1H, HT, 2H, NS past kickoff) — need score update
// 2. FT matches that still have unresolved predictions — backend was down when match ended
async function getPendingMatches(): Promise<PendingMatch[]> {
  const slightlyAhead = new Date(Date.now() + 2 * 60 * 1000).toISOString();

  // Query 1: in-progress / not-yet-finished matches
  const { data: inProgress, error: e1 } = await supabaseAdmin
    .from('matches')
    .select('id, external_id, league_id, home_score, away_score, status, halftime_home, halftime_away, corners_total, regulation_home, regulation_away, went_to_penalties, penalty_home, penalty_away, red_cards_home, red_cards_away')
    .not('status', 'in', '("FT","PST","CANC")')
    .lt('kickoff_time', slightlyAhead);

  if (e1) {
    logger.error('[scoreUpdater] Failed to fetch in-progress matches:', e1);
    return [];
  }

  // Query 2: FT matches that still have at least one unresolved prediction
  // (happens when backend was sleeping/down when the match finished)
  const { data: unresolvedPredRows } = await supabaseAdmin
    .from('predictions')
    .select('match_id')
    .eq('is_resolved', false);

  const unresolvedMatchIds = [...new Set((unresolvedPredRows ?? []).map(p => p.match_id))];
  let ftMissed: PendingMatch[] = [];

  if (unresolvedMatchIds.length > 0) {
    const { data: ftData, error: e2 } = await supabaseAdmin
      .from('matches')
      .select('id, external_id, league_id, home_score, away_score, status, halftime_home, halftime_away, corners_total, regulation_home, regulation_away, went_to_penalties, penalty_home, penalty_away, red_cards_home, red_cards_away')
      .in('id', unresolvedMatchIds)
      .eq('status', 'FT')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);

    if (e2) logger.warn('[scoreUpdater] Failed to fetch missed FT matches:', e2);
    else ftMissed = ftData ?? [];
  }

  if (ftMissed.length > 0) {
    logger.info(`[scoreUpdater] Found ${ftMissed.length} FT match(es) with unresolved predictions (catch-up)`);
  }

  // Merge, deduplicate by id
  const all = [...(inProgress ?? []), ...ftMissed];
  const seen = new Set<string>();
  return all.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
}

async function updateMatchScore(matchId: string, scoreData: DBMatchWithClock): Promise<void> {
  const payload: Record<string, unknown> = {
    status: scoreData.status,
    home_score: scoreData.home_score,
    away_score: scoreData.away_score,
    display_clock: scoreData.display_clock ?? null,
  };

  // Capture halftime score — three sources, in priority order:
  // 1. ESPN linescores (explicit, most reliable)
  // 2. When status is HT, the current home_score IS the halftime score (goals through 45')
  // 3. 1H→2H inference (handled in checkAndUpdateScores before calling here)
  // Never overwrite a valid halftime value with null.
  if (scoreData.halftime_home !== null && scoreData.halftime_away !== null) {
    payload.halftime_home = scoreData.halftime_home;
    payload.halftime_away = scoreData.halftime_away;
  } else if (scoreData.status === 'HT' && scoreData.home_score !== null) {
    // At halftime status, the current score IS the halftime score
    payload.halftime_home = scoreData.home_score;
    payload.halftime_away = scoreData.away_score;
  }

  // Update corners_total from ESPN statistics when available (never overwrite with null)
  if (scoreData.corners_total !== null && scoreData.corners_total !== undefined) {
    payload.corners_total = scoreData.corners_total;
  }

  // Store regulation-time (90 min) score for ET/penalty matches — never overwrite with null
  if (scoreData.regulation_home !== null && scoreData.regulation_home !== undefined) {
    payload.regulation_home = scoreData.regulation_home;
    payload.regulation_away = scoreData.regulation_away;
  }

  // Mark penalty shootout matches — always write this (even false resets stale true values)
  payload.went_to_penalties = scoreData.went_to_penalties ?? false;

  // Store penalty shootout score (never overwrite with null)
  if (scoreData.penalty_home !== null && scoreData.penalty_home !== undefined) {
    payload.penalty_home = scoreData.penalty_home;
    payload.penalty_away = scoreData.penalty_away;
  }

  // Update red card counts (live stat — always write when ESPN returns data)
  if (scoreData.red_cards_home !== null && scoreData.red_cards_home !== undefined) {
    payload.red_cards_home = scoreData.red_cards_home;
    payload.red_cards_away = scoreData.red_cards_away;
  }

  let { error } = await supabaseAdmin
    .from('matches')
    .update(payload)
    .eq('id', matchId);

  if (error?.message?.includes('display_clock')) {
    // Column not yet migrated — retry without clock field
    delete payload.display_clock;
    ({ error } = await supabaseAdmin.from('matches').update(payload).eq('id', matchId));
  }

  if (error) {
    logger.error(`[scoreUpdater] Failed to update match ${matchId}:`, error);
    throw error;
  }
}

async function resolveMatchPredictions(matchId: string, matchResult: {
  home_score: number;
  away_score: number;
  corners_total: number | null;
  regulation_home?: number | null;
  regulation_away?: number | null;
}): Promise<number> {
  const { data: predictions, error } = await supabaseAdmin
    .from('predictions')
    .select('*')
    .eq('match_id', matchId)
    .eq('is_resolved', false);

  if (error) {
    logger.error(`[scoreUpdater] Failed to fetch predictions for match ${matchId}:`, error);
    return 0;
  }

  if (!predictions || predictions.length === 0) {
    logger.debug(`[scoreUpdater] No unresolved predictions for match ${matchId}`);
    return 0;
  }

  let resolved = 0;

  for (const prediction of predictions as Prediction[]) {
    try {
      const { data: lbData } = await supabaseAdmin
        .from('leaderboard')
        .select('total_points, weekly_points, predictions_made, correct_predictions')
        .eq('user_id', prediction.user_id)
        .eq('group_id', prediction.group_id)
        .single();

      // Use 90-minute regulation score for scoring when match went to ET/penalties.
      // Predictions are always judged on the 90-minute result.
      const scoringResult = {
        home_score: matchResult.regulation_home ?? matchResult.home_score,
        away_score: matchResult.regulation_away ?? matchResult.away_score,
        corners_total: matchResult.corners_total,
      };
      const breakdown = calculatePoints(prediction, scoringResult);
      const finalPoints = breakdown.total;
      const isCorrect = breakdown.correct_prediction;

      const { error: predUpdateError } = await supabaseAdmin
        .from('predictions')
        .update({ points_earned: finalPoints, is_resolved: true })
        .eq('id', prediction.id);

      if (predUpdateError) {
        logger.error(`[scoreUpdater] Failed to mark prediction ${prediction.id} as resolved:`, predUpdateError);
        continue;
      }

      const existingLB = {
        total_points: lbData?.total_points ?? 0,
        weekly_points: lbData?.weekly_points ?? 0,
        predictions_made: lbData?.predictions_made ?? 0,
        correct_predictions: lbData?.correct_predictions ?? 0,
      };

      await supabaseAdmin
        .from('leaderboard')
        .upsert({
          user_id: prediction.user_id,
          group_id: prediction.group_id,
          total_points: existingLB.total_points + finalPoints,
          weekly_points: existingLB.weekly_points + finalPoints,
          predictions_made: existingLB.predictions_made + 1,
          correct_predictions: existingLB.correct_predictions + (isCorrect ? 1 : 0),
        }, { onConflict: 'user_id,group_id' });

      resolved++;
      logger.debug(`[scoreUpdater] Resolved prediction ${prediction.id}: ${finalPoints} pts`);
    } catch (err) {
      logger.error(`[scoreUpdater] Failed to resolve prediction ${prediction.id}:`, err);
    }
  }

  return resolved;
}

export async function checkAndUpdateScores(): Promise<{ checked: number; resolved: number }> {
  const pendingMatches = await getPendingMatches();

  if (pendingMatches.length === 0) {
    logger.debug('[scoreUpdater] No matches pending score update');
    return { checked: 0, resolved: 0 };
  }

  logger.info(`[scoreUpdater] Checking ${pendingMatches.length} pending matches`);

  // Group by league to minimize API calls
  const byLeague = new Map<number, PendingMatch[]>();
  for (const match of pendingMatches) {
    const list = byLeague.get(match.league_id) || [];
    list.push(match);
    byLeague.set(match.league_id, list);
  }

  let totalResolved = 0;

  for (const [leagueId, matches] of byLeague) {
    // Skip leagues ESPN doesn't cover — those matches won't auto-resolve via API
    if (!(leagueId in LEAGUE_ESPN_MAP)) {
      logger.debug(`[scoreUpdater] League ${leagueId} not in ESPN map, skipping auto-resolve`);
      continue;
    }

    try {
      // Fetch recent ESPN data for this league (past 3 days is enough for score resolution)
      const recentMatches = await fetchLeagueMatches(leagueId, 3, 1); // 1 day ahead catches early kickoffs

      for (const match of matches) {
        const freshData = recentMatches.find(e => e.external_id === match.external_id);
        if (!freshData) {
          logger.debug(`[scoreUpdater] No fresh data for match ${match.id} (${match.external_id})`);
          continue;
        }

        // ── Three-layer HT score capture ────────────────────────────────────
        // Layer 1 (handled in updateMatchScore): ESPN linescores non-null → saved directly
        // Layer 2: 1H/HT → 2H transition — infer from the DB score at end of first half
        // Layer 3: Already in 2H with null halftime → ESPN summary endpoint fallback
        let effectiveData = freshData;

        if (freshData.status === '2H' && freshData.halftime_home === null && match.halftime_home === null) {
          if (match.status === '1H' || match.status === 'HT') {
            // Layer 2: transition just happened — DB score was the HT score
            if (match.home_score !== null) {
              effectiveData = { ...freshData, halftime_home: match.home_score, halftime_away: match.away_score };
              logger.info(`[scoreUpdater] Layer 2 HT infer for match ${match.id}: ${match.home_score}-${match.away_score}`);
            }
          } else {
            // Layer 3: already in 2H, DB never captured HT — try ESPN summary endpoint
            const summaryHT = await fetchMatchHalftimeScore(match.external_id, match.league_id);
            if (summaryHT) {
              effectiveData = { ...freshData, ...summaryHT };
              logger.info(`[scoreUpdater] Layer 3 HT from summary for match ${match.id}: ${summaryHT.halftime_home}-${summaryHT.halftime_away}`);
            }
          }
        }

        if (effectiveData.status === 'FT' || effectiveData.status === 'PST' || effectiveData.status === 'CANC') {
          await updateMatchScore(match.id, effectiveData);

          if (effectiveData.status === 'FT' && effectiveData.home_score !== null && effectiveData.away_score !== null) {
            // If ESPN linescores are still null at FT (very rare), fall back to whatever
            // halftime value is already stored in DB (captured earlier during 1H/HT/2H).
            // For ET/penalty matches, effectiveData.regulation_home holds the 90-min score.
            const count = await resolveMatchPredictions(match.id, {
              home_score: effectiveData.home_score,
              away_score: effectiveData.away_score,
              corners_total: match.corners_total,
              regulation_home: effectiveData.regulation_home,
              regulation_away: effectiveData.regulation_away,
            });
            totalResolved += count;
            logger.info(`[scoreUpdater] Match ${match.id}: ${effectiveData.home_score}-${effectiveData.away_score}, resolved ${count} predictions`);
          }
        } else {
          // ── ET detection: resolve predictions at the end of 90 min ──────────
          // When a match enters Extra Time (ET1/ET2/AET/PEN), the 90-minute score
          // is locked. Predictions must be scored immediately — users shouldn't
          // have to wait until after ET and penalties for their points.
          const ET_STATUSES = ['ET1', 'ET2', 'AET', 'PEN'];
          const isNowET = ET_STATUSES.includes(effectiveData.status);

          if (isNowET && effectiveData.home_score !== null && effectiveData.away_score !== null) {
            // Determine the 90-minute regulation score (used for prediction scoring):
            // Priority 1 — ESPN linescores computed a regulation_home (1H+2H sum) → most accurate
            // Priority 2 — DB already has regulation_home from a prior ET1 poll
            // Priority 3 — We just transitioned to ET: current score IS the 90-min score
            let regulationHome = effectiveData.regulation_home;
            let regulationAway = effectiveData.regulation_away;

            if (regulationHome === null && match.regulation_home !== null) {
              // Already stored from a previous poll when ET started
              regulationHome = match.regulation_home;
              regulationAway = match.regulation_away;
            }

            const justEnteredET = !ET_STATUSES.includes(match.status);
            if (regulationHome === null && justEnteredET) {
              // First time we see ET — capture the current score as the 90-min result
              regulationHome = effectiveData.home_score;
              regulationAway = effectiveData.away_score;
              // Include in effectiveData so updateMatchScore saves it
              effectiveData = { ...effectiveData, regulation_home: regulationHome, regulation_away: regulationAway };
              logger.info(`[scoreUpdater] ET started for match ${match.id}: capturing 90-min score ${regulationHome}-${regulationAway}`);
            }

            await updateMatchScore(match.id, effectiveData);

            if (regulationHome !== null) {
              // resolveMatchPredictions checks is_resolved=false, so it's safe to call
              // even if we polled multiple times during ET — no double-resolution.
              const count = await resolveMatchPredictions(match.id, {
                home_score: regulationHome,
                away_score: regulationAway!,
                corners_total: match.corners_total,
              });
              if (count > 0) {
                totalResolved += count;
                logger.info(`[scoreUpdater] ET match ${match.id}: resolved ${count} predictions at 90-min score ${regulationHome}-${regulationAway}`);
              }
            }
          } else {
            // Still in regular time — update live score
            await updateMatchScore(match.id, effectiveData);
            logger.debug(`[scoreUpdater] Match ${match.id} in progress: ${effectiveData.home_score ?? 0}-${effectiveData.away_score ?? 0} (${effectiveData.status})`);
          }
        }
      }
    } catch (err) {
      logger.error(`[scoreUpdater] Error checking league ${leagueId}:`, err);
    }
  }

  // ── Catch-up: resolve FT matches that still have unresolved predictions ──
  // This handles cases where a previous resolution attempt failed (e.g. trigger bug).
  // We don't need to re-fetch ESPN data — scores are already in the DB.
  try {
    const { data: stuckPreds } = await supabaseAdmin
      .from('predictions')
      .select('match_id')
      .eq('is_resolved', false);

    const stuckMatchIds = [...new Set((stuckPreds ?? []).map((p: { match_id: string }) => p.match_id))];

    if (stuckMatchIds.length > 0) {
      const { data: ftStuck } = await supabaseAdmin
        .from('matches')
        .select('id, home_score, away_score, corners_total, regulation_home, regulation_away')
        .eq('status', 'FT')
        .not('home_score', 'is', null)
        .in('id', stuckMatchIds);

      for (const m of (ftStuck ?? []) as { id: string; home_score: number; away_score: number; corners_total: number | null; regulation_home: number | null; regulation_away: number | null }[]) {
        const count = await resolveMatchPredictions(m.id, {
          home_score: m.home_score,
          away_score: m.away_score,
          corners_total: m.corners_total,
          regulation_home: m.regulation_home,
          regulation_away: m.regulation_away,
        });
        if (count > 0) {
          totalResolved += count;
          logger.info(`[scoreUpdater] Catch-up resolved ${count} stuck predictions for FT match ${m.id}`);
        }
      }
    }
  } catch (err) {
    logger.error('[scoreUpdater] Catch-up resolution error:', err);
  }

  return { checked: pendingMatches.length, resolved: totalResolved };
}

export async function resetWeeklyPoints(): Promise<void> {
  logger.info('[scoreUpdater] Resetting weekly points (saving last_week_points first)');
  // Atomically: last_week_points = weekly_points, weekly_points = 0
  const { error } = await supabaseAdmin.rpc('reset_weekly_points');

  if (error) {
    logger.error('[scoreUpdater] Failed to reset weekly points:', error);
  } else {
    logger.info('[scoreUpdater] Weekly points reset complete');
  }
}
