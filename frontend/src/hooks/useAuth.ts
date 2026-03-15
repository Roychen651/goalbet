import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

export function useAuth() {
  const { user, session, profile, loading, initialized, signInWithGoogle, signOut, init } = useAuthStore();

  useEffect(() => {
    const cleanup = init();
    return cleanup;
  }, []);

  return { user, session, profile, loading, initialized, signInWithGoogle, signOut };
}
