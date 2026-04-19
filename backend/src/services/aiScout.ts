/**
 * AI Scout — Groq (Llama 3) generative insights for matches.
 *
 * Architecture: Compute Once, Serve Infinite.
 * Backend generates once per match and writes to matches.ai_pre_match_insight
 * / matches.ai_post_match_summary. Frontend reads as plain text — zero API
 * calls from the client, zero rate-limit exposure to end users.
 *
 * Graceful degradation: every public function swallows all failures (network,
 * rate limit, malformed response) and returns silently. Columns stay null and
 * the frontend hides the AI UI entirely. The app MUST NEVER BREAK due to AI.
 */
import axios from 'axios';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { logger } from './../lib/logger';
import { fetchMatchKeyEvents, type MatchKeyEvent } from './espn';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const GROQ_TIMEOUT_MS = 12_000;

function getApiKey(): string | null {
  const key = process.env.GROQ_API_KEY;
  return key && key.trim() ? key.trim() : null;
}

interface GroqMessage {
  role: 'system' | 'user';
  content: string;
}

async function callGroq(messages: GroqMessage[], maxTokens: number): Promise<string | null> {
  const key = getApiKey();
  if (!key) {
    // No key configured — silent no-op (intentional: lets the backend run without Groq locally).
    return null;
  }

  try {
    const { data } = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature: 0.6,
      },
      {
        timeout: GROQ_TIMEOUT_MS,
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') return null;

    const cleaned = text
      .trim()
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/\s+/g, ' ');

    if (!cleaned || cleaned.length < 4) return null;
    return cleaned.slice(0, 500);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`[aiScout] Groq request failed: ${message}`);
    return null;
  }
}

// ── Pre-match ───────────────────────────────────────────────────────────────

interface PreMatchContext {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  leagueName: string | null;
  kickoffTime: string;
}

const PRE_MATCH_SYSTEM_EN = `You are an elite, slightly cynical football betting analyst.
Given the match context, return ONE short, punchy sentence (≤ 22 words) of insight.
Do not hallucinate specific stats, results, or quotes you were not given.
Do not invent player names. Never wrap in quotes. Output the sentence only.`;

const PRE_MATCH_SYSTEM_HE = `אתה אנליסט הימורי כדורגל אליטיסטי וקצת ציני.
בהינתן הקשר המשחק, החזר משפט אחד קצר ונוקב (עד 22 מילים) של תובנה.
אל תמציא סטטיסטיקות, תוצאות או ציטוטים ספציפיים שלא ניתנו לך.
אל תמציא שמות שחקנים. לעולם אל תעטוף במרכאות. החזר את המשפט בלבד, בעברית תקנית.`;

async function generatePreMatchInsight(ctx: PreMatchContext, lang: 'en' | 'he'): Promise<string | null> {
  if (lang === 'he') {
    const league = ctx.leagueName ?? 'ליגה מקצועית בכירה';
    const user =
      `משחק: ${ctx.homeTeam} מול ${ctx.awayTeam}\n` +
      `תחרות: ${league}\n` +
      `פתיחה: ${ctx.kickoffTime}\n\n` +
      `כתוב משפט חד אחד שמהמר מנוסה היה רוצה לשמוע לפני שהוא מנחש. ` +
      `התמקד בטון, בזווית, או בתחושה כללית — לא בסטטיסטיקות בדויות.`;
    return callGroq(
      [
        { role: 'system', content: PRE_MATCH_SYSTEM_HE },
        { role: 'user', content: user },
      ],
      180,
    );
  }

  const league = ctx.leagueName ?? 'a top-flight league';
  const user =
    `Match: ${ctx.homeTeam} vs ${ctx.awayTeam}\n` +
    `Competition: ${league}\n` +
    `Kickoff: ${ctx.kickoffTime}\n\n` +
    `Write one sharp sentence an experienced bettor would want to hear before placing a pick. ` +
    `Focus on tone, angle, or a general read — not fabricated statistics.`;
  return callGroq(
    [
      { role: 'system', content: PRE_MATCH_SYSTEM_EN },
      { role: 'user', content: user },
    ],
    120,
  );
}

