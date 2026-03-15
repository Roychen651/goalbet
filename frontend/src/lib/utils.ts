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
}

export function calcBreakdown(prediction: Prediction, match: Match): TierResult[] | null {
  if (match.home_score === null || match.away_score === null || match.status !== 'FT') return null;

  const actualOutcome = match.home_score > match.away_score ? 'H'
    : match.home_score < match.away_score ? 'A' : 'D';
  const totalGoals = match.home_score + match.away_score;
  const actualBTTS = match.home_score > 0 && match.away_score > 0;

  const exactScoreCorrect =
    prediction.predicted_home_score !== null &&
    prediction.predicted_away_score !== null &&
    prediction.predicted_home_score === match.home_score &&
    prediction.predicted_away_score === match.away_score;

  const results: TierResult[] = [];

  if (prediction.predicted_outcome !== null) {
    const earned = prediction.predicted_outcome === actualOutcome || exactScoreCorrect;
    results.push({ key: 'result', label: 'Result', pts: 3, earned });
  }

  if (prediction.predicted_home_score !== null && prediction.predicted_away_score !== null) {
    results.push({ key: 'score', label: 'Exact Score', pts: 7, earned: exactScoreCorrect });
  }

  if (prediction.predicted_halftime_outcome !== null) {
    let earned = false;
    if (match.halftime_home !== null && match.halftime_away !== null) {
      const actualHT = match.halftime_home > match.halftime_away ? 'H'
        : match.halftime_home < match.halftime_away ? 'A' : 'D';
      earned = prediction.predicted_halftime_outcome === actualHT;
    }
    results.push({ key: 'ht', label: 'Half Time', pts: 4, earned });
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
