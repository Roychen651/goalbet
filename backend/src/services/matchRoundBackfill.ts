/**
 * Retroactive matches.round backfill — V7 Sprint 57, automated same-day
 * follow-up.
 *
 * `round` was hardcoded null on every match upsert for this codebase's
 * entire lifetime until Sprint 48 (§63) added extractRoundName() to the
 * live scoreboard sync path. A match that was already synced (and
 * completed) before that fix landed has round=null frozen forever — the
 * regular sync jobs only ever touch a narrow recent/upcoming date window,
 * never revisit an old FT match. This left every completed knockout-stage
 * match from before Sprint 48 unable to be classified by
 * classifyBracketStage() on the frontend — reported live: Champions
 * League's already-finished 2025/26 knockout stage showed "no knockout
 * data" in the bracket view.
 *
 * The original fix (backfillMatchRounds.ts) shipped as a manual, one-time
 * CLI script — `npm run backfill:match-rounds`. That was a real mistake,
 * not just an incomplete rollout: a fix that requires a human to SSH in
 * (or run a local script against prod credentials) after every deploy is
 * not actually fixed from the product's perspective, and it shipped to
 * production with that step never performed. Extracted here into a plain
 * exported function specifically so `scheduler.ts` can call it
 * automatically — the same "service function + thin CLI wrapper" shape
 * already used throughout this backend (matchSync.ts/manualSync.ts,
 * seasonArchive.ts/its own startup call). No operator action required for
 * this to actually take effect once deployed.
 *
 * Idempotent AND self-limiting on a recurring schedule — the property that
 * makes automatic invocation actually safe, not just convenient. A
 * genuinely-unavailable round (ESPN's summary endpoint has no headline for
 * that old event) is now written back as an empty string '', NOT left
 * null — this is the load-bearing change versus the original one-shot
 * script. `.is('round', null)` only ever matches rows that haven't been
 * attempted yet; a permanently-unavailable row becomes '' after its first
 * attempt and is never re-fetched on a later scheduled run, so this can
 * run daily forever without repeatedly hammering ESPN for matches that
 * will never resolve. Every consumer of `matches.round` already treats it
 * as falsy-checked (`match.round && ...` / `match.round ?? null` /
 * `match.round ? ... : ''`), confirmed by grepping every real call site
 * before making this change — '' behaves identically to null everywhere
 * it's read.
 *
 * One path, not two — unlike backfillTeamStats.ts's Path A/B split, there
 * is no DB-to-DB shortcut here: round was never captured anywhere before
 * Sprint 48, so every match needing this backfill requires a live
 * re-fetch. Batched via the same processBatched() primitive Sprint 28
 * built for exactly this kind of bulk historical operation.
 *
 * Whether ESPN's summary endpoint retains a round/headline for matches
 * this old is UNVERIFIED (this sandbox cannot reach ESPN — confirmed via
 * the agent proxy's own status endpoint reporting an explicit 403 policy
 * denial on every ESPN-family host, not a flaky timeout) — every match's
 * real outcome is recorded and reported, never assumed.
 */
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { fetchMatchRoundFromSummary } from './espn';
import { processBatched } from '../lib/batch';
import { logger } from '../lib/logger';

interface BackfillMatch {
  id: string;
  external_id: string;
  league_id: number;
}

export interface BackfillOutcome {
  scanned: number;
  found: number;
  markedUnavailable: number;
}

// Completed matches only — a match still NS/live has no "round" story to
// tell yet in the sense this backfill cares about (the live sync path
// already captures round for anything synced going forward, completed or
// not; this exists purely to repair the pre-Sprint-48 gap).
async function getMatchesNeedingBackfill(since: string): Promise<BackfillMatch[]> {
  const { data: matches, error } = await supabaseAdmin
    .from('matches')
    .select('id, external_id, league_id')
    .in('status', ['FT', 'AET', 'PEN'])
    .is('round', null)
    .gte('kickoff_time', since);

  if (error) {
    logger.error(`[matchRoundBackfill] Failed to fetch matches: ${error.message}`);
    return [];
  }
  return (matches as BackfillMatch[]) ?? [];
}

export async function backfillMatchRounds(sinceISODate: string): Promise<BackfillOutcome> {
  const matches = await getMatchesNeedingBackfill(sinceISODate);
  const outcome: BackfillOutcome = { scanned: matches.length, found: 0, markedUnavailable: 0 };
  if (matches.length === 0) return outcome;

  await processBatched(matches, async (m) => {
    const round = await fetchMatchRoundFromSummary(m.external_id, m.league_id);
    const writeValue = round ?? ''; // '' = genuinely checked, unavailable — never re-attempted
    if (round) outcome.found++;
    else outcome.markedUnavailable++;

    const { error } = await supabaseAdmin
      .from('matches')
      .update({ round: writeValue })
      .eq('id', m.id);
    if (error) {
      logger.error(`[matchRoundBackfill] Update failed for match ${m.id}: ${error.message}`);
    }
  });

  return outcome;
}
