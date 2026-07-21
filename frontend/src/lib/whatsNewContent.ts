// V5 Sprint 38 — "The Epoch Showcase". Static, bilingual content describing
// what's shipped since the start of the V3 architecture — extracted from
// CLAUDE.md's own sprint history, not live data. Zero DB/RPC involvement:
// this is a marketing/onboarding surface over already-shipped features, the
// same "no backend needed for static historical content" shape as
// lib/worldCup2026.ts's static tournament data.
//
// Flat sibling-key bilingual fields (title/titleHe, desc/descHe) rather than
// nested {en,he} objects — matches FOOTBALL_LEAGUES' established
// name/nameHe convention (lib/constants.ts) rather than inventing a second
// bilingual shape. Long-form copy lives HERE, not in the i18n.ts
// TranslationKey union — that union is for short UI chrome (button labels,
// aria strings), and a dozen paragraph-length keys would bloat it for a
// feature with no other consumer.
//
// V6 Sprint 48 — backfill pass. This file had silently stopped being
// updated after Sprint 37 (the "social" era below) — every real feature
// shipped from Sprint 38 onward (including the Epoch Showcase itself) was
// missing from the one surface meant to announce it to users. Flagged
// directly by the user, not caught proactively. Fixed by: (1) adding a
// real per-FEATURE `date` field (ISO, real git merge dates — never
// invented, pulled from `git log` on `main`, since features within one
// thematic era can genuinely ship days apart), (2) removing "Live
// Pressure Meter" — a feature this exact content advertised as current
// that was deleted from the app after live user feedback ("it clutters
// the card") and no longer exists (see CLAUDE.md §47), (3) adding three
// new eras covering everything real that shipped since. Going forward:
// any sprint that ships a genuinely new, user-facing capability belongs
// here in the same PR that ships it — not as a follow-up someone has to
// remember to ask for.
export const CURRENT_SHOWCASE_VERSION = 'v6-epoch';

const STORAGE_KEY = 'goalbet_whats_new_seen';

export function hasSeenCurrentShowcase(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === CURRENT_SHOWCASE_VERSION;
  } catch {
    // Safari private mode / storage disabled — never block the app on this.
    return true;
  }
}

export function markShowcaseSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, CURRENT_SHOWCASE_VERSION);
  } catch {
    // Same graceful-degradation shape as lib/push.ts/lib/tiltPermission.ts —
    // a storage failure here just means the showcase might reappear next
    // load, never a thrown error blocking the rest of the app.
  }
}

export type EpochEraId = 'experience' | 'analytics' | 'social' | 'broadcast' | 'identity' | 'global';

export interface EpochFeature {
  icon:
    | 'sparkles' | 'zap' | 'heart' | 'radar' | 'activity' | 'brain-circuit' | 'swords' | 'coins' | 'gem' | 'link'
    | 'flame' | 'radio' | 'trending-up' | 'target' | 'fingerprint' | 'calendar-days' | 'trophy' | 'copy' | 'crosshair' | 'globe' | 'award';
  title: string;
  titleHe: string;
  desc: string;
  descHe: string;
  /** ISO date (YYYY-MM-DD) — the real date this feature merged to main.
   *  Pulled from `git log`, never invented. Rendered locale-aware
   *  ('he-IL'/'en-US') in WhatsNewModal.tsx. */
  date: string;
}

export interface EpochEra {
  id: EpochEraId;
  emoji: string;
  title: string;
  titleHe: string;
  subtitle: string;
  subtitleHe: string;
  colorToken: string; // CSS var name, resolved in the component — never hardcoded hex
  features: EpochFeature[];
}

