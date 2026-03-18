import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Prediction, Match } from './supabase';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKickoffTime(kickoffTime: string): {
  date: string;
  time: string;
  relative: string;
  countdown: string | null;
  lockCountdown: string | null;
} {
  const kickoff = new Date(kickoffTime);
  const now = new Date();
  const diffMs = kickoff.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const date = kickoff.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const time = kickoff.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  let relative = '';
  let countdown: string | null = null;

  if (diffMs < 0) {
    relative = 'Started';
  } else if (diffDays > 1) {
    relative = `In ${diffDays} days`;
  } else if (diffDays === 1) {
    relative = 'Tomorrow';
  } else if (diffHours >= 1) {
    relative = `In ${diffHours}h ${diffMins % 60}m`;
    countdown = `${diffHours}h ${diffMins % 60}m`;
  } else if (diffMins > 0) {
    relative = `In ${diffMins}m`;
    countdown = `${diffMins}m`;
  } else {
    relative = 'Starting now';
    countdown = 'Now';
  }

  // Lock countdown = time until 15 min before kickoff
  const lockAt = kickoff.getTime() - 15 * 60 * 1000;
  const lockDiffMs = lockAt - now.getTime();
  let lockCountdown: string | null = null;
  if (lockDiffMs > 0) {
    const lockMins = Math.ceil(lockDiffMs / 60000);
    const lockHours = Math.floor(lockMins / 60);
    const lockDays = Math.floor(lockHours / 24);
    const remainHours = lockHours % 24;
    if (lockDays >= 1) {
      lockCountdown = remainHours > 0 ? `${lockDays}d ${remainHours}h` : `${lockDays}d`;
    } else if (lockHours >= 1) {
      lockCountdown = `${lockHours}h ${lockMins % 60}m`;
    } else {
      lockCountdown = `${lockMins}m`;
    }
  }

  return { date, time, relative, countdown, lockCountdown };
}

// Return a live clock label for a match in progress.
// Uses DB display_clock when available, otherwise estimates from kickoff time.
export function getLiveClock(match: { status: string; kickoff_time: string; display_clock?: string | null }): string | null {
  if (match.status === 'HT') return 'HT';
  if (match.status === 'FT') return null;
  if (match.status === 'NS') {
    // stalled NS past kickoff — estimate
    const minsSinceKickoff = Math.floor((Date.now() - new Date(match.kickoff_time).getTime()) / 60000);
    if (minsSinceKickoff < 0) return null;
    return `~${Math.min(minsSinceKickoff, 90)}'`;
  }
  // DB clock from ESPN (if column migrated)
  if (match.display_clock) return match.display_clock;

  // For 1H we can estimate reliably: started at kickoff, capped at 45+' for stoppage
  if (match.status === '1H') {
    const minsSince = Math.floor((Date.now() - new Date(match.kickoff_time).getTime()) / 60000);
    if (minsSince > 45) return "45+'"; // in stoppage time
    return `${minsSince}'`;
  }
  // For 2H we cannot estimate accurately — HT break length varies (15-25 min)
  // Show period label until ESPN display_clock is available
  if (match.status === '2H') return '2H';
  return null;
}

// Lock predictions 15 minutes before kickoff
export function isMatchLocked(kickoffTime: string): boolean {
  const lockAt = new Date(kickoffTime).getTime() - 15 * 60 * 1000;
  return Date.now() >= lockAt;
}

