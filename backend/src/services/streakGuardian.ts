/**
 * streakGuardian — day-6 streak-expiry push warning (V4 Sprint 12).
 *
 * decay_idle_streaks() (migration 041, pg_cron) zeroes current_streak after 7
 * days with no prediction in a group — pure SQL, runs even while Render
 * sleeps. This file owns the ONE piece that can't live in pg_cron: the actual
 * push send, which needs the web-push client (pushSender.ts). Reuses
 * sendPushToUser() rather than building a second push path.
 *
 * Candidate volume is small (only users with an active streak, a subset of a
 * subset), so this queries per-candidate rather than adding a bespoke
 * aggregate SQL function for it — consistent with aiProvocateur.ts's approach
 * to similarly small batch jobs.
 */
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { logger } from '../lib/logger';
import { sendPushToUser } from './pushSender';

const WARNING_WINDOW_MIN_DAYS = 6;
const WARNING_WINDOW_MAX_DAYS = 7;

export async function sendStreakExpiryWarnings(): Promise<number> {
  const { data: candidates, error } = await supabaseAdmin
    .from('leaderboard')
    .select('user_id, group_id, current_streak')
    .gt('current_streak', 0)
    .is('streak_warning_sent_at', null);

  if (error) {
    logger.warn(`[streakGuardian] candidate query failed: ${error.message}`);
    return 0;
  }
  if (!candidates || candidates.length === 0) return 0;

  const now = Date.now();
  const minMs = WARNING_WINDOW_MIN_DAYS * 24 * 60 * 60 * 1000;
  const maxMs = WARNING_WINDOW_MAX_DAYS * 24 * 60 * 60 * 1000;

  let warned = 0;
  for (const c of candidates) {
    try {
      const { data: lastPred } = await supabaseAdmin
        .from('predictions')
        .select('created_at')
        .eq('user_id', c.user_id)
        .eq('group_id', c.group_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastPred) continue; // no prediction ever — decay handles this, not a warning case

      const idleMs = now - new Date(lastPred.created_at).getTime();
      if (idleMs < minMs || idleMs >= maxMs) continue; // not in the day-6 window

      const sent = await sendPushToUser(c.user_id, {
        title: 'GoalBet 🔥',
        body: `Your 🔥 streak of ${c.current_streak} is about to expire! Place a prediction now to save it.`,
        url: '/',
        tag: `streak-warning-${c.group_id}`,
      });

      // Stamp the guard regardless of whether a push was actually delivered
      // (no VAPID key / no subscriptions = 0 sent) — this is a once-per-idle-
      // cycle warning slot, not a delivery receipt. Retrying every 15 minutes
      // for a user with push disabled would be pointless churn.
      await supabaseAdmin
        .from('leaderboard')
        .update({ streak_warning_sent_at: new Date().toISOString() })
        .eq('user_id', c.user_id)
        .eq('group_id', c.group_id);

      if (sent > 0) warned++;
    } catch (err) {
      logger.warn(`[streakGuardian] candidate ${c.user_id}/${c.group_id} failed: ${(err as Error).message}`);
    }
  }

  if (warned > 0) logger.info(`[streakGuardian] Sent ${warned} streak-expiry warning(s)`);
  return warned;
}
