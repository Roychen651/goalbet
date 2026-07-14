import webpush from 'web-push';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { logger } from '../lib/logger';

// Configure VAPID once from Render env vars. If unset, the whole sender is a
// silent no-op — the feature simply doesn't fire until keys are provisioned.
let vapidReady = false;
function ensureVapid(): boolean {
  if (vapidReady) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:hello@goalbet.app';
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  vapidReady = true;
  return true;
}

async function stampReminder(matchId: string): Promise<void> {
  await supabaseAdmin
    .from('matches')
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq('id', matchId);
}

/**
 * Send "kicks off in 15 min" reminders. Audience = ALL opted-in members of any
 * group where the match's league is active (drives DAU, not just re-engaging
 * users who already predicted). Each match reminded exactly once via
 * matches.reminder_sent_at. Safe to call every couple of minutes.
 */
export async function sendMatchReminders(): Promise<number> {
  if (!ensureVapid()) return 0;

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const windowEnd = new Date(now + 15 * 60 * 1000).toISOString();

  const { data: matches, error } = await supabaseAdmin
    .from('matches')
    .select('id, league_id, home_team, away_team')
    .eq('status', 'NS')
    .gte('kickoff_time', nowIso)
    .lte('kickoff_time', windowEnd)
    .is('reminder_sent_at', null);

  if (error) {
    logger.warn(`[push] reminder query failed: ${error.message}`);
    return 0;
  }
  if (!matches || matches.length === 0) return 0;

  let sent = 0;
  for (const m of matches) {
    try {
      // Groups where this league is active → their members → push subscriptions.
      const { data: groups } = await supabaseAdmin
        .from('groups')
        .select('id')
        .contains('active_leagues', [m.league_id]);
      const groupIds = (groups ?? []).map(g => g.id);
      if (groupIds.length === 0) { await stampReminder(m.id); continue; }

      const { data: members } = await supabaseAdmin
        .from('group_members')
        .select('user_id')
        .in('group_id', groupIds);
      const userIds = [...new Set((members ?? []).map(x => x.user_id))];
      if (userIds.length === 0) { await stampReminder(m.id); continue; }

      const { data: subs } = await supabaseAdmin
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .in('user_id', userIds);

      const payload = JSON.stringify({
        title: 'GoalBet ⚽',
        body: `${m.home_team} vs ${m.away_team} kicks off in 15 mins! Lock in your prediction now.`,
        url: '/',
        tag: `match-${m.id}`,
      });

      const seen = new Set<string>();
      for (const s of subs ?? []) {
        if (seen.has(s.endpoint)) continue;
        seen.add(s.endpoint);
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          sent++;
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            // Subscription is dead — prune it.
            await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
          } else {
            logger.warn(`[push] send failed (${code}): ${(err as Error).message}`);
          }
        }
      }

      await stampReminder(m.id);
    } catch (err) {
      logger.warn(`[push] reminder for match ${m.id} failed: ${(err as Error).message}`);
    }
  }

  if (sent > 0) logger.info(`[push] sent ${sent} match reminder(s)`);
  return sent;
}
