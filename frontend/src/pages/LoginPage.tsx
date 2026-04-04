import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ROUTES } from '../lib/constants';
import { AuthContainer } from '../components/auth-v2/AuthContainer';

export function LoginPage() {
  const { user, loading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate(ROUTES.HOME, { replace: true });
  }, [user, loading, navigate]);

  return <AuthContainer />;
}
