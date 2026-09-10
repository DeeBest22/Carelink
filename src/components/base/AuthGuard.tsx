import { useEffect, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';

interface AuthGuardProps {
  role: 'patient' | 'provider';
  children: ReactNode;
}

export default function AuthGuard({ role, children }: AuthGuardProps) {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: '/auth', replace: true });
      return;
    }
    if (profile && profile.role !== role) {
      navigate({ to: profile.role === 'patient' ? '/patient' : '/provider', replace: true });
    }
  }, [loading, user, profile, role, navigate]);

  if (loading || !user || (profile && profile.role !== role)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background-50">
        <div className="w-11 h-11 rounded-xl bg-primary-500 text-white flex items-center justify-center">
          <i className="ri-heart-pulse-line text-xl animate-pulse"></i>
        </div>
        <p className="text-sm text-foreground-500">Loading your dashboard…</p>
      </div>
    );
  }

  return <>{children}</>;
}
