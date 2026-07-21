import { supabaseAdmin } from '../lib/supabaseAdmin';
import { fetchLeagueMatches, fetchMatchHalftimeScore, fetchMatchLinescoreRepair, fetchMatchKeyEvents, fetchMatchOfficials, LEAGUE_ESPN_MAP, DBMatchWithClock } from './espn';
import { calculatePoints, type ParlayTierKey } from './pointsEngine';
import { logger } from '../lib/logger';
import { ensurePostMatchSummary, ensureChronicle } from './aiScout';
import { sendPushToUser } from './pushSender';
import { getLeagueTier } from './leagueRegistry';
import { processBatched } from '../lib/batch';
import { resolvePoolsForMatch } from './syndicatePools';

/**
 * V6 Sprint 44 — captures the referee's name once, at FT resolution, so
 * get_referee_strictness() has real matches.referee_name data to aggregate
 * over going forward. Fire-and-forget (`void`-prefixed at the call site,
 * same shape as ensureChronicle) — a Groq-unrelated ESPN enrichment call
 * must never block or delay coin resolution. `.is('referee_name', null)`
 * guard means a match already captured (by a concurrent worker, or a
 * catch-up pass re-processing the same match) never re-fetches or
 * re-writes — the same idempotency shape writeInsight() already uses for
 * AI Scout's nullable text columns.
 */
