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
  | 'ai_post_match_summary_he';

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
