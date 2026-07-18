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

// Bump this string whenever a NEW showcase ships (V6, V7, ...) — a single
// versioned key, not a boolean "have they seen it" flag, so a returning user
// automatically sees the next showcase without a brand-new localStorage key
// (and a brand-new one-off flag name) being invented every time.
export const CURRENT_SHOWCASE_VERSION = 'v5-epoch';

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

export type EpochEraId = 'experience' | 'analytics' | 'social';

export interface EpochFeature {
  icon: 'sparkles' | 'zap' | 'heart' | 'radar' | 'activity' | 'brain-circuit' | 'swords' | 'coins' | 'gem' | 'link';
  title: string;
  titleHe: string;
  desc: string;
  descHe: string;
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

// Content grouped by THEME across the V3→V5 timeline, not strictly by
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
    subtitleHe: 'שיפוץ ויזואלי מקיף, בנוי למגע',
    colorToken: '--epoch-experience',
    features: [
      {
        icon: 'zap',
        title: 'Tactile Everything',
        titleHe: 'תחושה בכל מגע',
        desc: 'Real haptics and sound on every tap — placing a bet finally feels like locking something in.',
        descHe: 'רטט וסאונד אמיתיים על כל לחיצה — הימור סוף סוף מרגיש כמו נעילה של החלטה.',
      },
      {
        icon: 'sparkles',
        title: 'A Leaderboard That Breathes',
        titleHe: 'טבלה שנושמת',
        desc: 'Rank changes morph and slide instead of jumping, with a real gold halo for whoever sits at #1.',
        descHe: 'שינויי דירוג מחליקים ולא קופצים, עם הילה זהובה אמיתית למי שיושב במקום הראשון.',
      },
      {
        icon: 'heart',
        title: 'Native Hebrew, Not Translated',
        titleHe: 'עברית טבעית, לא מתורגמת',
        desc: 'Real Israeli sports slang, gendered copy, and full RTL — built for Hebrew from the ground up.',
        descHe: 'סלנג ספורט ישראלי אמיתי, ניסוח מגדרי, ותמיכת RTL מלאה — בנוי בשביל עברית מהיסוד.',
      },
    ],
  },
  {
    id: 'analytics',
    emoji: '🧠',
    title: 'The Analytical Mind',
    titleHe: 'המוח האנליטי',
    subtitle: 'Real historical stats, live momentum, honest numbers',
    subtitleHe: 'סטטיסטיקה היסטורית אמיתית, מומנטום חי, מספרים כנים',
    colorToken: '--epoch-analytics',
    features: [
      {
        icon: 'radar',
        title: 'The Oracle',
        titleHe: 'האורקל',
        desc: "Real historical form for both teams — never a guessed number, and honest when there's not enough data yet.",
        descHe: 'פורמה היסטורית אמיתית לשתי הקבוצות — אף פעם לא מספר מנוחש, וכן כשאין עדיין מספיק נתונים.',
      },
      {
        icon: 'activity',
        title: 'Live Pressure Meter',
        titleHe: 'מד לחץ בזמן אמת',
        desc: 'A live read on which team is attacking harder right now, built from real match data — not a fabricated curve.',
        descHe: 'קריאה חיה על איזו קבוצה תוקפת יותר עכשיו, בנויה מנתוני משחק אמיתיים — לא עקומה מומצאת.',
      },
      {
        icon: 'brain-circuit',
        title: 'AI Match Narration',
        titleHe: 'ניתוח AI למשחק',
        desc: 'Sharp, punchy pre-match and half-time reads — generated once, served instantly, every time.',
        descHe: 'תובנות חדות לפני המשחק ובמחצית — נוצרות פעם אחת, מוגשות מיידית, בכל פעם.',
      },
    ],
  },
  {
    id: 'social',
    emoji: '⚔️',
    title: 'The Social Syndicate',
    titleHe: 'הסינדיקט החברתי',
    subtitle: 'Bet together, battle other groups, flex your style',
    subtitleHe: 'הימרו ביחד, קרבו מול קבוצות אחרות, תציגו סטייל',
    colorToken: '--epoch-social',
    features: [
      {
        icon: 'link',
        title: 'Same-Match Parlays',
        titleHe: 'שילובים באותו משחק',
        desc: 'Chain 2-3 of your own picks on one match for a compounding bonus when they all hit.',
        descHe: 'שרשרו 2-3 מהתחזיות שלכם באותו משחק לבונוס מצטבר כשכולן קולעות.',
      },
      {
        icon: 'coins',
        title: 'Shared Coin Pools',
        titleHe: 'קופות משותפות',
        desc: 'Pool coins with your whole group behind one shared prediction — win together, split the payout fairly.',
        descHe: 'אספו מטבעות עם כל הקבוצה מאחורי תחזית אחת משותפת — נצחו ביחד, חלקו את הזכייה בהגינות.',
      },
      {
        icon: 'swords',
        title: 'Group Battles',
        titleHe: 'קרבות קבוצות',
        desc: "Challenge a rival group via their invite code — whoever's top 5 score higher over the week wins.",
        descHe: 'אתגרו קבוצה יריבה דרך קוד ההזמנה שלה — מי שחמישיית הפותחות שלה תצבור יותר נקודות במהלך השבוע מנצח.',
      },
      {
        icon: 'gem',
        title: 'Prestige Shop',
        titleHe: 'חנות היוקרה',
        desc: 'Purchase frames, halos, and prestige badges for your avatar — a real coin sink, purely cosmetic.',
        descHe: 'רכשו מסגרות, הילות ותגי יוקרה לאווטאר שלכם — יעד אמיתי למטבעות, קוסמטי בלבד.',
      },
    ],
  },
];
