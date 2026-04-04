import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { PageLoader } from '../ui/LoadingSpinner';

const SUPER_ADMIN_EMAIL = 'roychen651@gmail.com';

/** Double-layered guard: client checks email, all Supabase RPCs also verify server-side. */
export function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, initialized } = useAuthStore();

  if (!initialized || loading) return <PageLoader />;

  // Silently redirect non-admins — never reveal the admin route exists
  if (!user || user.email !== SUPER_ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