async function captureRefereeName(matchId: string, externalId: string, leagueId: number): Promise<void> {
  try {
    const name = await fetchMatchOfficials(externalId, leagueId);
    if (!name) return;
    const { error } = await supabaseAdmin
      .from('matches')
      .update({ referee_name: name })
      .eq('id', matchId)
      .is('referee_name', null);
    if (error) logger.warn(`[scoreUpdater] Failed to persist referee_name for match ${matchId}: ${error.message}`);
  } catch (err) {
    logger.warn(`[scoreUpdater] captureRefereeName crashed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

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
  round: string | null;
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
  is_parlay: boolean | null;
  parlay_linked_tiers: ParlayTierKey[] | null;
  // V6 Sprint 47 — set by submit_copied_prediction() (migration 064),
  // always flattened to the ROOT creator, never an intermediate tailer.
  copied_from_user_id: string | null;
}

// ── Rank-drop tracking (V4 Sprint 11) ────────────────────────────────────────
// Captures each user's total_points the FIRST time it changes within a single
// checkAndUpdateScores() run, so multiple resolutions landing in the same tick
// (main FT loop + corners re-score + catch-up) collapse into ONE before->after
// comparison per user instead of firing a notification per write.
//
// Deliberately a per-call instance, never module-level: checkAndUpdateScores()
// is invoked concurrently from multiple entry points (the 30s live poller AND
// the public/internal HTTP sync routes), and a shared module-level tracker
// would let concurrent invocations clobber each other's before-snapshots.
// Because a tracker only ever records users THIS invocation actually won the
// atomic claim for (see resolveMatchPredictions / corners re-score below), an
// invocation that loses every claim ends up with an empty tracker and
// correctly sends zero notifications — no separate dedup table is needed here,
// the existing atomic-claim guard (rule 4.14) already provides it.
interface RankTracker {
  priorPoints: Map<string, Map<string, number>>; // groupId -> userId -> points before first touch this run
  touchedGroups: Set<string>;
}

function newRankTracker(): RankTracker {
  return { priorPoints: new Map(), touchedGroups: new Set() };
}

function recordPriorPoints(tracker: RankTracker, groupId: string, userId: string, pointsBeforeChange: number): void {
  tracker.touchedGroups.add(groupId);
  let group = tracker.priorPoints.get(groupId);
  if (!group) {
    group = new Map();
    tracker.priorPoints.set(groupId, group);
  }
  if (!group.has(userId)) group.set(userId, pointsBeforeChange); // only the first touch this run counts as "before"
}

// ── Momentum Bets: milestone question generation (V4 Sprint 14) ─────────────
type Milestone = 'kickoff' | 'halftime' | 'minute_75';

const MINUTE_75_THRESHOLD = 75;

function parseClockMinute(displayClock: string | null | undefined): number | null {
  if (!displayClock) return null;
  const m = displayClock.match(/^(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return isNaN(n) ? null : n;
}

/**
 * Detects a kickoff/halftime/minute-75 transition for this poll and, if one
 * just happened, generates an 'open' micro-prediction question (60s betting
 * window) for every group tracking this match's league. Idempotent via the
 * UNIQUE (match_id, group_id, milestone) constraint + upsert-ignore — safe to
 * call on every tick; only the first successful attempt per milestone
 * actually creates a row.
 *
 * `match.status` is the DB value as of the START of this batch (last tick's
 * write); `fresh.status` is this tick's ESPN read. Comparing them detects a
 * genuine first-time transition, same idiom already used for ET detection
 * elsewhere in this file — never fires repeatedly for the same milestone.
 */
async function generateMilestoneQuestions(
  match: { id: string; league_id: number; status: string },
  fresh: { status: string; display_clock?: string | null },
): Promise<void> {
  let milestone: Milestone | null = null;

  if (match.status === 'NS' && fresh.status === '1H') {
    milestone = 'kickoff';
  } else if (fresh.status === 'HT' && match.status !== 'HT') {
    milestone = 'halftime';
  } else if (fresh.status === '2H') {
    const minute = parseClockMinute(fresh.display_clock);
    if (minute !== null && minute >= MINUTE_75_THRESHOLD) milestone = 'minute_75';
  }

  if (!milestone) return;

  try {
    const { data: groups } = await supabaseAdmin
      .from('groups')
      .select('id')
      .contains('active_leagues', [match.league_id]);

    if (!groups || groups.length === 0) return;

    const now = new Date();
    const rows = groups.map(g => ({
      match_id: match.id,
      group_id: g.id,
      milestone,
      question_type: 'goal_next_10',
      status: 'open',
      opens_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 60_000).toISOString(),
    }));

    const { error } = await supabaseAdmin
      .from('micro_prediction_questions')
      .upsert(rows, { onConflict: 'match_id,group_id,milestone', ignoreDuplicates: true });

    if (error) {
      logger.warn(`[scoreUpdater] micro-question generation failed for match ${match.id}: ${error.message}`);
    } else {
      logger.info(`[scoreUpdater] Generated '${milestone}' micro-question for match ${match.id} across ${rows.length} group(s)`);
    }
  } catch (err) {
    logger.warn(`[scoreUpdater] micro-question generation error for match ${match.id}: ${(err as Error).message}`);
  }
}

// Find all matches that need processing:
// 1. In-progress matches (1H, HT, 2H, NS past kickoff) — need score update
// 2. FT matches that still have unresolved predictions — backend was down when match ended
async function getPendingMatches(): Promise<PendingMatch[]> {
  const slightlyAhead = new Date(Date.now() + 2 * 60 * 1000).toISOString();

  // Query 1: in-progress / not-yet-finished matches
  const { data: inProgress, error: e1 } = await supabaseAdmin
    .from('matches')
    .select('id, external_id, league_id, kickoff_time, home_score, away_score, status, halftime_home, halftime_away, corners_total, regulation_home, regulation_away, went_to_penalties, penalty_home, penalty_away, red_cards_home, red_cards_away, round')
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
      .select('id, external_id, league_id, kickoff_time, home_score, away_score, status, halftime_home, halftime_away, corners_total, regulation_home, regulation_away, went_to_penalties, penalty_home, penalty_away, red_cards_home, red_cards_away, round')
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
  league_id?: number;
  league_name?: string | null;
  round?: string | null;
}, tracker: RankTracker): Promise<number> {
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
        round: matchResult.round ?? null,
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

      // ── Chronicler: mythic saga on perfect +10 on a high-profile match ──
      // Fully async, swallows all errors internally — never blocks resolution.
      // Idempotent via unique (user_id, match_id) index on user_chronicles.
      if (finalPoints >= 10 && matchResult.league_id !== undefined) {
        void ensureChronicle({
          userId: prediction.user_id,
          matchId,
          groupId: prediction.group_id,
          pointsEarned: finalPoints,
          predictedHome: prediction.predicted_home_score,
          predictedAway: prediction.predicted_away_score,
          finalHome: scoringResult.home_score,
          finalAway: scoringResult.away_score,
          homeTeam: matchResult.home_team ?? '',
          awayTeam: matchResult.away_team ?? '',
          leagueId: matchResult.league_id,
          leagueName: matchResult.league_name ?? null,
        });
      }

      // Only fetch leaderboard AFTER winning the claim — avoids stale reads.
      const { data: lbData } = await supabaseAdmin
        .from('leaderboard')
        .select('total_points, weekly_points, predictions_made, correct_predictions, current_streak, best_streak')
        .eq('user_id', prediction.user_id)
        .eq('group_id', prediction.group_id)
        .single();

      // ── Award coins: 2× points earned ────────────────────────────────────
      // IMPORTANT: supabaseAdmin.rpc() never throws — it returns { data, error }.
      // A try/catch does NOT catch Supabase errors. Must destructure { error }.
      if (finalPoints > 0) {
        const grossCoins = finalPoints * 2;
        // V6 Sprint 47 — Copy-Betting royalty. A copied prediction's win
        // pays a 5% royalty to the ROOT creator (copied_from_user_id is
        // always already flattened to the root, never an intermediate
        // tailer — see submit_copied_prediction(), migration 064). floor(),
        // never round up, so the winner is guaranteed AT LEAST 95% of the
        // gross award. The winner's own award is computed with the net
        // amount up front — never award-the-full-amount-then-claw-back.
        const royalty = prediction.copied_from_user_id ? Math.floor(grossCoins * 0.05) : 0;
        const coinsToAward = grossCoins - royalty;
        // V5 Sprint 34 — a parlay-boosted payout gets a distinct marker in
        // the description string so it reads distinctly in CoinHistoryModal
        // without any new coin_transactions.type value or new column: the
        // description already flows straight from this one string into the
        // ledger row, and the dedup index (coin_transactions_bet_won_unique,
        // migration 032) keys on this exact string for THIS resolution
        // regardless of what text it contains. Same technique extended here
        // for the royalty marker.
        const parlayMarker = breakdown.parlay_bonus > 0 ? ` 🔗+${breakdown.parlay_bonus}` : '';
        // V6 Sprint 48 — same technique extended for the knockout round-
        // depth bonus. Placed before the royalty marker (a knockout win
        // that was also tailed shows both markers in the same order the
        // bonus itself was folded into finalPoints: base tiers → parlay →
        // knockout, matching pointsEngine.ts's own breakdown.total sum).
        const knockoutMarker = breakdown.knockout_bonus > 0 ? ` 🏆+${breakdown.knockout_bonus}` : '';
        const royaltyMarker = royalty > 0 ? ` (🔁 -${royalty} royalty)` : '';
        const { error: coinError } = await supabaseAdmin.rpc('increment_coins', {
          p_user_id: prediction.user_id,
          p_group_id: prediction.group_id,
          p_match_id: matchId,
          p_amount: coinsToAward,
          p_description: `Won ${finalPoints} pts${parlayMarker}${knockoutMarker}${royaltyMarker} → ${coinsToAward} coins`,
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
          logger.info(`[scoreUpdater] Awarded ${coinsToAward} coins (${finalPoints} pts × 2${royalty > 0 ? ` minus ${royalty} royalty` : ''}) to user ${prediction.user_id}`);
        }

        // ── Royalty payout to the root creator — independent, best-effort,
        // never blocks or rolls back the winner's own award above. Gated on
        // the winner's own award having actually succeeded (coinError is
        // null) — paying a royalty for a win that never landed would be
        // wrong, not just redundant.
        if (!coinError && royalty > 0 && prediction.copied_from_user_id) {
          const { error: royaltyError } = await supabaseAdmin.rpc('increment_coins', {
            p_user_id: prediction.copied_from_user_id,
            p_group_id: prediction.group_id,
            p_match_id: matchId,
            p_amount: royalty,
            p_description: `Royalty tip: your pick was copied and won → +${royalty} coins`,
            p_created_at: matchEndAt,
          });
          if (royaltyError) {
            logger.error(
              `[scoreUpdater] royalty increment_coins FAILED for creator=${prediction.copied_from_user_id} ` +
              `(tailed by ${prediction.user_id}) amount=${royalty} — ` +
              (royaltyError.message ?? JSON.stringify(royaltyError))
            );
          } else {
            logger.info(`[scoreUpdater] Awarded ${royalty} royalty coins to creator ${prediction.copied_from_user_id} (tailed by ${prediction.user_id})`);
          }
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
                parlay_bonus:  breakdown.parlay_bonus,
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
        current_streak: lbData?.current_streak ?? 0,
        best_streak: lbData?.best_streak ?? 0,
      };

      // Capture the pre-update total for rank-drop detection (before this
      // prediction's points are added below).
      recordPriorPoints(tracker, prediction.group_id, prediction.user_id, existingLB.total_points);

      // ── Streak (Sprint 8, display-only 🔥) ────────────────────────────────
      // Consecutive correct Tier-1 FT results. A correct result extends it; an
      // incorrect one resets to 0. Missing a matchday does NOT break it (only
      // resolved predictions count). Computed inside the atomic-claim block so
      // concurrent resolvers can't double-count. No coin/points multiplier.
      const newStreak = isCorrect ? existingLB.current_streak + 1 : 0;
      const newBest = Math.max(existingLB.best_streak, newStreak);

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
          best_streak: newBest,
          // Any resolution here means the user was demonstrably active in this
          // group — clear a stale day-6 warning flag so a FUTURE idle cycle
          // (weeks from now) can warn again. Without this, streak_warning_sent_at
          // set once during a prior idle stretch would permanently suppress all
          // later warnings (it's an IS NULL guard, not a recency check).
          streak_warning_sent_at: null,
        }, { onConflict: 'user_id,group_id' });

      resolved++;
      logger.debug(`[scoreUpdater] Resolved prediction ${prediction.id}: ${finalPoints} pts`);
    } catch (err) {
      logger.error(`[scoreUpdater] Failed to resolve prediction ${prediction.id}:`, err);
    }
  }

  return resolved;
}

// V4 Sprint 28 — "currently live" for tier-promotion purposes. Matches
// AET (extra time just ended, awaiting pens/final confirmation) is included
// deliberately: that transition is exactly when a match needs fast polling
// most, not less.
const CURRENTLY_LIVE_STATUSES = new Set(['1H', 'HT', '2H', 'ET1', 'ET2', 'AET', 'PEN']);

// A league's effective tier for THIS invocation. Live-match promotion is
// checked FIRST and UNCONDITIONALLY — it always wins over base tier,
// including over 'low_frequency'. This is deliberate, not an oversight: a
// low_frequency league (International Friendlies, World Cup Qualifiers) is
// slow-tiered because it's USUALLY dormant, not because a real live match in
// it deserves worse treatment than any other live match. Excluding a live
// low_frequency match from fast polling would mean its score — and every
// prediction riding on it — could sit unresolved for up to ~12h until the
// next daily/noon sync, a real regression from today's uniform 30s polling.
// 'low_frequency' only produces 'tier3' when that league has NO live match
// right now — that's the actual "inactive/off-season" case Tier 3 exists for.
//
// Pure and synchronous — leaguesWithLiveMatch is derived from pendingMatches,
// data ALREADY fetched by getPendingMatches() above. This costs zero extra
// Supabase queries and zero extra ESPN calls.
export function resolveEffectiveTier(leagueId: number, leaguesWithLiveMatch: Set<number>): 'tier1' | 'tier2' | 'tier3' {
  if (leaguesWithLiveMatch.has(leagueId)) return 'tier1';
  const base = getLeagueTier(leagueId);
  if (base === 'low_frequency') return 'tier3';
  return base === 'live_tier1' ? 'tier1' : 'tier2';
}

// V4 Sprint 31 — errors is a purely additive widening of this function's
// return shape: a {scope, message}[] array accumulated at the same catch
// sites that already existed (each already called logger.error() before
// this sprint; this just also records the message for scheduler.ts's new
// sync_run_log telemetry wrapper). No existing caller reads this field, so
// nothing changes for anyone who ignores it — and the function's control
// flow is otherwise completely untouched, per this sprint's own "don't
// restructure a delicate, coin-resolution-critical function" discipline.
export async function checkAndUpdateScores(tierFilter?: 'tier1' | 'tier2'): Promise<{ checked: number; resolved: number; errors: { scope: string; message: string }[] }> {
  const pendingMatches = await getPendingMatches();

  if (pendingMatches.length === 0) {
    logger.debug('[scoreUpdater] No matches pending score update');
    return { checked: 0, resolved: 0, errors: [] };
  }

  logger.info(`[scoreUpdater] Checking ${pendingMatches.length} pending matches`);

  // One tracker for this entire invocation — see the RankTracker doc comment
  // for why this must not be module-level.
  const tracker = newRankTracker();

  // Group by league to minimize API calls
  const byLeague = new Map<number, PendingMatch[]>();
  for (const match of pendingMatches) {
    const list = byLeague.get(match.league_id) || [];
    list.push(match);
    byLeague.set(match.league_id, list);
  }

  // V4 Sprint 28 — tier filtering. `tierFilter` is only ever passed by
  // scheduler.ts's two tiered live-poll intervals; every other call site
  // (the public/internal HTTP sync routes, manualSync/forceSync scripts,
  // the startup catch-up) calls this with no argument and keeps checking
  // every pending league exactly as before this sprint — a resolve-
  // everything-now pathway must never silently skip a league because of its
  // tier. Filtering is applied ONLY to this per-league ESPN-fetch loop, not
  // to the corners re-score / catch-up passes further down — those are pure
  // DB-state sweeps with no ESPN call to save, so tiering them would only
  // delay correctness for zero throughput benefit.
  if (tierFilter) {
    const leaguesWithLiveMatch = new Set(
      pendingMatches.filter(m => CURRENTLY_LIVE_STATUSES.has(m.status)).map(m => m.league_id)
    );
    for (const leagueId of [...byLeague.keys()]) {
      if (resolveEffectiveTier(leagueId, leaguesWithLiveMatch) !== tierFilter) {
        byLeague.delete(leagueId);
      }
    }
    // Deliberately NO early return when byLeague ends up empty here — the
    // corners re-score and catch-up passes further down in this function
    // must still run every tick regardless of tier filtering (they're pure
    // DB-state sweeps, not ESPN calls, so there's nothing to save by
    // skipping them). An empty byLeague just means the per-league loop
    // immediately below iterates zero times, which it already does safely.
  }

  // Honest `checked` count for logging: matches whose league actually stayed
  // in scope this tick, not the full pre-filter pendingMatches.length —
  // otherwise a tiered tick would log e.g. "checked=40" while only having
  // ESPN-queried a handful of leagues. Equals pendingMatches.length exactly
  // when tierFilter is unset (byLeague is untouched in that case).
  const matchesInScope = [...byLeague.values()].reduce((sum, list) => sum + list.length, 0);

  let totalResolved = 0;
  // V4 Sprint 31 — accumulated across the batched per-league loop below the
  // same way totalResolved already is; concurrent Array#push from
  // processBatched's callbacks within one batch is safe for the identical
  // reason totalResolved += already is (synchronous, non-preemptible JS
  // mutations even under async interleaving).
  const errors: { scope: string; message: string }[] = [];

  // V4 Sprint 28 Commit 4 — bounded batching replaces the old unbounded
  // sequential loop here too, same primitive and same reasoning as
  // matchSync.ts's syncAllActiveLeagues(). The loop body below is
  // unchanged verbatim from before this commit — only the loop header/
  // closer changed, from a plain `for...of` to a batched callback — so
  // every existing behavior (HT layer inference, ET/PEN resolution, the
  // RankTracker, totalResolved accumulation via closure) is preserved
  // exactly. `results.push`/`totalResolved +=`-style mutations from
  // concurrent callbacks within one batch are safe: JS array/number
  // mutations are synchronous and non-preemptible even when the
  // surrounding async functions interleave.
  await processBatched([...byLeague.entries()], async ([leagueId, matches]) => {
    // Skip leagues ESPN doesn't cover — those matches won't auto-resolve via API
    if (!(leagueId in LEAGUE_ESPN_MAP)) {
      logger.debug(`[scoreUpdater] League ${leagueId} not in ESPN map, skipping auto-resolve`);
      return;
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

        // Momentum Bets milestone check — before the FT/ET/live branching below,
        // since kickoff/halftime/minute-75 are all "still in progress" moments.
        await generateMilestoneQuestions(match, effectiveData);

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
              league_id: match.league_id,
              league_name: effectiveData.league_name,
              round: match.round,
            }, tracker);
            totalResolved += count;
            logger.info(`[scoreUpdater] Match ${match.id}: ${effectiveData.home_score}-${effectiveData.away_score}, resolved ${count} predictions`);

            // V5 Sprint 36 — Cooperative Pool Engine. Same 90-minute
            // regulation score already computed above; a pool is
            // one-per-(match, group), so this loops per pool once, never
            // per-prediction.
            const poolMatchEndAt = match.kickoff_time
              ? new Date(new Date(match.kickoff_time).getTime() + 105 * 60 * 1000).toISOString()
              : new Date().toISOString();
            const poolResult = await resolvePoolsForMatch(match.id, {
              home_score: effectiveData.regulation_home ?? effectiveData.home_score,
              away_score: effectiveData.regulation_away ?? effectiveData.away_score,
              corners_total: effectiveData.corners_total ?? match.corners_total,
            }, poolMatchEndAt);
            totalResolved += poolResult.resolved;
            errors.push(...poolResult.errors);

            // Post-match AI Scout — generates a witty summary once, then served infinitely
            // from the DB. Silent no-op if Groq isn't configured or the call fails.
            await ensurePostMatchSummary(match.id);
            // Referee-strictness data capture — fire-and-forget, never blocks resolution.
            void captureRefereeName(match.id, match.external_id, match.league_id);
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
                league_id: match.league_id,
                league_name: effectiveData.league_name,
                round: match.round,
              }, tracker);
              if (count > 0) {
                totalResolved += count;
                logger.info(`[scoreUpdater] ET match ${match.id}: resolved ${count} predictions at 90-min score ${regulationHome}-${regulationAway}`);
              }

              // V5 Sprint 36 — pools score off the same locked 90-minute
              // result, at the same moment individual predictions do.
              const etPoolMatchEndAt = match.kickoff_time
                ? new Date(new Date(match.kickoff_time).getTime() + 105 * 60 * 1000).toISOString()
                : new Date().toISOString();
              const etPoolResult = await resolvePoolsForMatch(match.id, {
                home_score: regulationHome,
                away_score: regulationAway!,
                corners_total: match.corners_total,
              }, etPoolMatchEndAt);
              totalResolved += etPoolResult.resolved;
              errors.push(...etPoolResult.errors);
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
      errors.push({ scope: `league:${leagueId}`, message: err instanceof Error ? err.message : String(err) });
    }
  });

  // ── Corners re-score: fix predictions scored before corners_total was set ──
  // corners_total is entered manually after the match. If predictions were already
  // resolved with corners_total = null, they got 0 corners pts. This pass finds
  // those and applies the correct delta (positive only — never subtracts points).
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: cornersMatches } = await supabaseAdmin
      .from('matches')
      .select('id, kickoff_time, home_score, away_score, corners_total, regulation_home, regulation_away, round')
      .eq('status', 'FT')
      .not('corners_total', 'is', null)
      .not('home_score', 'is', null)
      .gte('kickoff_time', sevenDaysAgo);

    for (const m of (cornersMatches ?? []) as { id: string; kickoff_time: string; home_score: number; away_score: number; corners_total: number; regulation_home: number | null; regulation_away: number | null; round: string | null }[]) {
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
          // V6 Sprint 48 — must be threaded through here too, or a
          // knockout match's corners top-up would compute a total that's
          // MISSING the round-depth bonus already baked into the existing
          // points_earned from initial resolution, producing an
          // artificially negative/understated delta and silently
          // dropping a legitimate corners correction (delta <= 0 skip
          // below).
          round: m.round,
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
          errors.push({ scope: `corners_claim:${pred.id}`, message: claimErr.message });
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
          recordPriorPoints(tracker, pred.group_id, pred.user_id, (lbData as { total_points: number }).total_points);
          await supabaseAdmin
            .from('leaderboard')
            .update({
              total_points: (lbData as { total_points: number }).total_points + delta,
              weekly_points: (lbData as { weekly_points: number }).weekly_points + delta,
            })
            .eq('user_id', pred.user_id)
            .eq('group_id', pred.group_id);
        }

        // V6 Sprint 47 — the same copy-betting royalty split applies to a
        // corners re-score top-up as to the initial resolution above: a
        // copied prediction's win still owes the root creator 5%, even
        // when the extra points arrive later via this correction pass.
        // Skipping this path would leave a real inconsistency — the same
        // prediction's INITIAL resolution pays a royalty but a LATER
        // corners correction on it silently wouldn't.
        const grossDeltaCoins = delta * 2;
        const cornersRoyalty = pred.copied_from_user_id ? Math.floor(grossDeltaCoins * 0.05) : 0;
        const coinsToAward = grossDeltaCoins - cornersRoyalty;
        const cornersRoyaltyMarker = cornersRoyalty > 0 ? ` (🔁 -${cornersRoyalty} royalty)` : '';
        const cornersMatchEndAt = new Date(new Date(m.kickoff_time).getTime() + 105 * 60 * 1000).toISOString();
        const { error: coinError } = await supabaseAdmin.rpc('increment_coins', {
          p_user_id: pred.user_id,
          p_group_id: pred.group_id,
          p_match_id: m.id,
          p_amount: coinsToAward,
          p_description: `Corners re-score: +${delta} pts${cornersRoyaltyMarker} → +${coinsToAward} coins`,
          p_created_at: cornersMatchEndAt,
        });
        if (coinError) {
          const msg = coinError.message ?? JSON.stringify(coinError);
          logger.error(`[scoreUpdater] Corners re-score coin award failed for ${pred.id}: ${msg}`);
          errors.push({ scope: `corners_coin_award:${pred.id}`, message: msg });
        } else {
          logger.info(`[scoreUpdater] Corners re-score awarded ${coinsToAward} coins to user ${pred.user_id}`);
        }

        if (!coinError && cornersRoyalty > 0 && pred.copied_from_user_id) {
          const { error: cornersRoyaltyError } = await supabaseAdmin.rpc('increment_coins', {
            p_user_id: pred.copied_from_user_id,
            p_group_id: pred.group_id,
            p_match_id: m.id,
            p_amount: cornersRoyalty,
            p_description: `Royalty tip: your copied pick's corners re-score won → +${cornersRoyalty} coins`,
            p_created_at: cornersMatchEndAt,
          });
          if (cornersRoyaltyError) {
            const msg = cornersRoyaltyError.message ?? JSON.stringify(cornersRoyaltyError);
            logger.error(`[scoreUpdater] Corners re-score royalty failed for creator=${pred.copied_from_user_id}: ${msg}`);
            errors.push({ scope: `corners_royalty:${pred.id}`, message: msg });
          }
        }
        totalResolved++;
      }
    }
  } catch (err) {
    logger.error('[scoreUpdater] Corners re-score error:', err);
    errors.push({ scope: 'corners_rescore_pass', message: err instanceof Error ? err.message : String(err) });
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
        .select('id, kickoff_time, home_score, away_score, corners_total, regulation_home, regulation_away, home_team, away_team, league_id, league_name, round')
        .eq('status', 'FT')
        .not('home_score', 'is', null)
        .in('id', stuckMatchIds);

      for (const m of (ftStuck ?? []) as { id: string; kickoff_time: string; home_score: number; away_score: number; corners_total: number | null; regulation_home: number | null; regulation_away: number | null; home_team: string; away_team: string; league_id: number; league_name: string | null; round: string | null }[]) {
        const count = await resolveMatchPredictions(m.id, {
          home_score: m.home_score,
          away_score: m.away_score,
          corners_total: m.corners_total,
          regulation_home: m.regulation_home,
          regulation_away: m.regulation_away,
          home_team: m.home_team,
          away_team: m.away_team,
          kickoff_time: m.kickoff_time,
          round: m.round,
          league_id: m.league_id,
          league_name: m.league_name,
        }, tracker);
        if (count > 0) {
          totalResolved += count;
          logger.info(`[scoreUpdater] Catch-up resolved ${count} stuck predictions for FT match ${m.id}`);
        }

        // V5 Sprint 36 — a pool stuck behind the same catch-up condition
        // (a prior resolution attempt failed) gets swept here too.
        const catchupPoolMatchEndAt = m.kickoff_time
          ? new Date(new Date(m.kickoff_time).getTime() + 105 * 60 * 1000).toISOString()
          : new Date().toISOString();
        const catchupPoolResult = await resolvePoolsForMatch(m.id, {
          home_score: m.regulation_home ?? m.home_score,
          away_score: m.regulation_away ?? m.away_score,
          corners_total: m.corners_total,
        }, catchupPoolMatchEndAt);
        totalResolved += catchupPoolResult.resolved;
        errors.push(...catchupPoolResult.errors);
      }
    }
  } catch (err) {
    logger.error('[scoreUpdater] Catch-up resolution error:', err);
    errors.push({ scope: 'catchup_pass', message: err instanceof Error ? err.message : String(err) });
  }

  await flushRankDropNotifications(tracker);

  return { checked: matchesInScope, resolved: totalResolved, errors };
}

