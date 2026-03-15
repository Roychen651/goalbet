/**
 * GoalBet — Supabase Edge Function: sync-matches
 *
 * Fetches upcoming + recent matches from TheSportsDB (free, key "3")
 * and upserts them into the matches table.
 *
 * Can be triggered:
 *   - Manually from the app: supabase.functions.invoke('sync-matches', { body: { league_ids: [...] } })
 *   - Via pg_cron: SELECT cron.schedule('sync-daily', '5 0 * * *', $$SELECT net.http_post(...)$$)
 *
 * Deploy: supabase functions deploy sync-matches
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SPORTSDB_BASE = 'https://www.thesportsdb.com/api/v1/json/3';

const DEFAULT_LEAGUES = [
  4328, 4335, 4331, 4332, 4334,  // PL, La Liga, Bundesliga, Serie A, Ligue 1
  4346, 4399, 4877,               // UCL, EL, Conference League
  4354, 4337, 4338, 4330,        // Israel, Eredivisie, Süper Lig, Scottish
  4344, 4351, 4350,               // MLS, Brazil, Argentina
];

interface SportsDBEvent {
  idEvent: string;
  idLeague: string;
  strLeague: string;
  strHomeTeam: string;
  strAwayTeam: string;
  strHomeTeamBadge?: string;
  strAwayTeamBadge?: string;
  dateEvent: string;
  strTime: string | null;
  strStatus: string | null;
  intHomeScore: string | null;
  intAwayScore: string | null;
  intHomeScoreHalf: string | null;
  intAwayScoreHalf: string | null;
  strSeason: string | null;
  intRound: string | null;
}

function mapStatus(s: string | null): string {
  if (!s) return 'NS';
  const v = s.toLowerCase().trim();
  if (v === 'match finished' || v === 'ft' || v === 'aet' || v === 'pen') return 'FT';
  if (v === 'half time' || v === 'ht') return 'HT';
  if (v === 'in progress' || v === 'live' || v === '1h') return '1H';
  if (v === '2h') return '2H';
  if (v === 'postponed' || v === 'pst') return 'PST';
  if (v === 'cancelled' || v === 'canc' || v === 'canceled') return 'CANC';
  return 'NS';
}

function parseScore(val: string | null, status: string): number | null {
  if (!val) return null;
  const n = parseInt(val, 10);
  if (isNaN(n)) return null;
  if (n === 0 && status === 'NS') return null;
  return n;
}

function transformEvent(e: SportsDBEvent) {
  const status = mapStatus(e.strStatus);
  let kickoff_time: string;
  try {
    const t = e.strTime || '12:00:00+00:00';
    kickoff_time = new Date(`${e.dateEvent}T${t}`).toISOString();
  } catch {
    kickoff_time = new Date(`${e.dateEvent}T12:00:00Z`).toISOString();
  }
  return {
    external_id: e.idEvent,
    league_id: parseInt(e.idLeague, 10),
    league_name: e.strLeague,
    home_team: e.strHomeTeam,
    away_team: e.strAwayTeam,
    home_team_badge: e.strHomeTeamBadge || null,
    away_team_badge: e.strAwayTeamBadge || null,
    kickoff_time,
    status,
    home_score: parseScore(e.intHomeScore, status),
    away_score: parseScore(e.intAwayScore, status),
    halftime_home: parseScore(e.intHomeScoreHalf, status),
    halftime_away: parseScore(e.intAwayScoreHalf, status),
    season: e.strSeason || null,
    round: e.intRound || null,
  };
}

async function fetchLeague(leagueId: number) {
  const [nextRes, pastRes] = await Promise.all([
    fetch(`${SPORTSDB_BASE}/eventsnextleague.php?id=${leagueId}`).then(r => r.json()),
    fetch(`${SPORTSDB_BASE}/eventspastleague.php?id=${leagueId}`).then(r => r.json()),
  ]);
  const events: SportsDBEvent[] = [
    ...(nextRes.events ?? []),
    ...(pastRes.events ?? []),
  ];
  // Deduplicate by idEvent
  const seen = new Set<string>();
  return events
    .filter(e => { if (seen.has(e.idEvent)) return false; seen.add(e.idEvent); return true; })
    .map(transformEvent);
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Parse requested leagues (or use defaults)
    let leagueIds = DEFAULT_LEAGUES;
    try {
      const body = await req.json();
      if (Array.isArray(body.league_ids) && body.league_ids.length > 0) {
        leagueIds = body.league_ids;
      }
    } catch { /* use defaults */ }

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    let totalUpserted = 0;
    const errors: string[] = [];

    for (const leagueId of leagueIds) {
      try {
        const matches = await fetchLeague(leagueId);
        if (matches.length === 0) continue;

        const { error } = await supabase
          .from('matches')
          .upsert(matches, { onConflict: 'external_id', ignoreDuplicates: false });

        if (error) {
          errors.push(`League ${leagueId}: ${error.message}`);
        } else {
          totalUpserted += matches.length;
        }
        // Small polite delay between API calls
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        errors.push(`League ${leagueId}: ${err}`);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        leagues_synced: leagueIds.length,
        matches_upserted: totalUpserted,
        errors,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
