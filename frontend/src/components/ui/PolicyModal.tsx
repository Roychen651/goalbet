import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2, Ban, Users, Lock, Scale, UserCog, X } from 'lucide-react';
import { useLangStore } from '../../stores/langStore';

interface PolicyModalProps {
  onClose: () => void;
}

// Visual cleanup (live QA) — this list's own icon field used raw emoji
// glyphs; both language arrays share the same icon per index (icons carry
// no language), so the component reference lives once here, in the EN
// array, rather than being duplicated into the HE array below.
const SECTION_ICONS = [Gamepad2, Ban, Users, Lock, Scale, UserCog];

const SECTIONS_EN = [
  { title: 'For Entertainment Only', body: 'GoalBet is a free-to-play social prediction game. No real money is ever wagered, won, or lost. All points are virtual and have no monetary value whatsoever.' },
  { title: 'Not Gambling', body: 'This platform is not a gambling service, betting exchange, or wagering platform. GoalBet does not facilitate or encourage any form of real-money gambling.' },
  { title: 'Social & Fun', body: 'GoalBet is designed to enhance the enjoyment of watching football with friends. Compete privately within your group — all results are for fun only.' },
  { title: 'Privacy', body: 'Your data (name, avatar, predictions) is visible only to members of your group. We do not sell or share personal data with third parties.' },
  { title: 'Fairness', body: 'Predictions lock 15 minutes before kickoff. Points are calculated automatically based on the official final result. All users in a group follow identical rules.' },
  { title: 'Responsibility', body: 'GoalBet is a personal project created for friends. If you encounter any issues, please contact the group administrator. Content and scores are sourced from ESPN public data.' },
];

const SECTIONS_HE = [
  { title: 'לבידור בלבד', body: 'GoalBet הוא משחק ניחוש חברתי וחינמי. לא מהמרים בכסף אמיתי, לא זוכים בו ולא מפסידים אותו. כל הנקודות הן וירטואליות וללא ערך כספי.' },
  { title: 'לא הימורים', body: 'הפלטפורמה אינה שירות הימורים, בורסת הימורים או פלטפורמת ניהול הימורים. GoalBet אינו מאפשר או מעודד כל צורה של הימורים בכסף אמיתי.' },
  { title: 'חברתי וכיפי', body: 'GoalBet נועד להגביר את ההנאה מצפייה בכדורגל עם חברים. התחרות היא פרטית בתוך הקבוצה שלך — הכל לכיף בלבד.' },
  { title: 'פרטיות', body: 'הנתונים שלך (שם, אווטר, ניחושים) גלויים רק לחברי הקבוצה שלך. איננו מוכרים או משתפים מידע אישי עם צדדים שלישיים.' },
  { title: 'הגינות', body: 'הניחושים ננעלים 15 דקות לפני הבעיטה הראשונה. הנקודות מחושבות אוטומטית לפי התוצאה הסופית הרשמית. כל המשתמשים בקבוצה פועלים לפי כללים זהים.' },
  { title: 'אחריות', body: 'GoalBet הוא פרויקט אישי שנוצר לחברים. לכל בעיה, פנה למנהל הקבוצה. תוכן ותוצאות מגיעים ממידע ציבורי של ESPN.' },
];

export function PolicyModal({ onClose }: PolicyModalProps) {
  const { lang } = useLangStore();
  const isHe = lang === 'he';
  const sections = isHe ? SECTIONS_HE : SECTIONS_EN;

  // Lock body scroll + escape any stacking context via portal
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 60, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 60, opacity: 0, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          onClick={e => e.stopPropagation()}
          className="w-full sm:max-w-lg bg-surface border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: 'min(88vh, calc(100svh - 1rem))' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/8 shrink-0">
            <div>
              <h2 className="font-bebas text-xl tracking-widest text-foreground">
                {isHe ? 'מדיניות ותנאים' : 'Policy & Terms'}
              </h2>
              <p className="text-text-muted text-xs mt-0.5">
                {isHe ? 'GoalBet v2.0 — לבידור בלבד' : 'GoalBet v2.0 — Entertainment only'}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label={isHe ? 'סגור' : 'Close'}
              className="w-8 h-8 rounded-full bg-white/8 border border-white/12 flex items-center justify-center text-text-muted hover:text-foreground hover:bg-white/15 transition-colors"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
            {sections.map((s, i) => {
              const Icon = SECTION_ICONS[i];
              return (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 200, damping: 24 }}
                className="flex gap-3 p-3 rounded-xl bg-white/4 border border-white/8"
              >
                <div className="w-8 h-8 rounded-lg bg-accent-green/10 border border-accent-green/20 flex items-center justify-center shrink-0 text-accent-green">
                  <Icon size={16} strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-foreground text-sm font-semibold mb-0.5">{s.title}</p>
                  <p className="text-text-muted text-xs leading-relaxed">{s.body}</p>
                </div>
              </motion.div>
              );
            })}

            <div className="mt-2 p-3 rounded-xl bg-accent-green/8 border border-accent-green/20 text-center">
              <p className="text-accent-green text-xs font-semibold">
                {isHe ? '🎉 GoalBet — שחק, נחש, התחרה. תמיד חינם. תמיד לכיף.' : '🎉 GoalBet — Play. Predict. Compete. Always free. Always fun.'}
              </p>
              <p className="text-text-muted/50 text-[10px] mt-1">© Roy Chen 2026</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
