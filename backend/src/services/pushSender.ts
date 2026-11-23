import webpush from 'web-push';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { logger } from '../lib/logger';

const WEEKLY_PUSH_LIMIT = 15;

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

interface Subscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send a payload to a list of subscriptions, pruning dead ones (404/410) as
 * they're discovered. Shared by sendMatchReminders and sendPushToUser so the
 * send+prune logic exists in exactly one place.
 */
async function sendToSubscriptions(subs: Subscription[], payload: string): Promise<number> {
  let sent = 0;
  const seen = new Set<string>();
  for (const s of subs) {
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
        await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      } else {
        logger.warn(`[push] send failed (${code}): ${(err as Error).message}`);
      }
    }
  }
  return sent;
}

/**
 * Send a push to every subscription a single user has (multiple devices).
 * No-op (returns 0) if VAPID isn't configured or the user has no subscriptions.
 * Used by scoreUpdater's rank-drop notifications (V4 Sprint 11).
 */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<number> {
  if (!ensureVapid()) return 0;

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (!subs || subs.length === 0) return 0;

  return sendToSubscriptions(subs as Subscription[], JSON.stringify(payload));
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

      sent += await sendToSubscriptions((subs ?? []) as Subscription[], payload);

      await stampReminder(m.id);
    } catch (err) {
      logger.warn(`[push] reminder for match ${m.id} failed: ${(err as Error).message}`);
    }
  }

  if (sent > 0) logger.info(`[push] sent ${sent} match reminder(s)`);
  return sent;
}

/**
 * Match-of-the-week push — new engagement feature. One push per group per
 * week, to every opted-in member, naming the single standout upcoming
 * fixture in that group's active leagues this week.
 *
 * Selection is deliberately NOT a 1:1 port of HomePage.tsx's own Hero
 * Matchday Spotlight logic (§65's `heroMatch`) — that selection is
 * genuinely frontend-bound: "a live match the CURRENT user has predicted
 * on" and "within the next 2 hours of right now" are both concepts with no
 * honest meaning for a once-a-week backend sweep picking ONE match for an
 * entire group days in advance. The honest backend-appropriate substitute
 * used here: the earliest-kickoff NS fixture this week, across the
 * group's own active_leagues — the same `groups.active_leagues` field and
 * "earliest upcoming fixture" ordering aiCommissioner.ts's own fixture
 * list already uses (one real precedent reused, not a second invented
 * heuristic).
 *
 * Dedup: `groups.match_of_week_pushed_at` (migration 073 — NOT YET APPLIED,
 * needs the user's own manual Supabase SQL Editor confirmation per this
 * engagement's standing rule). Compared against `arena_current_week_start()`
 * (migration 066), the same DST-safe week-boundary source every other
 * weekly sweep in this codebase already shares (§28/§63/§69) — never an
 * independently-computed JS week boundary. If the column doesn't exist yet
 * (migration pending), the dedup check's own query error is caught and
 * logged as a warning, and the function returns 0 rather than throwing —
 * this is why this feature can ship and be scheduled today without
 * breaking anything the moment it's wired in, even before the migration
 * lands.
 *
 * English-only copy, matching the existing match-reminder push precedent
 * (§27) — re-confirmed this sprint that `profiles` still has no `lang`
 * column to localize against (only `username`/`avatar_url`/`gender`/
 * `arena_division`/`unlocked_cosmetics` exist), so this isn't a stale
 * assumption carried forward uncritically.
 */
export async function sendMatchOfTheWeekPush(): Promise<number> {
  if (!ensureVapid()) return 0;

  const { data: weekStartRaw, error: weekErr } = await supabaseAdmin.rpc('arena_current_week_start');
  if (weekErr || !weekStartRaw) {
    logger.warn(`[push] match-of-week: arena_current_week_start() failed: ${weekErr?.message ?? 'no data'}`);
    return 0;
  }
  const weekStart = String(weekStartRaw);

  const { data: groups, error: groupsErr } = await supabaseAdmin
    .from('groups')
    .select('id, active_leagues, match_of_week_pushed_at')
    .limit(WEEKLY_PUSH_LIMIT * 4); // over-fetch; most will already be pushed this week

  if (groupsErr) {
    // Covers both a genuine query failure AND the pre-migration-073 case
    // where the column doesn't exist yet — either way, degrade silently.
    logger.warn(`[push] match-of-week: groups query failed: ${groupsErr.message}`);
    return 0;
  }
  if (!groups || groups.length === 0) return 0;

  let sent = 0;
  let pushed = 0;
  for (const g of groups) {
    if (pushed >= WEEKLY_PUSH_LIMIT) break;
    const lastPushed = (g as { match_of_week_pushed_at?: string | null }).match_of_week_pushed_at;
    if (lastPushed && lastPushed >= weekStart) continue; // already pushed this week

    const activeLeagues: number[] = g.active_leagues ?? [];
    if (activeLeagues.length === 0) continue;

    try {
      const { data: matches } = await supabaseAdmin
        .from('matches')
        .select('id, home_team, away_team, kickoff_time')
        .in('league_id', activeLeagues)
        .eq('status', 'NS')
        .gte('kickoff_time', new Date().toISOString())
        .order('kickoff_time', { ascending: true })
        .limit(1);

      const match = matches?.[0];
      if (!match) continue; // nothing upcoming this week — skip, don't fabricate

      const { data: members } = await supabaseAdmin
        .from('group_members')
        .select('user_id')
        .eq('group_id', g.id);
      const userIds = [...new Set((members ?? []).map(x => x.user_id))];
      if (userIds.length === 0) { pushed++; continue; }

      const { data: subs } = await supabaseAdmin
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .in('user_id', userIds);

      const payload = JSON.stringify({
        title: 'Match of the Week ⭐',
        body: `${match.home_team} vs ${match.away_team} — don't miss it. Lock in your prediction now.`,
        url: '/',
        tag: `motw-${g.id}-${weekStart}`,
      });

      sent += await sendToSubscriptions((subs ?? []) as Subscription[], payload);

      await supabaseAdmin
        .from('groups')
        .update({ match_of_week_pushed_at: new Date().toISOString() })
        .eq('id', g.id);
      pushed++;
    } catch (err) {
      logger.warn(`[push] match-of-week for group ${g.id} failed: ${(err as Error).message}`);
    }
  }

  if (sent > 0) logger.info(`[push] sent ${sent} match-of-the-week push(es) across ${pushed} group(s)`);
  return sent;
}