export function formatPoints(points: number): string {
  if (points === 1) return '1 pt';
  return `${points} pts`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function formatAccuracy(correct: number, total: number): string {
  if (total === 0) return '—';
  return `${Math.round((correct / total) * 100)}%`;
}

// ─── Points breakdown (mirrors backend pointsEngine.ts) ───────────────────
export interface TierResult {
  key: string;
  label: string;
  pts: number;
  earned: boolean;
  /** True when the outcome is not yet knowable (e.g. HT score missing during 2H) */
  pending?: boolean;
}

// Live breakdown — same logic but works for in-progress matches using current score.
// Returns null if match has no score data yet.
export function calcLiveBreakdown(prediction: Prediction, match: Match): TierResult[] | null {
  if (match.home_score === null || match.away_score === null) return null;
  if (!['1H', 'HT', '2H', 'NS'].includes(match.status)) return null;

  // For 1H: current score is the provisional HT score.
  // For HT: current score IS the actual halftime score (home_score = halftime_home right now).
  //   Use home_score because halftime_home may not yet be written to DB (30s poll lag).
  // For 2H: halftime_home/away from DB (populated once 1H ended).
  //   Fallback: if DB halftime is null AND current score is 0-0, HT must have been 0-0
  //   (no goals in either half → both halves still 0-0).
  let effectiveHtHome = (match.status === '1H' || match.status === 'HT') ? match.home_score : match.halftime_home;
  let effectiveHtAway = (match.status === '1H' || match.status === 'HT') ? match.away_score : match.halftime_away;

  if (match.status === '2H' && effectiveHtHome === null && match.home_score === 0 && match.away_score === 0) {
    effectiveHtHome = 0;
    effectiveHtAway = 0;
  }

  // If we're in 2H and still don't know the HT score, mark HT tier as pending (not wrong)
  const htPending = match.status === '2H' && effectiveHtHome === null;

  // corners_total is only known after FT — always null during live
  return _computeBreakdown(prediction, match.home_score, match.away_score, effectiveHtHome, effectiveHtAway, null, htPending);
}

export function calcBreakdown(prediction: Prediction, match: Match): TierResult[] | null {
  if (match.home_score === null || match.away_score === null || match.status !== 'FT') return null;
  const result = _computeBreakdown(
    prediction, match.home_score, match.away_score,
    match.halftime_home, match.halftime_away,
    match.corners_total ?? null,
  );

  // If halftime_pts_earned is stored (non-null = prediction scored before HT removal),
  // override the HT tier's earned flag with the resolution-time value.
  if (prediction.halftime_pts_earned !== null && prediction.halftime_pts_earned !== undefined) {
    const htIdx = result.findIndex(r => r.key === 'ht');
    if (htIdx !== -1) {
      result[htIdx] = { ...result[htIdx], earned: prediction.halftime_pts_earned > 0 };
    }
  }

  return result;
}

function _computeBreakdown(
  prediction: Prediction,
  homeScore: number,
  awayScore: number,
  htHome: number | null,
  htAway: number | null,
  cornersTotal: number | null = null,
  htPending = false,
): TierResult[] {
  const actualOutcome = homeScore > awayScore ? 'H' : homeScore < awayScore ? 'A' : 'D';
  const totalGoals = homeScore + awayScore;
  const actualBTTS = homeScore > 0 && awayScore > 0;

  const exactScoreCorrect =
    prediction.predicted_home_score !== null &&
    prediction.predicted_away_score !== null &&
    prediction.predicted_home_score === homeScore &&
    prediction.predicted_away_score === awayScore;

  const results: TierResult[] = [];

  if (prediction.predicted_outcome !== null) {
    const impliedOutcomeFromScore = exactScoreCorrect && prediction.predicted_outcome === actualOutcome;
    const earned = prediction.predicted_outcome === actualOutcome || (exactScoreCorrect && impliedOutcomeFromScore);
    results.push({ key: 'result', label: 'Result', pts: 3, earned });
  }

  if (prediction.predicted_outcome === null && exactScoreCorrect) {
    results.push({ key: 'result', label: 'Result (implied)', pts: 3, earned: true });
  }

  if (prediction.predicted_home_score !== null && prediction.predicted_away_score !== null) {
    results.push({ key: 'score', label: 'Exact Score', pts: 7, earned: exactScoreCorrect });
  }

  // Old predictions may have a halftime outcome — keep displaying it for history
  if (prediction.predicted_halftime_outcome !== null) {
    if (htPending) {
      results.push({ key: 'ht', label: 'Half Time', pts: 4, earned: false, pending: true });
    } else {
      let earned = false;
      if (htHome !== null && htAway !== null) {
        const actualHT = htHome > htAway ? 'H' : htHome < htAway ? 'A' : 'D';
        earned = prediction.predicted_halftime_outcome === actualHT;
      }
      results.push({ key: 'ht', label: 'Half Time', pts: 4, earned });
    }
  }

  // Corners: ≤9 / exactly 10 / ≥11
  if (prediction.predicted_corners !== null) {
    if (cornersTotal === null) {
      results.push({ key: 'corners', label: 'Corners', pts: 4, earned: false, pending: true });
    } else {
      const bucket: 'under9' | 'ten' | 'over11' =
        cornersTotal <= 9 ? 'under9' : cornersTotal === 10 ? 'ten' : 'over11';
      results.push({ key: 'corners', label: 'Corners', pts: 4, earned: prediction.predicted_corners === bucket });
    }
  }

  if (prediction.predicted_btts !== null) {
    results.push({ key: 'btts', label: 'BTTS', pts: 2, earned: prediction.predicted_btts === actualBTTS });
  }

  if (prediction.predicted_over_under !== null) {
    const isOver = totalGoals > 2.5;
    const earned = (prediction.predicted_over_under === 'over' && isOver) ||
      (prediction.predicted_over_under === 'under' && !isOver);
    results.push({ key: 'ou', label: 'Over/Under', pts: 3, earned });
  }

  return results;
}

