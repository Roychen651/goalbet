import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Prediction, Match } from './supabase';
import type { TranslationKey } from './i18n';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// V4 Sprint 27 — extracted out of ActivityFeed.tsx the moment a second
// consumer (PulseFeed.tsx's news timestamps) needed the identical relative-
// time formatting. Same precedent as lib/espnEvents.ts (Sprint 19) and
// lib/teamNameUtils.ts (Sprint 24): extract on the second real consumer.
export function timeAgo(iso: string, t: (k: TranslationKey) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return t('justNow');
  const mins = Math.floor(secs / 60);
  if (mins < 60) return t('minsAgo').replace('{0}', String(mins));
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('hoursAgo').replace('{0}', String(hours));
  const days = Math.floor(hours / 24);
  return t('daysAgo').replace('{0}', String(days));
}

export function formatKickoffTime(kickoffTime: string, lang: 'en' | 'he' = 'en'): {
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

  // Sprint 24 — was `undefined` locale (browser default), which showed
  // English weekday/month names to Hebrew users regardless of app language.
  // Same 'he-IL'/'en-US' branch already proven in MatchFeed.tsx's dateLabel().
  const locale = lang === 'he' ? 'he-IL' : 'en-US';

  const date = kickoff.toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const time = kickoff.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // V4 Sprint 24 — compact day/hour/minute unit labels. Hebrew has no
  // single-letter time-unit convention the way English does ("d"/"h"/"m"),
  // so these use the apostrophe-abbreviation shape ("ימ'"/"שע'"/"דק'")
  // already common in Hebrew UI copy, kept just as compact as the English
  // originals since this renders inside a small badge.
  const dUnit = lang === 'he' ? "ימ'" : 'd';
  const hUnit = lang === 'he' ? "שע'" : 'h';
  const mUnit = lang === 'he' ? "דק'" : 'm';

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
    countdown = `${diffHours}${hUnit} ${diffMins % 60}${mUnit}`;
  } else if (diffMins > 0) {
    relative = `In ${diffMins}m`;
    countdown = `${diffMins}${mUnit}`;
  } else {
    relative = 'Starting now';
    countdown = lang === 'he' ? 'עכשיו' : 'Now';
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
      lockCountdown = remainHours > 0 ? `${lockDays}${dUnit} ${remainHours}${hUnit}` : `${lockDays}${dUnit}`;
    } else if (lockHours >= 1) {
      lockCountdown = `${lockHours}${hUnit} ${lockMins % 60}${mUnit}`;
    } else {
      lockCountdown = `${lockMins}${mUnit}`;
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

  // For 1H: prefer ESPN's display_clock (reflects actual kickoff, not scheduled time).
  // Matches often kick off 3-10 min late; the formula (Date.now - scheduledKickoff)
  // over-counts by exactly that delay. display_clock is updated every ~30s by the
  // backend and tracks the real game clock, so max lag is ~60 seconds.
  if (match.status === '1H') {
    if (match.display_clock) return match.display_clock; // e.g. "37'" or "45+'"
    // Fallback only when display_clock not yet stored (match just went live)
    const minsSince = Math.floor((Date.now() - kickoffMs) / 60000);
    if (minsSince > 45) return "45+'";
    return `${minsSince}'`;
  }

  // For 2H: same principle — use ESPN's actual game clock first.
  // Formula fallback assumed kickoff+60min = 2H start, but real is ~65-70min
  // (45min 1H + 5-8min stoppage + 15min HT), causing 5-10 min over-count.
  if (match.status === '2H') {
    // Use ESPN's actual game clock first (reflects real match time, updated every ~30s).
    // This correctly shows "90+8'" for stoppage time, "91'" for ET1, etc.
    if (match.display_clock) return match.display_clock;
    // Fallback only when display_clock not yet available (match just transitioned to 2H).
    // ET1 starts ~kickoff+110min, ET2 ~kickoff+127min — only used when ESPN hasn't sent
    // a display_clock yet, so false positives for league games in stoppage are extremely rare.
    const totalMins = Math.floor((Date.now() - kickoffMs) / 60000);
    if (totalMins >= 127) {
      const footballMin = 106 + (totalMins - 127);
      if (footballMin >= 120) return "120+'";
      return `${Math.max(106, footballMin)}'`;
    }
    if (totalMins >= 110) {
      const footballMin = 91 + (totalMins - 110);
      if (footballMin >= 105) return "105+'";
      return `${Math.max(91, footballMin)}'`;
    }
    // Fallback: estimate with 68min offset (45+8stoppage+15HT = more realistic than 60)
    const assumed2HStartMs = kickoffMs + 68 * 60 * 1000;
    const minsInto2H = Math.max(0, Math.floor((Date.now() - assumed2HStartMs) / 60000));
    const displayMin = 46 + minsInto2H;
    if (displayMin >= 90) return "90+'";
    return `${displayMin}'`;
  }

  // ET phases — compute football clock minute client-side.
  // Timing assumptions (consistent with likelyInET detection in MatchCard):
  //   ET1 starts: kickoff + 110 min (90min play + ~5min 2H stoppage + 15min HT = 110)
  //   ET2 starts: kickoff + 127 min (ET1 15min + ~2min ET HT break = +17)
  if (match.status === 'ET1') {
    if (match.display_clock?.includes('+')) return "105+'";
    const footballMin = 91 + Math.max(0, Math.floor((Date.now() - (kickoffMs + 110 * 60 * 1000)) / 60000));
    return footballMin >= 105 ? "105+'" : `${footballMin}'`;
  }
  if (match.status === 'ET2') {
    if (match.display_clock?.includes('+')) return "120+'";
    const footballMin = 106 + Math.max(0, Math.floor((Date.now() - (kickoffMs + 127 * 60 * 1000)) / 60000));
    return footballMin >= 120 ? "120+'" : `${footballMin}'`;
  }
  // AET = live break between ET1 and ET2 (badge shows "AET HT", no clock label needed)
  if (match.status === 'AET') return null;
  if (match.status === 'PEN') return 'PENS';
  return null;
}

