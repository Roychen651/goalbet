import { LEAGUE_ESPN_SLUG } from './constants';

// Extracted from MatchTimeline.tsx (Sprint 19) so MatchMomentumPulse.tsx can
// share the exact same ESPN keyEvents parser instead of duplicating ~150
// lines of response-shape handling. MatchTimeline still gates its own call
// to FT-only matches; this module itself has no status restriction — the
// caller decides when to fetch.

export interface MatchEvent {
  minute: number;
  stoppage: number | null; // e.g. 45+2 → stoppage=2
  period: number;          // 1=1H, 2=2H, 3=ET1, 4=ET2, 5=PEN
  type: 'goal' | 'own_goal' | 'penalty_goal' | 'yellow' | 'red' | 'second_yellow' | 'sub';
  team: 'home' | 'away';
  player: string;
  assist?: string;   // player who assisted the goal
  playerOff?: string; // sub: player leaving
  text?: string;     // ESPN prose commentary for the event
}

export async function fetchEspnEvents(externalId: string, leagueId: number): Promise<MatchEvent[]> {
  const slug = LEAGUE_ESPN_SLUG[leagueId];
  if (!slug) return [];

  const eventId = externalId.replace(/^espn_/, '');
  if (!eventId || !/^\d+$/.test(eventId)) return [];

  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${eventId}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();

  // Identify which team is home/away from the header
  const comp = data?.header?.competitions?.[0];
  const competitors: Record<string, unknown>[] = comp?.competitors ?? [];
  const homeComp = competitors.find((c) => c.homeAway === 'home') as Record<string, unknown> | undefined;
  const awayComp = competitors.find((c) => c.homeAway === 'away') as Record<string, unknown> | undefined;
  const homeTeamId = String((homeComp?.team as Record<string, unknown>)?.id ?? '');
  const awayTeamId = String((awayComp?.team as Record<string, unknown>)?.id ?? '');

  // ESPN soccer summary exposes key events in `keyEvents`
  const rawEvents: Record<string, unknown>[] = data?.keyEvents ?? [];
  if (!rawEvents.length) return [];

  const events: MatchEvent[] = [];

  for (const ev of rawEvents) {
    // ── Clock ─────────────────────────────────────────────────────────────────
    // ESPN clock displayValue is "MM:SS" (e.g. "28:30") or "MM:SS+" for stoppage
    // Fall back to clock.value (seconds) if displayValue is absent.
    const clockRaw = ev.clock as Record<string, unknown> | undefined;
    const clockDisplay = String(clockRaw?.displayValue ?? '');
    const clockSeconds = typeof clockRaw?.value === 'number' ? clockRaw.value as number : null;

    let minute = 0;
    let stoppage: number | null = null;

    if (clockDisplay) {
      const stoppageMatch = clockDisplay.match(/\+(\d+)/);
      if (stoppageMatch) stoppage = parseInt(stoppageMatch[1]);
      const minsMatch = clockDisplay.match(/^(\d+)/);
      if (minsMatch) minute = parseInt(minsMatch[1]);
    } else if (clockSeconds !== null) {
      minute = Math.floor(clockSeconds / 60);
    } else {
      continue; // no timing info — skip
    }

    const period: number = ((ev.period as Record<string, unknown>)?.number as number) ?? 1;

    // ── Event type ────────────────────────────────────────────────────────────
    // ESPN uses BOTH top-level booleans (yellowCard/redCard) AND type.text strings.
    // Check both to handle all ESPN response variants reliably.
    const typeText = String(((ev.type as Record<string, unknown>)?.text ?? '')).toLowerCase();
    const isScoring = ev.scoringPlay === true;
    const isOwnGoal = ev.ownGoal === true;
    const isPenaltyGoal = ev.penaltyKick === true && isScoring;
    const isYellow = ev.yellowCard === true || typeText === 'yellow card' || typeText === 'yellow-red card';
    const isRed   = ev.redCard   === true || typeText === 'red card'    || typeText === 'straight red card';
    const isSub   = typeText.includes('sub') || typeText.includes('substitut');

    let type: MatchEvent['type'];
    if (isOwnGoal) type = 'own_goal';
    else if (isPenaltyGoal) type = 'penalty_goal';
    else if (isScoring) type = 'goal';
    else if (isYellow && isRed) type = 'second_yellow';
    else if (isRed) type = 'red';
    else if (isYellow) type = 'yellow';
    else if (isSub) type = 'sub';
    else continue; // not a key event we care about

    // ── Team side ─────────────────────────────────────────────────────────────
    const teamId = String((ev.team as Record<string, unknown>)?.id ?? '');
    const team: 'home' | 'away' =
      teamId === homeTeamId ? 'home' : teamId === awayTeamId ? 'away' : 'home';

    // ── Players ───────────────────────────────────────────────────────────────
    const participants: Record<string, unknown>[] =
      (ev.participants as Record<string, unknown>[]) ??
      (ev.athletesInvolved as Record<string, unknown>[]) ?? [];

    const getName = (p: Record<string, unknown> | undefined): string => {
      if (!p) return '';
      const ath = p.athlete as Record<string, unknown> | undefined;
      return String(ath?.shortName ?? ath?.displayName ?? p.displayName ?? '').trim();
    };

    const getRole = (p: Record<string, unknown>): string =>
      String(((p.type as Record<string, unknown>)?.text ?? p.type ?? '')).toLowerCase();

    let player = '';
    let assist: string | undefined;
    let playerOff: string | undefined;

    if (isSub) {
      const pIn  = participants.find(p => getRole(p).includes('in')  || getRole(p).includes('enter')) ?? participants[0];
      const pOut = participants.find(p => getRole(p).includes('out') || getRole(p).includes('exit')  || getRole(p).includes('replac'));
      player    = getName(pIn);
      playerOff = pOut ? getName(pOut) : undefined;
    } else {
      const scorer  = participants.find(p => getRole(p).includes('scor') || getRole(p) === 'scorer') ?? participants[0];
      const assister = participants.find(p => getRole(p).includes('assist'));
      player = getName(scorer);
      if (assister) assist = getName(assister);
    }

    if (!player) continue; // skip events with no player info

    // Capture prose commentary from ESPN (e.g. "Goal! Arsenal 1, Fulham 0. Mikel Merino...")
    const rawText = typeof ev.text === 'string' ? (ev.text as string).trim() : undefined;

    events.push({ minute, stoppage, period, type, team, player, assist, playerOff, text: rawText || undefined });
  }

  // Sort: period ASC, minute ASC, stoppage ASC
  events.sort((a, b) =>
    a.period !== b.period ? a.period - b.period :
    a.minute !== b.minute ? a.minute - b.minute :
    (a.stoppage ?? 0) - (b.stoppage ?? 0)
  );

  return events;
}
