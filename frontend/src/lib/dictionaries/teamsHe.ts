import { normalizeTeamName } from '../teamNameUtils';

/**
 * V4 Sprint 24 — Hebrew team-name dictionary. Keyed by normalizeTeamName()'s
 * folded form (lowercase, de-accented, alpha-only) so minor ESPN spelling/
 * punctuation variants ("Man City" vs "Manchester City") still resolve —
 * exact-string keys would silently miss any variant not captured verbatim.
 *
 * `matches.home_team`/`away_team` are ESPN's `displayName` field (confirmed
 * in backend/src/services/espn.ts) — for clubs that's the full name
 * ("Manchester City"), for national teams just the country ("England").
 * Aliases below cover the short forms ESPN's other feeds (leaders, rosters)
 * sometimes use instead.
 *
 * Deliberately partial, same honesty as AI Scout's per-language coverage
 * (CLAUDE.md §22) — tTeam() falls back to the original English name when a
 * mapping doesn't exist yet, never blank/undefined. v1 covers the Premier
 * League in full (highest-traffic league) plus the marquee clubs of the
 * other 4 major leagues and a set of commonly-seen national teams.
 */
const TEAMS_HE: Record<string, string> = {
  // ── Premier League (full 20, 2024/25) ──────────────────────────────────
  arsenal: 'ארסנל',
  astonvilla: 'אסטון וילה',
  bournemouth: 'בורנמות\'',
  brentford: 'ברנטפורד',
  brighton: 'ברייטון',
  brightonhovealbion: 'ברייטון',
  chelsea: 'צ\'לסי',
  crystalpalace: 'קריסטל פאלאס',
  everton: 'אברטון',
  fulham: 'פולהאם',
  ipswichtown: 'איפסוויץ\' טאון',
  leicestercity: 'לסטר סיטי',
  liverpool: 'ליברפול',
  manchestercity: 'מנצ\'סטר סיטי',
  mancity: 'מנצ\'סטר סיטי',
  manchesterunited: 'מנצ\'סטר יונייטד',
  manutd: 'מנצ\'סטר יונייטד',
  manu: 'מנצ\'סטר יונייטד',
  newcastleunited: 'ניוקאסל יונייטד',
  newcastle: 'ניוקאסל יונייטד',
  nottinghamforest: 'נוטינגהאם פורסט',
  southampton: 'סאות\'המפטון',
  tottenhamhotspur: 'טוטנהאם הוטספר',
  tottenham: 'טוטנהאם הוטספר',
  spurs: 'טוטנהאם הוטספר',
  westhamunited: 'וסט הם יונייטד',
  westham: 'וסט הם יונייטד',
  wolverhamptonwanderers: 'וולברהמפטון וונדררס',
  wolves: 'וולברהמפטון וונדררס',

  // ── La Liga (marquee clubs) ─────────────────────────────────────────────
  realmadrid: 'ריאל מדריד',
  barcelona: 'ברצלונה',
  atleticomadrid: 'אתלטיקו מדריד',
  atleticodemadrid: 'אתלטיקו מדריד',
  sevilla: 'סביליה',
  realsociedad: 'ראיאל סוסיאדד',
  valencia: 'ולנסיה',
  villarreal: 'ויאריאל',
  athleticbilbao: 'אתלטיק בילבאו',
  athleticclub: 'אתלטיק בילבאו',

  // ── Bundesliga (marquee clubs) ──────────────────────────────────────────
  bayernmunich: 'באיירן מינכן',
  fcbayernmunchen: 'באיירן מינכן',
  borussiadortmund: 'בורוסיה דורטמונד',
  dortmund: 'בורוסיה דורטמונד',
  rbleipzig: 'לייפציג',
  bayerleverkusen: 'באייר לברקוזן',
  leverkusen: 'באייר לברקוזן',
  eintrachtfrankfurt: 'איינטרכט פרנקפורט',

  // ── Serie A (marquee clubs) ──────────────────────────────────────────────
  juventus: 'יובנטוס',
  intermilan: 'אינטר מילאן',
  internazionale: 'אינטר מילאן',
  acmilan: 'מילאן',
  milan: 'מילאן',
  napoli: 'נאפולי',
  asroma: 'רומא',
  roma: 'רומא',
  lazio: 'לאציו',
  atalanta: 'אטלנטה',
  fiorentina: 'פיורנטינה',

  // ── Ligue 1 (marquee clubs) ──────────────────────────────────────────────
  parissaintgermain: 'פריז סן ז\'רמן',
  psg: 'פריז סן ז\'רמן',
  marseille: 'מארסיי',
  olympiquedemarseille: 'מארסיי',
  lyon: 'ליון',
  olympiquelyonnais: 'ליון',
  monaco: 'מונאקו',
  lille: 'ליל',

  // ── National teams (World Cup / Nations League / Friendlies) ────────────
  england: 'אנגליה',
  spain: 'ספרד',
  germany: 'גרמניה',
  france: 'צרפת',
  italy: 'איטליה',
  portugal: 'פורטוגל',
  netherlands: 'הולנד',
  brazil: 'ברזיל',
  argentina: 'ארגנטינה',
  belgium: 'בלגיה',
  croatia: 'קרואטיה',
  israel: 'ישראל',
};

/**
 * Resolves an ESPN team name to its Hebrew equivalent. Falls back to the
 * original English string when no mapping exists — never blank, never
 * throws. Callers only need to branch on `lang` around the call site, same
 * pattern as tg()/t() elsewhere in this codebase.
 */
export function tTeam(espnName: string): string {
  return TEAMS_HE[normalizeTeamName(espnName)] ?? espnName;
}
