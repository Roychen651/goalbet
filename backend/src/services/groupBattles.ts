// V5 Sprint 36 — "The Social Syndicate" — Group Battles.
//
// Thin scheduler-facing wrapper around compute_battle_scores() (migration
// 056's SQL function does the actual set-based top-5 aggregation), same
// shape as leagueStatCapability.ts's refreshCornersSupportFlags() and every
// other cron-invoked service in this codebase — logs and returns on
// failure, never throws.
//
// Scores are refreshed on a schedule (backend/src/cron/scheduler.ts, every
// 30 min — battles run over hours/days, not seconds, matching the exact
// "off the tighter cadences used for coin/score correctness" reasoning
// already established for sendStreakExpiryWarnings), never live per
// Realtime event — consistent with Sprint 35's deliberate deferral of
// live `predictions` broadcasting (CLAUDE.md §50).

import { supabaseAdmin } from '../lib/supabaseAdmin';
import { logger } from '../lib/logger';

interface ActiveBattle {
  id: string;
  challenger_group_id: string;
  defender_group_id: string;
  end_time: string;
}

export async function refreshActiveBattleScores(): Promise<void> {
  const { data: battles, error } = await supabaseAdmin
    .from('group_battles')
    .select('id, challenger_group_id, defender_group_id, end_time')
    .eq('status', 'active');

  if (error) {
    logger.warn(`[groupBattles] Failed to fetch active battles: ${error.message}`);
    return;
  }
  if (!battles || battles.length === 0) return;

  for (const battle of battles as ActiveBattle[]) {
    try {
      const { data, error: rpcError } = await supabaseAdmin.rpc('compute_battle_scores', {
        p_battle_id: battle.id,
      });
      if (rpcError) {
        logger.warn(`[groupBattles] compute_battle_scores failed for battle ${battle.id}: ${rpcError.message}`);
        continue;
      }

      const result = data as { challenger_score?: number; defender_score?: number; is_final?: boolean } | null;
      if (!result?.is_final) continue;

      // Battle just closed this tick — post the 'final' milestone for both
      // sides. The dedup index (group_events_battle_progress_unique,
      // migration 056) protects against a concurrent scheduler tick
      // double-posting if this ever runs from more than one worker.
      for (const groupId of [battle.challenger_group_id, battle.defender_group_id]) {
        const { error: evtError } = await supabaseAdmin.from('group_events').insert({
          group_id: groupId,
          user_id: null,
          event_type: 'BATTLE_PROGRESS',
          metadata: {
            battle_id: battle.id,
            milestone: 'final',
            challenger_score: result.challenger_score,
            defender_score: result.defender_score,
            challenger_group_id: battle.challenger_group_id,
            defender_group_id: battle.defender_group_id,
          },
        });
        // A duplicate-key error here just means another worker already
        // posted this exact milestone — the dedup index doing its job, not
        // a real failure.
        if (evtError && !evtError.message.toLowerCase().includes('duplicate')) {
          logger.warn(`[groupBattles] BATTLE_PROGRESS insert failed for group ${groupId}: ${evtError.message}`);
        }
      }

      logger.info(`[groupBattles] Battle ${battle.id} completed: challenger=${result.challenger_score} defender=${result.defender_score}`);
    } catch (err) {
      logger.error(`[groupBattles] Unexpected error refreshing battle ${battle.id}:`, err);
    }
  }
}
