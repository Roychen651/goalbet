import { supabaseAdmin } from '../lib/supabaseAdmin';
import { fetchLeagueMatches, fetchMatchHalftimeScore, fetchMatchLinescoreRepair, fetchMatchKeyEvents, LEAGUE_ESPN_MAP, DBMatchWithClock } from './espn';
import { calculatePoints } from './pointsEngine';
import { logger } from '../lib/logger';
import { ensurePostMatchSummary } from './aiScout';

interface PendingMatch {
  id: string;
  external_id: string;
  league_id: number;
  kickoff_time: string;
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
    .select('id, external_id, league_id, kickoff_time, home_score, away_score, status, halftime_home, halftime_away, corners_total, regulation_home, regulation_away, went_to_penalties, penalty_home, penalty_away, red_cards_home, red_cards_away')
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
      .select('id, external_id, league_id, kickoff_time, home_score, away_score, status, halftime_home, halftime_away, corners_total, regulation_home, regulation_away, went_to_penalties, penalty_home, penalty_away, red_cards_home, red_cards_away')
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

  // Mark penalty shootout — only ever set to true, never reset to false once confirmed.
  // ESPN sometimes has a lag cycle where a finished PEN match briefly shows STATUS_FINAL
  // (went_to_penalties=false) before showing STATUS_FINAL_PK. Avoid wiping correct data.
  if (scoreData.went_to_penalties) {
    payload.went_to_penalties = true;
  }

  // Store penalty shootout score (never overwrite with null)
  if (scoreData.penalty_home !== null && scoreData.penalty_home !== undefined) {
    payload.penalty_home = scoreData.penalty_home;
    payload.penalty_away = scoreData.penalty_away;
  }

