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
  if (match.status === 'AET') return 'AET';
  if (match.status === 'FT') return null;

  const kickoffMs = new Date(match.kickoff_time).getTime();

  if (match.status === 'NS') {
    // stalled NS past kickoff — estimate
    const minsSinceKickoff = Math.floor((Date.now() - kickoffMs) / 60000);
    if (minsSinceKickoff < 0) return null;
    return `~${Math.min(minsSinceKickoff, 90)}'`;
  }

  // For 1H: always compute client-side from kickoff time.
  // ESPN's stored display_clock has significant API lag (can be 5-10 min behind),
  // while kickoff time is exact and gives us a real-time accurate count.
  if (match.status === '1H') {
    const minsSince = Math.floor((Date.now() - kickoffMs) / 60000);
    if (minsSince > 45) return "45+'";
    return `${minsSince}'`;
  }

  // For 2H: estimate minute from kickoff (assume 60 min to 2H start = 45min 1H + 15min HT break).
  // Always show a real minute — never "2H" as a label.
  if (match.status === '2H') {
    // If 100+ min have elapsed since kickoff, ESPN hasn't updated status yet — we're in ET.
    // Do NOT depend on display_clock (can be null or not contain '+').
    const totalMins = Math.floor((Date.now() - kickoffMs) / 60000);
    if (totalMins >= 100) {
      if (totalMins >= 120) return "120+'";
      return `${totalMins}'`;
    }
    if (match.display_clock?.includes('+')) return "90+'";
    const assumed2HStartMs = kickoffMs + 60 * 60 * 1000; // kickoff + ~60 min
    const minsInto2H = Math.max(0, Math.floor((Date.now() - assumed2HStartMs) / 60000));
    const displayMin = 46 + minsInto2H; // 2H starts at minute 46
    if (displayMin >= 90) return "90+'";
    return `${displayMin}'`;
  }

  // ET phases — compute client-side from kickoff (same reason as 2H: ESPN display_clock lags)
  // ET1: minutes 91–105, starts at kickoff + 90 min
  // ET2: minutes 106–120, starts at kickoff + 105 min (90 + 15 min ET break)
  if (match.status === 'ET1') {
    if (match.display_clock?.includes('+')) return "105+'";
    const et1StartMs = kickoffMs + 90 * 60 * 1000;
    const minsInto = Math.max(0, Math.floor((Date.now() - et1StartMs) / 60000));
    const min = 91 + minsInto;
    return min >= 105 ? "105+'" : `${min}'`;
  }
  if (match.status === 'ET2') {
    if (match.display_clock?.includes('+')) return "120+'";
    const et2StartMs = kickoffMs + 105 * 60 * 1000;
    const minsInto = Math.max(0, Math.floor((Date.now() - et2StartMs) / 60000));
    const min = 106 + minsInto;
    return min >= 120 ? "120+'" : `${min}'`;
  }
  // AET = break between ET halves (half-time of extra time)
  if (match.status === 'AET') return 'HT';
  if (match.status === 'PEN') return 'PENS';
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
  if (!['1H', 'HT', '2H', 'NS', 'ET1', 'ET2', 'AET', 'PEN'].includes(match.status)) return null;

  // During Extra Time / Penalties: predictions are scored on the 90-minute result.
  // Use regulation_home/away if the backend has already captured it (set when ET started).
  // This ensures the live breakdown shows the correct evaluation even while ET is ongoing.
  const isET = ['ET1', 'ET2', 'AET', 'PEN'].includes(match.status);
  const evalHome = isET && match.regulation_home !== null ? match.regulation_home : match.home_score;
  const evalAway = isET && match.regulation_away !== null ? match.regulation_away : match.away_score;

  // For 1H: current score is the provisional HT score.
  // For HT: current score IS the actual halftime score.
  // For 2H/ET: use halftime_home from DB.
  let effectiveHtHome = (match.status === '1H' || match.status === 'HT') ? match.home_score : match.halftime_home;
  let effectiveHtAway = (match.status === '1H' || match.status === 'HT') ? match.away_score : match.halftime_away;

  if (match.status === '2H' && effectiveHtHome === null && match.home_score === 0 && match.away_score === 0) {
    effectiveHtHome = 0;
    effectiveHtAway = 0;
  }

  const htPending = match.status === '2H' && effectiveHtHome === null;

  return _computeBreakdown(prediction, evalHome, evalAway, effectiveHtHome, effectiveHtAway, match.corners_total ?? null, htPending);
}

export function calcBreakdown(prediction: Prediction, match: Match): TierResult[] | null {
  if (match.home_score === null || match.away_score === null || match.status !== 'FT') return null;
  // For ET/penalty matches, use the 90-minute regulation score for scoring
  const scoringHome = match.regulation_home ?? match.home_score;
  const scoringAway = match.regulation_away ?? match.away_score;
  const result = _computeBreakdown(
    prediction, scoringHome, scoringAway,
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