// Content grouped by THEME across the V3→V6 timeline, not strictly by
// version number — several "experience" overhauls (Leaderboard, Profile,
// Notifications) shipped under the V4 numbering in CLAUDE.md, and the
// Oracle/Momentum analytics work spans V4→V5. The copy below never claims a
// specific version number it can't back up; only the era label does.
export const EPOCH_ERAS: EpochEra[] = [
  {
    id: 'experience',
    emoji: '🎨',
    title: 'The New Experience',
    titleHe: 'החוויה החדשה',
    subtitle: 'A total glass-morphic overhaul, built for touch',
    subtitleHe: 'שיפוץ עיצובי מהיסוד, בנוי למגע',
    colorToken: '--epoch-experience',
    features: [
      {
        icon: 'zap',
        title: 'Tactile Everything',
        titleHe: 'מרגישים כל לחיצה',
        desc: 'Real haptics and sound on every tap — placing a bet finally feels like locking something in.',
        descHe: 'רטט וצליל אמיתיים על כל לחיצה — סוף סוף הימור מרגיש כמו החלטה אמיתית.',
        date: '2026-07-14',
      },
      {
        icon: 'sparkles',
        title: 'A Leaderboard That Breathes',
        titleHe: 'טבלה שנושמת',
        desc: 'Rank changes morph and slide instead of jumping, with a real gold halo for whoever sits at #1.',
        descHe: 'שינויי דירוג מחליקים במקום לקפוץ, עם הילת זהב אמיתית למי שבמקום הראשון.',
        date: '2026-07-15',
      },
      {
        icon: 'heart',
        title: 'Native Hebrew, Not Translated',
        titleHe: 'עברית אמיתית, לא מתורגמת',
        desc: 'Real Israeli sports slang, gendered copy, and full RTL — built for Hebrew from the ground up.',
        descHe: 'סלנג ספורט ישראלי אמיתי, ניסוח מגדרי, ותמיכת RTL מלאה — בנוי מהיסוד בשביל עברית.',
        date: '2026-07-15',
      },
    ],
  },
  {
    id: 'analytics',
    emoji: '🧠',
    title: 'The Analytical Mind',
    titleHe: 'המוח האנליטי',
    subtitle: 'Real historical stats and honest numbers',
    subtitleHe: 'סטטיסטיקה היסטורית אמיתית ומספרים כנים',
    colorToken: '--epoch-analytics',
    features: [
      {
        icon: 'radar',
        title: 'The Oracle',
        titleHe: 'האורקל',
        desc: "Real historical form for both teams — never a guessed number, and honest when there's not enough data yet.",
        descHe: 'פורמה היסטורית אמיתית לשתי הקבוצות — בלי ניחושים, ובכנות כשאין עדיין מספיק נתונים.',
        date: '2026-07-16',
      },
      {
        icon: 'brain-circuit',
        title: 'AI Match Narration',
        titleHe: 'ניתוח AI למשחק',
        desc: 'Sharp, punchy pre-match and half-time reads — generated once, served instantly, every time.',
        descHe: 'תובנות חדות לפני המשחק ובמחצית, זמינות מיד כשאתם צריכים אותן.',
        date: '2026-04-19',
      },
    ],
  },
  {
    id: 'social',
    emoji: '⚔️',
    title: 'The Social Syndicate',
    titleHe: 'הסינדיקט',
    subtitle: 'Bet together, battle other groups, flex your style',
    subtitleHe: 'הימרו ביחד, התמודדו מול קבוצות אחרות, תציגו סטייל',
    colorToken: '--epoch-social',
    features: [
      {
        icon: 'link',
        title: 'Same-Match Parlays',
        titleHe: 'שילובים באותו משחק',
        desc: 'Chain 2-3 of your own picks on one match for a compounding bonus when they all hit.',
        descHe: 'שרשרו 2-3 מהתחזיות שלכם באותו משחק, ותקבלו בונוס מצטבר כשכולן קולעות.',
        date: '2026-07-16',
      },
      {
        icon: 'coins',
        title: 'Shared Coin Pools',
        titleHe: 'קופות משותפות',
        desc: 'Pool coins with your whole group behind one shared prediction — win together, split the payout fairly.',
        descHe: 'אספו מטבעות עם כל הקבוצה מאחורי תחזית אחת משותפת — תנצחו ביחד, ותחלקו את הזכייה בהגינות.',
        date: '2026-07-17',
      },
      {
        icon: 'swords',
        title: 'Group Battles',
        titleHe: 'קרבות קבוצות',
        desc: "Challenge a rival group via their invite code — whoever's top 5 score higher over the week wins.",
        descHe: 'אתגרו קבוצה יריבה דרך קוד ההזמנה שלה — הקבוצה עם חמשת השחקנים הכי חזקים באותו שבוע מנצחת.',
        date: '2026-07-17',
      },
      {
        icon: 'gem',
        title: 'Prestige Shop',
        titleHe: 'חנות היוקרה',
        desc: 'Purchase frames, halos, and prestige badges for your avatar — a real coin sink, purely cosmetic.',
        descHe: 'רכשו מסגרות, הילות ותגי יוקרה לאווטאר שלכם — משהו אמיתי לבזבז עליו מטבעות, קוסמטי בלבד.',
        date: '2026-07-18',
      },
    ],
  },
  {
    id: 'broadcast',
    emoji: '🔥',
    title: 'The Live Broadcast',
    titleHe: 'השידור החי',
    subtitle: 'A live match, live — reactions, commentary, and instant alerts',
    subtitleHe: 'משחק חי, בזמן אמת — תגובות, פרשנות והתראות מיידיות',
    colorToken: '--epoch-broadcast',
    features: [
      {
        icon: 'flame',
        title: 'Live Reactions',
        titleHe: 'ריאקציות בזמן אמת',
        desc: 'Tap 🔥😮🤫 during a live match and watch your whole group\'s reactions rise across the card, live.',
        descHe: 'לחצו על 🔥😮🤫 במהלך משחק חי ותראו את התגובות של כל הקבוצה עולות על הכרטיסייה, בזמן אמת.',
        date: '2026-07-18',
      },
      {
        icon: 'radio',
        title: 'Live AI Commentary',
        titleHe: 'פרשנות AI חיה',
        desc: 'A short, sharp AI line the moment a goal, card, or substitution actually happens — not a generic recap.',
        descHe: 'שורת AI קצרה וחדה ברגע שגול, כרטיס או חילוף קורים בפועל — לא סיכום גנרי.',
        date: '2026-07-20',
      },
      {
        icon: 'trending-up',
        title: 'Overtake Alerts',
        titleHe: 'התראות עקיפה',
        desc: 'The instant someone passes you on the leaderboard mid-match, you feel it — a toast, a haptic, a sound.',
        descHe: 'ברגע שמישהו עוקף אתכם בטבלה באמצע משחק, תרגישו את זה — הודעה, רטט וצליל.',
        date: '2026-07-21',
      },
    ],
  },
  {
    id: 'identity',
    emoji: '🧬',
    title: 'Your Predictor DNA',
    titleHe: 'ה-DNA שלכם כמנחשים',
    subtitle: 'Deep stats on how you actually play, and who\'s topping the group',
    subtitleHe: 'סטטיסטיקה עמוקה על איך אתם באמת משחקים, ומי מוביל בקבוצה',
    colorToken: '--epoch-identity',
    features: [
      {
        icon: 'target',
        title: 'The Scout Report',
        titleHe: 'דוח הסקאוט',
        desc: "Tap anyone's leaderboard row for their real per-tier accuracy — Result, Score, Corners, BTTS, all broken down.",
        descHe: 'לחצו על השורה של כל שחקן בטבלה לדיוק אמיתי לפי כל שכבת ניחוש — תוצאה, סקור, קרנות, BTTS, הכל מפורק.',
        date: '2026-07-19',
      },
      {
        icon: 'fingerprint',
        title: 'Your Playstyle Badge',
        titleHe: 'תג הסגנון שלכם',
        desc: 'A real badge computed from your own picks — Prophet, Tactician, Anchor, or Maverick — earned, never assigned.',
        descHe: 'תג אמיתי שמחושב מהניחושים שלכם — נביא, טקטיקן, עוגן או פרא — נצבר, לא מוענק סתם.',
        date: '2026-07-20',
      },
      {
        icon: 'calendar-days',
        title: 'Activity Heatmap',
        titleHe: 'מפת חום פעילות',
        desc: 'A 12-week grid of your own prediction activity, colored by how well those picks did.',
        descHe: 'רשת של 12 שבועות מפעילות הניחושים שלכם, צבועה לפי כמה הניחושים האלה הצליחו.',
        date: '2026-07-20',
      },
      {
        icon: 'trophy',
        title: 'Weekly Podium',
        titleHe: 'פודיום שבועי',
        desc: "A real 3D podium for your group's top 3 this week — tap to open it, share your spot if you're on it.",
        descHe: 'פודיום תלת-ממדי אמיתי לשלושת הראשונים בקבוצה שלכם השבוע — פתחו אותו, שתפו אם הגעתם.',
        date: '2026-07-21',
      },
    ],
  },
  {
    id: 'global',
    emoji: '🌍',
    title: 'The Global Economy',
    titleHe: 'הכלכלה הגלובלית',
    subtitle: 'Copy the sharpest picks, duel a friend, climb a real global ladder',
    subtitleHe: 'העתיקו את הניחושים החדים ביותר, אתגרו חבר, טפסו בסולם גלובלי אמיתי',
    colorToken: '--epoch-global',
    features: [
      {
        icon: 'copy',
        title: 'Copy a Locked Pick',
        titleHe: 'העתיקו ניחוש נעול',
        desc: "Tail a group-mate's locked prediction with one tap — you never see their actual pick, only that they made one.",
        descHe: 'העתיקו בלחיצה אחת ניחוש נעול של חבר קבוצה — לעולם לא תראו מה בדיוק הם ניחשו, רק שהם ניחשו.',
        date: '2026-07-21',
      },
      {
        icon: 'crosshair',
        title: 'Live 1v1 Duels',
        titleHe: 'קרבות 1 על 1 בזמן אמת',
        desc: 'Challenge a friend to a real-time coin duel on any live match — next goal wins, coins on the line.',
        descHe: 'אתגרו חבר לקרב מטבעות בזמן אמת על כל משחק חי — הגול הבא מכריע, מטבעות על הכף.',
        date: '2026-07-21',
      },
      {
        icon: 'globe',
        title: 'The Global Arena',
        titleHe: 'הזירה הגלובלית',
        desc: 'A cross-group ladder — Bronze to Diamond — ranked by average points per pick, not raw volume. Promotes weekly.',
        descHe: 'סולם חוצה-קבוצות — מארד עד יהלום — מדורג לפי ממוצע נקודות לניחוש, לא נפח גולמי. קידום כל שבוע.',
        date: '2026-07-21',
      },
      {
        icon: 'award',
        title: 'Knockout Bonus',
        titleHe: 'בונוס נוקאאוט',
        desc: 'Real bonus points for a correct call on a real knockout match — bigger the deeper the round, up to +15 in a final.',
        descHe: 'נקודות בונוס אמיתיות על ניחוש נכון במשחק נוקאאוט אמיתי — ככל שהשלב עמוק יותר, הבונוס גדול יותר, עד +15 בגמר.',
        date: '2026-07-21',
      },
    ],
  },
];