// Lock predictions 15 minutes before kickoff
export function isMatchLocked(kickoffTime: string): boolean {
  const lockAt = new Date(kickoffTime).getTime() - 15 * 60 * 1000;
  return Date.now() >= lockAt;
}

// Extracted the moment a second real consumer (the Season Archive selector,
// V7 Sprint 56 follow-up) needed the identical "2025" -> "2025/26" format
// StandingsTable.tsx's fallback-season banner already established — the
// same "extract on the second real consumer" precedent this codebase
// applies elsewhere (lib/espnEvents.ts, teamNameUtils.ts).
export function formatSeasonLabel(season: number): string {
  return `${season}/${String(season + 1).slice(-2)}`;
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

// V6 Sprint 48 — mirrors backend/src/services/pointsEngine.ts's
// classifyKnockoutRound()/KNOCKOUT_BONUS byte-for-byte. Both copies must
// stay in sync, same standing discipline as calcBreakdown() mirroring
// calculatePoints() itself (see that file's own header comment for why
// this replaced a hand-authored static bracket file for a second
// tournament — a fabricated bracket topology, not a UI risk).
export type KnockoutRound = 'r16' | 'qf' | 'sf' | 'final';

export const KNOCKOUT_BONUS: Record<KnockoutRound, number> = {
  r16: 3,
  qf: 5,
  sf: 8,
  final: 15,
};

export function classifyKnockoutRound(roundName: string | null | undefined): KnockoutRound | null {
  if (!roundName) return null;
  const s = roundName.toLowerCase();
  if (s.includes('third') || s.includes('3rd')) return null;
  if (s.includes('semi')) return 'sf';
  if (s.includes('quarter')) return 'qf';
  if (s.includes('final')) return 'final';
  if (s.includes('round of 16') || s.includes('last 16') || s.includes('r16')) return 'r16';
  return null;
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

  return _computeBreakdown(prediction, evalHome, evalAway, effectiveHtHome, effectiveHtAway, match.corners_total ?? null, htPending, match.round ?? null);
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
    false,
    match.round ?? null,
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
  round: string | null = null,
): TierResult[] {
  const actualOutcome = homeScore > awayScore ? 'H' : homeScore < awayScore ? 'A' : 'D';
  const totalGoals = homeScore + awayScore;
  const actualBTTS = homeScore > 0 && awayScore > 0;

  const exactScoreCorrect =
    prediction.predicted_home_score !== null &&
    prediction.predicted_away_score !== null &&
    prediction.predicted_home_score === homeScore &&
    prediction.predicted_away_score === awayScore;

  // Mirrors pointsEngine.ts's outcomeCorrect || impliedOutcomeFromScore gate
  // for the knockout bonus below — must match exactly, computed once here
  // rather than re-derived from the (possibly-absent) 'result' TierResult.
  const outcomeCorrect = prediction.predicted_outcome !== null && prediction.predicted_outcome === actualOutcome;
  const impliedOutcomeCorrect = exactScoreCorrect && (prediction.predicted_outcome === null || prediction.predicted_outcome === actualOutcome);
  const resultCorrect = outcomeCorrect || impliedOutcomeCorrect;

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

  // V6 Sprint 48 — knockout round-depth bonus. Only shown when the match
  // actually classifies as a knockout round AND the user made a result
  // pick at all (predicted_outcome set, or implied via an exact score) —
  // never rendered for a match with no knowable round classification.
  // Live breakdown treats this identically to how the 'result' tier
  // itself already behaves live (no separate pending state — the FT
  // result is exactly as knowable in real time as any other live tier).
  const knockoutRound = classifyKnockoutRound(round);
  if (knockoutRound && (prediction.predicted_outcome !== null || exactScoreCorrect)) {
    results.push({ key: 'knockout', label: 'Knockout Bonus', pts: KNOCKOUT_BONUS[knockoutRound], earned: resultCorrect });
  }

  return results;
}