// ── Post-match ──────────────────────────────────────────────────────────────

interface PostMatchContext {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  leagueName: string | null;
  homeScore: number;
  awayScore: number;
  regulationHome: number | null;
  regulationAway: number | null;
  wentToPenalties: boolean;
  penaltyHome: number | null;
  penaltyAway: number | null;
  cornersTotal: number | null;
}

const POST_MATCH_SYSTEM_EN = `You are a witty sports commentator.
Given the final score and stats, summarize the match in TWO short, entertaining sentences (≤ 40 words total).
Do not invent player names, minutes, or stats you were not given.
Never wrap in quotes. Output the summary only.`;

const POST_MATCH_SYSTEM_HE = `אתה פרשן ספורט שנון.
בהינתן התוצאה הסופית והנתונים, סכם את המשחק בשני משפטים קצרים ומשעשעים (עד 40 מילים סך הכל).
אל תמציא שמות שחקנים, דקות או סטטיסטיקות שלא ניתנו לך.
לעולם אל תעטוף במרכאות. החזר את הסיכום בלבד, בעברית תקנית.`;

async function generatePostMatchSummary(ctx: PostMatchContext, lang: 'en' | 'he'): Promise<string | null> {
  if (lang === 'he') {
    const league = ctx.leagueName ?? 'ליגה';
    const regLine = ctx.regulationHome !== null && ctx.regulationAway !== null
      && (ctx.regulationHome !== ctx.homeScore || ctx.regulationAway !== ctx.awayScore)
      ? `זמן חוקי (90′): ${ctx.regulationHome}-${ctx.regulationAway}\n`
      : '';
    const penLine = ctx.wentToPenalties && ctx.penaltyHome !== null && ctx.penaltyAway !== null
      ? `דו-קרב פנדלים: ${ctx.penaltyHome}-${ctx.penaltyAway}\n`
      : '';
    const cornersLine = ctx.cornersTotal !== null ? `סך קרנות: ${ctx.cornersTotal}\n` : '';

    const user =
      `משחק: ${ctx.homeTeam} מול ${ctx.awayTeam}\n` +
      `תחרות: ${league}\n` +
      `תוצאה סופית: ${ctx.homeScore}-${ctx.awayScore}\n` +
      regLine +
      penLine +
      cornersLine +
      `\nכתוב שני משפטים משעשעים שמסכמים איך המשחק התנהל, אך ורק על בסיס המידע שלמעלה.`;

    return callGroq(
      [
        { role: 'system', content: POST_MATCH_SYSTEM_HE },
        { role: 'user', content: user },
      ],
      260,
    );
  }

  const league = ctx.leagueName ?? 'league play';
  const regLine = ctx.regulationHome !== null && ctx.regulationAway !== null
    && (ctx.regulationHome !== ctx.homeScore || ctx.regulationAway !== ctx.awayScore)
    ? `Regulation (90′): ${ctx.regulationHome}-${ctx.regulationAway}\n`
    : '';
  const penLine = ctx.wentToPenalties && ctx.penaltyHome !== null && ctx.penaltyAway !== null
    ? `Penalty shootout: ${ctx.penaltyHome}-${ctx.penaltyAway}\n`
    : '';
  const cornersLine = ctx.cornersTotal !== null ? `Total corners: ${ctx.cornersTotal}\n` : '';

  const user =
    `Match: ${ctx.homeTeam} vs ${ctx.awayTeam}\n` +
    `Competition: ${league}\n` +
    `Final score: ${ctx.homeScore}-${ctx.awayScore}\n` +
    regLine +
    penLine +
    cornersLine +
    `\nWrite two entertaining sentences summarizing how the match went based ONLY on what's above.`;

  return callGroq(
    [
      { role: 'system', content: POST_MATCH_SYSTEM_EN },
      { role: 'user', content: user },
    ],
    180,
  );
}

// ── Public API: write insights into `matches` ───────────────────────────────

type InsightColumn =
  | 'ai_pre_match_insight'
  | 'ai_pre_match_insight_he'
  | 'ai_post_match_summary'
  | 'ai_post_match_summary_he'
  | 'ai_ht_insight'
  | 'ai_ht_insight_he';

