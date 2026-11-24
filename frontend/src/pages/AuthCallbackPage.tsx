import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ROUTES } from '../lib/constants';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { withAuthTimeout } from '../lib/asyncTimeout';

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Google's OAuth redirect lands here. This getSession() call had NO
    // timeout at all — live-reported Nov 2026, as a second stuck-forever
    // symptom in the exact same Google sign-in journey AFTER the login
    // page's own gap (the Google button never completing its redirect) was
    // already fixed: a slow/unresponsive Supabase auth service left a user
    // stuck on this page's bare "Signing you in..." spinner indefinitely,
    // with zero recovery. Same discipline as every other direct
    // supabase.auth.* call in this codebase — race against a bounded
    // timeout and always land somewhere real.
    // withAuthTimeout's synthetic timeout result carries only `error`, no
    // `data` (asyncTimeout.ts) — read `data?.session` defensively rather
    // than destructuring, which would otherwise throw on `undefined` and
    // leave this page stuck a second way (navigate() never called).
    withAuthTimeout(supabase.auth.getSession()).then((result) => {
      const session = result.data?.session ?? null;
      navigate(session ? ROUTES.HOME : ROUTES.LOGIN, { replace: true });
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
