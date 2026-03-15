import { supabaseAdmin } from '../lib/supabaseAdmin';
import { fetchLeagueMatches, LEAGUE_ESPN_MAP, DBMatchWithClock } from './espn';
import { DBMatch } from './sportsdb';
import { calculatePoints, applyStreakBonus } from './pointsEngine';
import { logger } from '../lib/logger';

interface PendingMatch {
  id: string;
  external_id: string;
  league_id: number;
  home_score: number | null;
  away_score: number | null;
}

interface Prediction {
  id: string;
  user_id: string;
  match_id: string;
  group_id: string;
  predicted_outcome: 'H' | 'D' | 'A' | null;
  predicted_home_score: number | null;
  predicted_away_score: number | null;
  predicted_halftime_outcome: 'H' | 'D' | 'A' | null;
  predicted_halftime_home: number | null;
  predicted_halftime_away: number | null;
  predicted_btts: boolean | null;
  predicted_over_under: 'over' | 'under' | null;
}

// Find all matches that have kicked off and aren't finished yet.
// This covers both live in-progress matches (need score update) and
// expected-finished matches (need resolution). We start from 2 min before kickoff
// to handle early-start edge cases.
async function getPendingMatches(): Promise<PendingMatch[]> {
  const slightlyAhead = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2 min ahead

  const { data, error } = await supabaseAdmin
    .from('matches')
    .select('id, external_id, league_id, home_score, away_score')
    .not('status', 'in', '("FT","PST","CANC")')
    .lt('kickoff_time', slightlyAhead);

  if (error) {
    logger.error('[scoreUpdater] Failed to fetch pending matches:', error);
    return [];
  }

  return data || [];
}

async function updateMatchScore(matchId: string, scoreData: DBMatchWithClock): Promise<void> {
  const payload: Record<string, unknown> = {
    status: scoreData.status,
    home_score: scoreData.home_score,
    away_score: scoreData.away_score,
    display_clock: scoreData.display_clock ?? null,
  };

  // Only update halftime scores if ESPN returned them — never overwrite a valid value with null.
  // ESPN sometimes doesn't return linescores for in-progress 2H matches even though the
  // half-time score is already known. Overwriting with null would break HT prediction scoring.
  if (scoreData.halftime_home !== null && scoreData.halftime_away !== null) {
    payload.halftime_home = scoreData.halftime_home;
    payload.halftime_away = scoreData.halftime_away;
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
  halftime_home: number | null;
  halftime_away: number | null;
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
      // Fetch leaderboard row — include best_streak this time
      const { data: lbData } = await supabaseAdmin
        .from('leaderboard')
        .select('current_streak, best_streak, total_points, weekly_points, predictions_made, correct_predictions')
        .eq('user_id', prediction.user_id)
        .eq('group_id', prediction.group_id)
        .single();

      const currentStreak = lbData?.current_streak ?? 0;

      // Calculate points using pure function
      const breakdown = calculatePoints(prediction, matchResult);
      const finalPoints = applyStreakBonus(breakdown.total, currentStreak);

      // Mark prediction as resolved — MUST succeed before updating leaderboard
      const { error: predUpdateError } = await supabaseAdmin
        .from('predictions')
        .update({ points_earned: finalPoints, is_resolved: true })
        .eq('id', prediction.id);

      if (predUpdateError) {
        logger.error(`[scoreUpdater] Failed to mark prediction ${prediction.id} as resolved:`, predUpdateError);
        continue; // do NOT update leaderboard if prediction update failed
      }

      // Update leaderboard — properly track best_streak
      const isCorrect = breakdown.correct_prediction;
      const newStreak = isCorrect ? currentStreak + 1 : 0;
      const prevBestStreak = lbData?.best_streak ?? 0;
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
          current_streak: newStreak,
          best_streak: Math.max(prevBestStreak, newStreak),
        }, {
          onConflict: 'user_id,group_id',
        });

      resolved++;
      logger.debug(`[scoreUpdater] Resolved prediction ${prediction.id}: ${finalPoints} pts (streak: ${currentStreak}→${newStreak})`);
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

        if (freshData.status === 'FT' || freshData.status === 'PST' || freshData.status === 'CANC') {
          await updateMatchScore(match.id, freshData);

          if (freshData.status === 'FT' && freshData.home_score !== null && freshData.away_score !== null) {
            const count = await resolveMatchPredictions(match.id, {
              home_score: freshData.home_score,
              away_score: freshData.away_score,
              halftime_home: freshData.halftime_home,
              halftime_away: freshData.halftime_away,
            });
            totalResolved += count;
            logger.info(`[scoreUpdater] Match ${match.id}: ${freshData.home_score}-${freshData.away_score}, resolved ${count} predictions`);
          }
        } else {
          // Still in progress — update live score
          await updateMatchScore(match.id, freshData);
          logger.debug(`[scoreUpdater] Match ${match.id} in progress: ${freshData.home_score ?? 0}-${freshData.away_score ?? 0} (${freshData.status})`);
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
        .select('id, home_score, away_score, halftime_home, halftime_away')
        .eq('status', 'FT')
        .not('home_score', 'is', null)
        .in('id', stuckMatchIds);

      for (const m of (ftStuck ?? []) as { id: string; home_score: number; away_score: number; halftime_home: number | null; halftime_away: number | null }[]) {
        const count = await resolveMatchPredictions(m.id, {
          home_score: m.home_score,
          away_score: m.away_score,
          halftime_home: m.halftime_home,
          halftime_away: m.halftime_away,
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
  logger.info('[scoreUpdater] Resetting weekly points for all users');
  const { error } = await supabaseAdmin
    .from('leaderboard')
    .update({ weekly_points: 0 });

  if (error) {
    logger.error('[scoreUpdater] Failed to reset weekly points:', error);
  } else {
    logger.info('[scoreUpdater] Weekly points reset complete');
  }
}