async function writeInsight(matchId: string, column: InsightColumn, text: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('matches')
    .update({ [column]: text })
    .eq('id', matchId)
    .is(column, null);

  if (error) {
    logger.warn(`[aiScout] Failed to persist ${column} for match ${matchId}: ${error.message}`);
  }
}

/**
 * Fetch up to `limit` upcoming matches (next 24h) missing a pre-match insight
 * and populate them. Errors are logged and swallowed — never throws.
 */
export async function runPreMatchBatch(limit = 2): Promise<void> {
  if (!getApiKey()) return;

  try {
    const now = new Date();
    const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: rows, error } = await supabaseAdmin
      .from('matches')
      .select('id, home_team, away_team, league_name, kickoff_time, ai_pre_match_insight, ai_pre_match_insight_he')
      .eq('status', 'NS')
      .or('ai_pre_match_insight.is.null,ai_pre_match_insight_he.is.null')
      .gte('kickoff_time', now.toISOString())
      .lte('kickoff_time', cutoff.toISOString())
      .order('kickoff_time', { ascending: true })
      .limit(limit);

    if (error) {
      logger.warn(`[aiScout] Pre-match batch query failed: ${error.message}`);
      return;
    }

    if (!rows || rows.length === 0) return;

    logger.info(`[aiScout] Generating pre-match insight for ${rows.length} match(es)`);

    for (const row of rows) {
      const ctx = {
        matchId: row.id,
        homeTeam: row.home_team,
        awayTeam: row.away_team,
        leagueName: row.league_name,
        kickoffTime: row.kickoff_time,
      };
      if (!row.ai_pre_match_insight) {
        const en = await generatePreMatchInsight(ctx, 'en');
        if (en) {
          await writeInsight(row.id, 'ai_pre_match_insight', en);
          logger.info(`[aiScout] Pre-match EN insight saved for ${row.home_team} vs ${row.away_team}`);
        }
      }
      if (!row.ai_pre_match_insight_he) {
        const he = await generatePreMatchInsight(ctx, 'he');
        if (he) {
          await writeInsight(row.id, 'ai_pre_match_insight_he', he);
          logger.info(`[aiScout] Pre-match HE insight saved for ${row.home_team} vs ${row.away_team}`);
        }
      }
    }
  } catch (err) {
    logger.warn(`[aiScout] runPreMatchBatch crashed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Backfill post-match summaries for recent FT matches missing one.
 *
 * The per-match `ensurePostMatchSummary` only fires on the FT *transition*;
 * matches that were already FT when Sprint 26 shipped never trigger it. This
 * batch is called on the same sync cycle as the pre-match batch so recent
 * backlog gets filled in gradually without hammering Groq.
 */
export async function runPostMatchBatch(limit = 3): Promise<void> {
  if (!getApiKey()) return;

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await supabaseAdmin
      .from('matches')
      .select('id, home_team, away_team, league_name, home_score, away_score, regulation_home, regulation_away, went_to_penalties, penalty_home, penalty_away, corners_total, ai_post_match_summary, ai_post_match_summary_he')
      .eq('status', 'FT')
      .or('ai_post_match_summary.is.null,ai_post_match_summary_he.is.null')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .gte('kickoff_time', sevenDaysAgo)
      .order('kickoff_time', { ascending: false })
      .limit(limit);

    if (error) {
      logger.warn(`[aiScout] Post-match batch query failed: ${error.message}`);
      return;
    }

    if (!rows || rows.length === 0) return;

    logger.info(`[aiScout] Generating post-match summary for ${rows.length} match(es)`);

    for (const row of rows) {
      const ctx = {
        matchId: row.id,
        homeTeam: row.home_team,
        awayTeam: row.away_team,
        leagueName: row.league_name,
        homeScore: row.home_score,
        awayScore: row.away_score,
        regulationHome: row.regulation_home,
        regulationAway: row.regulation_away,
        wentToPenalties: row.went_to_penalties,
        penaltyHome: row.penalty_home,
        penaltyAway: row.penalty_away,
        cornersTotal: row.corners_total,
      };
      if (!row.ai_post_match_summary) {
        const en = await generatePostMatchSummary(ctx, 'en');
        if (en) {
          await writeInsight(row.id, 'ai_post_match_summary', en);
          logger.info(`[aiScout] Post-match EN summary saved for ${row.home_team} ${row.home_score}-${row.away_score} ${row.away_team}`);
        }
      }
      if (!row.ai_post_match_summary_he) {
        const he = await generatePostMatchSummary(ctx, 'he');
        if (he) {
          await writeInsight(row.id, 'ai_post_match_summary_he', he);
          logger.info(`[aiScout] Post-match HE summary saved for ${row.home_team} ${row.home_score}-${row.away_score} ${row.away_team}`);
        }
      }
    }
  } catch (err) {
    logger.warn(`[aiScout] runPostMatchBatch crashed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Generate the post-match summary for a single FT match that still has null
 * `ai_post_match_summary`. Called inline from the score resolver after a match
 * flips to FT. Errors swallowed.
 */
export async function ensurePostMatchSummary(matchId: string): Promise<void> {
  if (!getApiKey()) return;

  try {
    const { data: row, error } = await supabaseAdmin
      .from('matches')
      .select('id, home_team, away_team, league_name, home_score, away_score, regulation_home, regulation_away, went_to_penalties, penalty_home, penalty_away, corners_total, status, ai_post_match_summary, ai_post_match_summary_he')
      .eq('id', matchId)
      .single();

    if (error || !row) return;
    if (row.status !== 'FT') return;
    if (row.home_score === null || row.away_score === null) return;
    if (row.ai_post_match_summary && row.ai_post_match_summary_he) return;

    const ctx = {
      matchId: row.id,
      homeTeam: row.home_team,
      awayTeam: row.away_team,
      leagueName: row.league_name,
      homeScore: row.home_score,
      awayScore: row.away_score,
      regulationHome: row.regulation_home,
      regulationAway: row.regulation_away,
      wentToPenalties: row.went_to_penalties,
      penaltyHome: row.penalty_home,
      penaltyAway: row.penalty_away,
      cornersTotal: row.corners_total,
    };

    if (!row.ai_post_match_summary) {
      const en = await generatePostMatchSummary(ctx, 'en');
      if (en) {
        await writeInsight(row.id, 'ai_post_match_summary', en);
        logger.info(`[aiScout] Post-match EN summary saved for ${row.home_team} ${row.home_score}-${row.away_score} ${row.away_team}`);
      }
    }
    if (!row.ai_post_match_summary_he) {
      const he = await generatePostMatchSummary(ctx, 'he');
      if (he) {
        await writeInsight(row.id, 'ai_post_match_summary_he', he);
        logger.info(`[aiScout] Post-match HE summary saved for ${row.home_team} ${row.home_score}-${row.away_score} ${row.away_team}`);
      }
    }
  } catch (err) {
    logger.warn(`[aiScout] ensurePostMatchSummary crashed for ${matchId}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── HT Tactical Read ────────────────────────────────────────────────────────
//
// Sprint 27. When a match flips to HT and ai_ht_insight IS NULL, we pull the
// first-half key events from ESPN, compress them into a terse factual brief,
// and ask Groq for ONE urgent tactical sentence predicting the second half.
// Goes silent on any failure — the UI hides the ticker entirely.

interface HTContext {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  leagueName: string | null;
  halftimeHome: number | null;
  halftimeAway: number | null;
  firstHalfEvents: MatchKeyEvent[];
}

const HT_SYSTEM_EN = `You are a live elite tactical analyst on broadcast TV at half time.
Given the first-half situation, output ONE urgent, tactical sentence predicting the second half (≤ 24 words).
Sound confident, sharp, punchy — like a lower-third graphic overlay read on live air.
Do not invent stats or player names beyond what is given. Never wrap in quotes. Output the sentence only.`;

const HT_SYSTEM_HE = `אתה פרשן טקטי אליטיסטי בשידור חי בהפסקה.
בהינתן מצב המחצית הראשונה, החזר משפט טקטי אחד דחוף שחוזה את המחצית השנייה (עד 24 מילים).
הישמע בטוח, חד, נוקב — כמו טקסט גרפיקה תחתית בשידור חי.
אל תמציא סטטיסטיקות או שמות שחקנים מעבר למה שניתן. לעולם אל תעטוף במרכאות. החזר את המשפט בלבד, בעברית תקנית.`;

function summarizeFirstHalfEvents(events: MatchKeyEvent[], lang: 'en' | 'he'): string {
  const firstHalf = events.filter(e => e.period === 1).slice(0, 14);
  if (firstHalf.length === 0) {
    return lang === 'he' ? 'ללא אירועים בולטים שנרשמו.' : 'No major events recorded.';
  }
  const lines: string[] = [];
  for (const ev of firstHalf) {
    const minute = ev.extraTime !== null ? `${ev.minute}+${ev.extraTime}'` : `${ev.minute}'`;
    const side = ev.team === 'home' ? 'home' : 'away';
    const sideHe = ev.team === 'home' ? 'בית' : 'חוץ';
    if (lang === 'he') {
      const typeHe = ev.type === 'goal' ? 'שער' :
        ev.type === 'own_goal' ? 'שער עצמי' :
        ev.type === 'penalty_goal' ? 'פנדל מוצלח' :
        ev.type === 'yellow_card' ? 'כרטיס צהוב' :
        ev.type === 'red_card' ? 'כרטיס אדום' :
        ev.type === 'second_yellow' ? 'צהוב שני' : 'חילוף';
      lines.push(`${minute} ${sideHe}: ${typeHe}`);
    } else {
      const typeEn = ev.type.replace(/_/g, ' ');
      lines.push(`${minute} ${side}: ${typeEn}`);
    }
  }
  return lines.join('; ');
}

async function generateHTInsight(ctx: HTContext, lang: 'en' | 'he'): Promise<string | null> {
  if (lang === 'he') {
    const league = ctx.leagueName ?? 'ליגה בכירה';
    const score = ctx.halftimeHome !== null && ctx.halftimeAway !== null
      ? `${ctx.halftimeHome}-${ctx.halftimeAway}`
      : 'לא ידוע';
    const eventsSummary = summarizeFirstHalfEvents(ctx.firstHalfEvents, 'he');
    const user =
      `משחק: ${ctx.homeTeam} מול ${ctx.awayTeam}\n` +
      `תחרות: ${league}\n` +
      `תוצאת מחצית: ${score}\n` +
      `אירועי מחצית ראשונה: ${eventsSummary}\n\n` +
      `קרא את המצב. כתוב משפט טקטי דחוף אחד שחוזה מה יקרה בחצי השני.`;
    return callGroq(
      [
        { role: 'system', content: HT_SYSTEM_HE },
        { role: 'user', content: user },
      ],
      200,
    );
  }

  const league = ctx.leagueName ?? 'top-flight competition';
  const score = ctx.halftimeHome !== null && ctx.halftimeAway !== null
    ? `${ctx.halftimeHome}-${ctx.halftimeAway}`
    : 'unknown';
  const eventsSummary = summarizeFirstHalfEvents(ctx.firstHalfEvents, 'en');
  const user =
    `Match: ${ctx.homeTeam} vs ${ctx.awayTeam}\n` +
    `Competition: ${league}\n` +
    `Half-time score: ${score}\n` +
    `First-half events: ${eventsSummary}\n\n` +
    `Read the room. Write ONE urgent tactical sentence predicting what happens in the second half.`;

  return callGroq(
    [
      { role: 'system', content: HT_SYSTEM_EN },
      { role: 'user', content: user },
    ],
    140,
  );
}

/**
 * Fetch up to `limit` currently-HT matches missing an HT insight and populate
 * them. Intended to be called from the sync cycle. Errors swallowed.
 */
export async function runHTInsightBatch(limit = 2): Promise<void> {
  if (!getApiKey()) return;

  try {
    const { data: rows, error } = await supabaseAdmin
      .from('matches')
      .select('id, external_id, home_team, away_team, league_id, league_name, halftime_home, halftime_away, ai_ht_insight, ai_ht_insight_he')
      .eq('status', 'HT')
      .or('ai_ht_insight.is.null,ai_ht_insight_he.is.null')
      .order('kickoff_time', { ascending: false })
      .limit(limit);

    if (error) {
      logger.warn(`[aiScout] HT batch query failed: ${error.message}`);
      return;
    }

    if (!rows || rows.length === 0) return;

    logger.info(`[aiScout] Generating HT insight for ${rows.length} match(es)`);

    for (const row of rows) {
      const events = (await fetchMatchKeyEvents(row.external_id, row.league_id)) ?? [];
      const ctx: HTContext = {
        matchId: row.id,
        homeTeam: row.home_team,
        awayTeam: row.away_team,
        leagueName: row.league_name,
        halftimeHome: row.halftime_home,
        halftimeAway: row.halftime_away,
        firstHalfEvents: events,
      };

      if (!row.ai_ht_insight) {
        const en = await generateHTInsight(ctx, 'en');
        if (en) {
          await writeInsight(row.id, 'ai_ht_insight', en);
          logger.info(`[aiScout] HT EN insight saved for ${row.home_team} vs ${row.away_team}`);
        }
      }
      if (!row.ai_ht_insight_he) {
        const he = await generateHTInsight(ctx, 'he');
        if (he) {
          await writeInsight(row.id, 'ai_ht_insight_he', he);
          logger.info(`[aiScout] HT HE insight saved for ${row.home_team} vs ${row.away_team}`);
        }
      }
    }
  } catch (err) {
    logger.warn(`[aiScout] runHTInsightBatch crashed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── Chronicler ──────────────────────────────────────────────────────────────
//
// Sprint 27. When a user scores a perfect +10 (result + exact score both right)
// on a high-profile match, Groq writes a 3-sentence mythical saga and we persist
// it to user_chronicles. Errors swallowed — zero disruption to the score
// resolution path.

// High-profile league IDs: top-5 European leagues + major UEFA/FIFA competitions.
// Matches the prominence bar we want for "Hall of Fame" status.
const HIGH_PROFILE_LEAGUE_IDS = new Set<number>([
  4328, // Premier League
  4335, // La Liga
  4331, // Bundesliga
  4332, // Serie A
  4334, // Ligue 1
  4346, // Champions League
  4399, // Europa League
  4877, // Conference League
  4480, // World Cup
  4635, // UEFA Nations League
  5000, // World Cup Qualifiers 2026
]);

const CHRONICLER_SYSTEM_EN = `You are a mythic sports chronicler narrating an impossible feat of prediction.
Given the user and match, write THREE dramatic, epic, slightly mythical sentences (≤ 70 words total) celebrating their perfect prediction.
Act like an ancient saga. Use vivid imagery. Do not invent specific stats, quotes, or events you were not given.
Output the prose only — no title, no quotes, no bullet points.`;

const CHRONICLER_SYSTEM_HE = `אתה היסטוריון ספורט מיתי המספר על מעשה ניחוש בלתי אפשרי.
בהינתן המשתמש והמשחק, כתוב שלושה משפטים דרמטיים, אפיים ומעט מיתיים (עד 70 מילים סך הכל) שחוגגים את הניחוש המושלם שלו.
הישמע כמו סאגה עתיקה. השתמש בדימויים חזותיים חיים. אל תמציא סטטיסטיקות, ציטוטים או אירועים שלא ניתנו לך.
החזר את הפרוזה בלבד — ללא כותרת, ללא מרכאות, ללא תבליטים. בעברית תקנית.`;

interface ChronicleContext {
  username: string;
  homeTeam: string;
  awayTeam: string;
  leagueName: string | null;
  finalHome: number;
  finalAway: number;
}

async function generateChronicleText(ctx: ChronicleContext, lang: 'en' | 'he'): Promise<string | null> {
  if (lang === 'he') {
    const league = ctx.leagueName ?? 'ליגה';
    const user =
      `משתמש: ${ctx.username}\n` +
      `משחק: ${ctx.homeTeam} מול ${ctx.awayTeam}\n` +
      `תחרות: ${league}\n` +
      `תוצאה סופית מנחשת במדויק: ${ctx.finalHome}-${ctx.finalAway}\n\n` +
      `${ctx.username} ניחש את התוצאה המדויקת הבלתי נתפסת של המשחק הזה. כתוב סאגה מיתית בת שלושה משפטים.`;
    return callGroq(
      [
        { role: 'system', content: CHRONICLER_SYSTEM_HE },
        { role: 'user', content: user },
      ],
      320,
    );
  }

  const league = ctx.leagueName ?? 'top-flight football';
  const user =
    `User: ${ctx.username}\n` +
    `Match: ${ctx.homeTeam} vs ${ctx.awayTeam}\n` +
    `Competition: ${league}\n` +
    `Exact predicted final score: ${ctx.finalHome}-${ctx.finalAway}\n\n` +
    `${ctx.username} just guessed the exact unbelievable score of this match. Write the three-sentence mythical saga.`;

  return callGroq(
    [
      { role: 'system', content: CHRONICLER_SYSTEM_EN },
      { role: 'user', content: user },
    ],
    220,
  );
}

function buildChronicleTitle(ctx: ChronicleContext, lang: 'en' | 'he'): string {
  const score = `${ctx.finalHome}-${ctx.finalAway}`;
  if (lang === 'he') {
    return `${ctx.homeTeam} נגד ${ctx.awayTeam} · ${score}`;
  }
  return `${ctx.homeTeam} vs ${ctx.awayTeam} · ${score}`;
}

export interface ChronicleSeed {
  userId: string;
  matchId: string;
  groupId: string | null;
  pointsEarned: number;
  predictedHome: number | null;
  predictedAway: number | null;
  finalHome: number;
  finalAway: number;
  homeTeam: string;
  awayTeam: string;
  leagueId: number;
  leagueName: string | null;
}

/**
 * If the seed qualifies (perfect +10 on high-profile league), write a chronicle
 * row with EN + HE epic text. No-op on duplicate (unique index on user+match),
 * missing key, non-qualifying league, or Groq failure. Never throws.
 */
export async function ensureChronicle(seed: ChronicleSeed): Promise<void> {
  try {
    if (seed.pointsEarned < 10) return;
    if (!HIGH_PROFILE_LEAGUE_IDS.has(seed.leagueId)) return;
    if (!getApiKey()) return;

    // Skip if we already wrote one (idempotent across concurrent resolvers)
    const { data: existing } = await supabaseAdmin
      .from('user_chronicles')
      .select('id')
      .eq('user_id', seed.userId)
      .eq('match_id', seed.matchId)
      .maybeSingle();
    if (existing) return;

    // Username for the prose
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('id', seed.userId)
      .single();
    const username = profile?.username ?? 'The Oracle';

    const ctx: ChronicleContext = {
      username,
      homeTeam: seed.homeTeam,
      awayTeam: seed.awayTeam,
      leagueName: seed.leagueName,
      finalHome: seed.finalHome,
      finalAway: seed.finalAway,
    };

    const [en, he] = await Promise.all([
      generateChronicleText(ctx, 'en'),
      generateChronicleText(ctx, 'he'),
    ]);

    if (!en) return; // EN is required; if Groq fails, skip the row entirely

    const { error } = await supabaseAdmin.from('user_chronicles').insert({
      user_id: seed.userId,
      match_id: seed.matchId,
      group_id: seed.groupId,
      title: buildChronicleTitle(ctx, 'en'),
      epic_text: en,
      epic_text_he: he ?? null,
      predicted_home: seed.predictedHome,
      predicted_away: seed.predictedAway,
      final_home: seed.finalHome,
      final_away: seed.finalAway,
      points_earned: seed.pointsEarned,
    });

    if (error) {
      // Unique-violation = concurrent resolver beat us, which is fine
      if (!/duplicate|unique/i.test(error.message)) {
        logger.warn(`[aiScout] Chronicle insert failed for ${username} / ${seed.matchId}: ${error.message}`);
      }
      return;
    }

    logger.info(`[aiScout] Chronicle written for ${username} — ${seed.homeTeam} ${seed.finalHome}-${seed.finalAway} ${seed.awayTeam}`);
  } catch (err) {
    logger.warn(`[aiScout] ensureChronicle crashed for user ${seed.userId} match ${seed.matchId}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