// ── Rank-drop notification flush (V4 Sprint 11) ──────────────────────────────
// Runs ONCE at the end of the whole checkAndUpdateScores() invocation — after
// every match/loop in this tick has finished writing — so a user whose rank
// shuffled multiple times in one run (e.g. two of their group's matches both
// resolved in the same tick) gets exactly one notification showing the net
// movement, never one per write.
async function flushRankDropNotifications(tracker: RankTracker): Promise<void> {
  for (const groupId of tracker.touchedGroups) {
    try {
      const { data: rows } = await supabaseAdmin
        .from('leaderboard')
        .select('user_id, total_points')
        .eq('group_id', groupId);

      if (!rows || rows.length < 2) continue; // rank is meaningless with <2 members

      const priorMap = tracker.priorPoints.get(groupId) ?? new Map<string, number>();

      // "After" — current, authoritative state (reflects everything this run wrote).
      const afterSorted = [...rows].sort((a, b) => b.total_points - a.total_points);
      const afterRank = new Map<string, number>();
      afterSorted.forEach((r, i) => afterRank.set(r.user_id, i + 1));

      // "Before" — reconstruct by substituting each touched user's captured
      // pre-run total back in; untouched users keep their current value for
      // both snapshots since they didn't change this run.
      // Known accepted edge case: if a DIFFERENT concurrent worker updates an
      // untouched user in this same group between this worker's captures and
      // this flush, that user's "before" position uses their post-concurrent-
      // update value rather than a true pre-run snapshot. Worst case is a
      // slightly-off old-rank number in a notification body, never a duplicate
      // or incorrect coin/points effect — accepted rather than adding a
      // dedicated snapshot table for a cosmetic-only, rare race.
      const beforeRows = rows.map(r => ({
        user_id: r.user_id,
        total_points: priorMap.has(r.user_id) ? priorMap.get(r.user_id)! : r.total_points,
      }));
      const beforeSorted = [...beforeRows].sort((a, b) => b.total_points - a.total_points);
      const beforeRank = new Map<string, number>();
      beforeSorted.forEach((r, i) => beforeRank.set(r.user_id, i + 1));

      for (const userId of priorMap.keys()) {
        const before = beforeRank.get(userId);
        const after = afterRank.get(userId);
        if (before == null || after == null || after <= before) continue; // no drop

        const overtaker = afterSorted[before - 1]; // whoever now sits at this user's old rank
        if (!overtaker || overtaker.user_id === userId) continue;

        // V4 Sprint 24 — gender selects alongside username so the frontend's
        // tg() can render "עקף"/"עקפה" correctly instead of defaulting.
        const { data: overtakerProfile } = await supabaseAdmin
          .from('profiles')
          .select('username, gender')
          .eq('id', overtaker.user_id)
          .single();

        const { error: notifError } = await supabaseAdmin.from('notifications').insert({
          user_id: userId,
          group_id: groupId,
          type: 'rank_drop',
          title_key: 'notifRankDrop',
          body_key: 'notifRankDropBody',
          metadata: {
            old_rank: before,
            new_rank: after,
            overtaker_username: overtakerProfile?.username ?? null,
            overtaker_gender: overtakerProfile?.gender ?? 'unspecified',
          },
        });
        if (notifError) {
          logger.warn(`[scoreUpdater] rank_drop notification insert failed: ${notifError.message}`);
        } else {
          logger.info(`[scoreUpdater] Rank drop: user ${userId} #${before}->#${after} in group ${groupId}`);
        }

        // Push is best-effort — no-op if VAPID unset or the user has no
        // subscriptions. English-only, matching the existing match-reminder
        // push (no per-user language preference exists to localize against yet).
        const overtakerName = overtakerProfile?.username ?? 'Someone';
        void sendPushToUser(userId, {
          title: 'GoalBet ⚽',
          body: `${overtakerName} just overtook you — you're now #${after} in the group!`,
          url: '/leaderboard',
          tag: `rank-drop-${groupId}`,
        });
      }
    } catch (err) {
      logger.warn(`[scoreUpdater] Rank-drop flush failed for group ${groupId}: ${(err as Error).message}`);
    }
  }
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