  // Update red card counts — write when EITHER side has data (use 0 as fallback for missing).
  // Previously checked only red_cards_home, which silently dropped away red cards when the
  // home stat was absent (ESPN omits the stat for teams with 0 red cards in some leagues).
  if (scoreData.red_cards_home !== null || scoreData.red_cards_away !== null) {
    payload.red_cards_home = scoreData.red_cards_home ?? 0;
    payload.red_cards_away = scoreData.red_cards_away ?? 0;
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
  home_team?: string;
  away_team?: string;
  kickoff_time?: string;
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

  // Compute the canonical "match end" timestamp once.
  // Used as created_at for all derived rows (coin txns, notifications, group events)
  // so they reflect when the match actually ended — not when the backend woke up.
  // The user's words: "the times are sacred."
  // 90 min regulation + ~15 min for half-time + injury time ≈ 105 min from kickoff.
  const matchEndAt = matchResult.kickoff_time
    ? new Date(new Date(matchResult.kickoff_time).getTime() + 105 * 60 * 1000).toISOString()
    : new Date().toISOString();

  let resolved = 0;

  for (const prediction of predictions as Prediction[]) {
    try {
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

      // ── ATOMIC CLAIM: only one concurrent caller wins ─────────────────────
      // Race fix: previously this UPDATE had no is_resolved guard. Multiple
      // workers (GitHub Actions cron, backend scheduler, manual sync) all
      // SELECTed the same is_resolved=false rows, all UPDATEd them, all
      // awarded coins. Result: duplicate coin awards on every match.
      //
      // The .eq('is_resolved', false) guard means: only the first writer
      // flips the flag. The .select() returns the affected row(s) so we
      // know whether *we* won the race. If the array is empty, another
      // worker resolved this prediction first — skip the side effects.
      const { data: claimed, error: predUpdateError } = await supabaseAdmin
        .from('predictions')
        .update({ points_earned: finalPoints, is_resolved: true })
        .eq('id', prediction.id)
        .eq('is_resolved', false)
        .select('id');

      if (predUpdateError) {
        logger.error(`[scoreUpdater] Failed to mark prediction ${prediction.id} as resolved:`, predUpdateError);
        continue;
      }

      if (!claimed || claimed.length === 0) {
        // Another concurrent worker already resolved this prediction.
        // Skip coins/notifications/leaderboard to avoid duplicates.
        logger.debug(`[scoreUpdater] Prediction ${prediction.id} already claimed by another worker — skipping side effects`);
        continue;
      }

      // Only fetch leaderboard AFTER winning the claim — avoids stale reads.
      const { data: lbData } = await supabaseAdmin
        .from('leaderboard')
        .select('total_points, weekly_points, predictions_made, correct_predictions')
        .eq('user_id', prediction.user_id)
        .eq('group_id', prediction.group_id)
        .single();

      // ── Award coins: 2× points earned ────────────────────────────────────
      // IMPORTANT: supabaseAdmin.rpc() never throws — it returns { data, error }.
      // A try/catch does NOT catch Supabase errors. Must destructure { error }.
      if (finalPoints > 0) {
        const coinsToAward = finalPoints * 2;
        const { error: coinError } = await supabaseAdmin.rpc('increment_coins', {
          p_user_id: prediction.user_id,
          p_group_id: prediction.group_id,
          p_match_id: matchId,
          p_amount: coinsToAward,
          p_description: `Won ${finalPoints} pts → ${coinsToAward} coins`,
          p_created_at: matchEndAt,  // ← coin transaction reflects match end, not server clock
        });
        if (coinError) {
          // Log full error details so Render logs capture exactly what failed.
          // Migration 021 fixes the root cause (coin_transactions INSERT no longer
          // rolls back the group_members UPDATE), so this should be rare.
          logger.error(
            `[scoreUpdater] increment_coins FAILED for prediction ${prediction.id} ` +
            `user=${prediction.user_id} group=${prediction.group_id} amount=${coinsToAward} — ` +
            (coinError.message ?? JSON.stringify(coinError))
          );
        } else {
          logger.info(`[scoreUpdater] Awarded ${coinsToAward} coins (${finalPoints} pts × 2) to user ${prediction.user_id}`);
        }

        // ── Insert persistent notification (with dedup guard) ─────────────────
        // Concurrent score syncs can race: both fetch is_resolved=false, both
        // resolve and try to insert. Guard by checking if a notification for
        // this match+user+type already exists before inserting.
        const { data: existingNotif } = await supabaseAdmin
          .from('notifications')
          .select('id')
          .eq('user_id', prediction.user_id)
          .eq('type', 'prediction_result')
          .filter('metadata->>match_id', 'eq', matchId)
          .limit(1)
          .maybeSingle();

        if (!existingNotif) {
          const { error: notifError } = await supabaseAdmin
            .from('notifications')
            .insert({
              user_id:   prediction.user_id,
              group_id:  prediction.group_id,
              type:      'prediction_result',
              title_key: 'notif_prediction_result',
              body_key:  'notif_prediction_result_body',
              created_at: matchEndAt,  // ← time the MATCH ended, not when backend woke up
              metadata: {
                match_id:     matchId,
                home_team:    matchResult.home_team  ?? '',
                away_team:    matchResult.away_team  ?? '',
                home_score:   matchResult.regulation_home ?? matchResult.home_score,
                away_score:   matchResult.regulation_away ?? matchResult.away_score,
                points_earned: finalPoints,
                coins_earned:  coinsToAward,
              },
            });
          if (notifError) {
            logger.warn(`[scoreUpdater] Notification insert failed for prediction ${prediction.id}: ${notifError.message}`);
          }
        }

        // ── Insert locker room activity event ─────────────────────────────────
        const { error: evtErr } = await supabaseAdmin
          .from('group_events')
          .insert({
            group_id:   prediction.group_id,
            user_id:    prediction.user_id,
            event_type: 'WON_COINS',
            match_id:   matchId,
            created_at: matchEndAt,  // ← time the MATCH ended, not when backend woke up
            metadata: {
              coins:        coinsToAward,
              points:       finalPoints,
              home_team:    matchResult.home_team  ?? '',
              away_team:    matchResult.away_team  ?? '',
            },
          });
        if (evtErr) logger.warn(`[scoreUpdater] group_events insert failed: ${evtErr.message}`);
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

        // ── Red card fallback via key events ────────────────────────────────
        // ESPN's scoreboard statistics may not include 'redCards' for live matches,
        // or may omit the stat when the count is 0, causing null for both sides.
        // Fall back to counting red/second_yellow events from the summary endpoint.
        if (effectiveData.red_cards_home === null || effectiveData.red_cards_away === null) {
          try {
            const events = await fetchMatchKeyEvents(match.external_id, match.league_id);
            if (events && events.length > 0) {
              const isRed = (e: { type: string }) => e.type === 'red_card' || e.type === 'second_yellow';
              const homeReds = events.filter(e => e.team === 'home' && isRed(e)).length;
              const awayReds = events.filter(e => e.team === 'away' && isRed(e)).length;
              effectiveData = { ...effectiveData, red_cards_home: homeReds, red_cards_away: awayReds };
              if (homeReds > 0 || awayReds > 0) {
                logger.info(`[scoreUpdater] Red cards from key events for match ${match.id}: home=${homeReds} away=${awayReds}`);
              }
            }
          } catch {
            // summary fetch failed — continue without red card data
          }
        }

        if (effectiveData.status === 'FT' || effectiveData.status === 'PST' || effectiveData.status === 'CANC') {
          await updateMatchScore(match.id, effectiveData);

          if (effectiveData.status === 'FT' && effectiveData.home_score !== null && effectiveData.away_score !== null) {
            // If ESPN linescores are still null at FT (very rare), fall back to whatever
            // halftime value is already stored in DB (captured earlier during 1H/HT/2H).
            // For ET/penalty matches, effectiveData.regulation_home holds the 90-min score.
            // Use fresh ESPN corners if available, fall back to DB value.
            // (Corners are typically set manually after the match so both may be null at FT.)
            const count = await resolveMatchPredictions(match.id, {
              home_score: effectiveData.home_score,
              away_score: effectiveData.away_score,
              corners_total: effectiveData.corners_total ?? match.corners_total,
              regulation_home: effectiveData.regulation_home,
              regulation_away: effectiveData.regulation_away,
              home_team: effectiveData.home_team,
              away_team: effectiveData.away_team,
              kickoff_time: match.kickoff_time,
            });
            totalResolved += count;
            logger.info(`[scoreUpdater] Match ${match.id}: ${effectiveData.home_score}-${effectiveData.away_score}, resolved ${count} predictions`);

            // Post-match AI Scout — generates a witty summary once, then served infinitely
            // from the DB. Silent no-op if Groq isn't configured or the call fails.
            await ensurePostMatchSummary(match.id);
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
                home_team: effectiveData.home_team,
                away_team: effectiveData.away_team,
                kickoff_time: match.kickoff_time,
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

  // ── Corners re-score: fix predictions scored before corners_total was set ──
  // corners_total is entered manually after the match. If predictions were already
  // resolved with corners_total = null, they got 0 corners pts. This pass finds
  // those and applies the correct delta (positive only — never subtracts points).
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: cornersMatches } = await supabaseAdmin
      .from('matches')
      .select('id, kickoff_time, home_score, away_score, corners_total, regulation_home, regulation_away')
      .eq('status', 'FT')
      .not('corners_total', 'is', null)
      .not('home_score', 'is', null)
      .gte('kickoff_time', sevenDaysAgo);

    for (const m of (cornersMatches ?? []) as { id: string; kickoff_time: string; home_score: number; away_score: number; corners_total: number; regulation_home: number | null; regulation_away: number | null }[]) {
      const { data: cornersPreds } = await supabaseAdmin
        .from('predictions')
        .select('*')
        .eq('match_id', m.id)
        .not('predicted_corners', 'is', null)
        .eq('is_resolved', true);

      for (const pred of (cornersPreds ?? []) as Prediction[]) {
        const scoringResult = {
          home_score: m.regulation_home ?? m.home_score,
          away_score: m.regulation_away ?? m.away_score,
          corners_total: m.corners_total,
        };
        const correctBreakdown = calculatePoints(pred, scoringResult);
        const delta = correctBreakdown.total - (pred as unknown as { points_earned: number }).points_earned;

        if (delta <= 0) continue; // already correct or an edge case — never subtract

        // ── ATOMIC CLAIM: only one concurrent worker wins the corners re-score ──
        // Without this guard, two concurrent score syncs (GitHub Actions cron +
        // backend scheduler + manual sync) would both read the same stale
        // points_earned, both compute the same positive delta, and both bump
        // the leaderboard. Coin double-credit is now blocked at the DB level
        // by migration 032's unique index, but the leaderboard would still be
        // over-credited without this guard.
        //
        // The .lt('points_earned', correctBreakdown.total) clause means: only
        // the first writer (whose points_earned is still < new total) wins.
        // The .select() returns affected rows so we know whether we won.
        const { data: claimed, error: claimErr } = await supabaseAdmin
          .from('predictions')
          .update({ points_earned: correctBreakdown.total })
          .eq('id', pred.id)
          .lt('points_earned', correctBreakdown.total)
          .select('id');

        if (claimErr) {
          logger.error(`[scoreUpdater] Corners re-score claim failed for ${pred.id}: ${claimErr.message}`);
          continue;
        }
        if (!claimed || claimed.length === 0) {
          logger.debug(`[scoreUpdater] Corners re-score for ${pred.id} already applied by another worker — skipping`);
          continue;
        }

        logger.info(`[scoreUpdater] Corners re-score: prediction ${pred.id} +${delta} pts (corners_total=${m.corners_total})`);

        const { data: lbData } = await supabaseAdmin
          .from('leaderboard')
          .select('total_points, weekly_points')
          .eq('user_id', pred.user_id)
          .eq('group_id', pred.group_id)
          .single();

        if (lbData) {
          await supabaseAdmin
            .from('leaderboard')
            .update({
              total_points: (lbData as { total_points: number }).total_points + delta,
              weekly_points: (lbData as { weekly_points: number }).weekly_points + delta,
            })
            .eq('user_id', pred.user_id)
            .eq('group_id', pred.group_id);
        }

        const coinsToAward = delta * 2;
        const cornersMatchEndAt = new Date(new Date(m.kickoff_time).getTime() + 105 * 60 * 1000).toISOString();
        const { error: coinError } = await supabaseAdmin.rpc('increment_coins', {
          p_user_id: pred.user_id,
          p_group_id: pred.group_id,
          p_match_id: m.id,
          p_amount: coinsToAward,
          p_description: `Corners re-score: +${delta} pts → +${coinsToAward} coins`,
          p_created_at: cornersMatchEndAt,
        });
        if (coinError) {
          logger.error(`[scoreUpdater] Corners re-score coin award failed for ${pred.id}: ${coinError.message ?? JSON.stringify(coinError)}`);
        } else {
          logger.info(`[scoreUpdater] Corners re-score awarded ${coinsToAward} coins to user ${pred.user_id}`);
        }
        totalResolved++;
      }
    }
  } catch (err) {
    logger.error('[scoreUpdater] Corners re-score error:', err);
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
        .select('id, kickoff_time, home_score, away_score, corners_total, regulation_home, regulation_away, home_team, away_team')
        .eq('status', 'FT')
        .not('home_score', 'is', null)
        .in('id', stuckMatchIds);

      for (const m of (ftStuck ?? []) as { id: string; kickoff_time: string; home_score: number; away_score: number; corners_total: number | null; regulation_home: number | null; regulation_away: number | null; home_team: string; away_team: string }[]) {
        const count = await resolveMatchPredictions(m.id, {
          home_score: m.home_score,
          away_score: m.away_score,
          corners_total: m.corners_total,
          regulation_home: m.regulation_home,
          regulation_away: m.regulation_away,
          home_team: m.home_team,
          away_team: m.away_team,
          kickoff_time: m.kickoff_time,
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
