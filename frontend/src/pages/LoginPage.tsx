import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useLangStore } from '../stores/langStore';
import { ROUTES } from '../lib/constants';
import { AuthContainer } from '../components/auth-v2/AuthContainer';
import { SEO } from '../components/seo/SEO';

const SEO_COPY = {
  en: {
    title: 'Login — Join the Game',
    description:
      'GoalBet is the free football prediction game for friend groups. '
      + 'Predict Premier League, Champions League & more. Sign up free and start winning.',
  },
  he: {
    title: 'כניסה — הצטרף למשחק',
    description:
      'GoalBet — משחק ניחוש כדורגל חינמי לחברים. '
      + 'נחש תוצאות ליגת האלופות, הפרמייר ליג ועוד. הירשם בחינם וצבור נקודות.',
  },
};

export function LoginPage() {
  const { user, loading } = useAuthStore();
  const { lang } = useLangStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate(ROUTES.HOME, { replace: true });
  }, [user, loading, navigate]);

  const copy = SEO_COPY[lang] ?? SEO_COPY.en;

  return (
    <>
      <SEO
        title={copy.title}
        description={copy.description}
        url="https://goalbet.vercel.app/login"
        lang={lang}
      />
      <AuthContainer />
    </>
  );
}
