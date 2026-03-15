import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ROUTES } from '../lib/constants';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate(ROUTES.HOME, { replace: true });
      } else {
        navigate(ROUTES.LOGIN, { replace: true });
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-text-muted text-sm">Signing you in...</p>
      </div>
    </div>
  );
}
