import { useUserStore, type User } from '@/entities/user';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { axiosBasic } from '../api';

interface LoginResponse {
  accessToken: string;
  user: User;
}

export function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { accessToken, setAuth } = useUserStore();
  const [checking, setChecking] = useState(!accessToken);

  useEffect(() => {
    if (accessToken) return;
    axiosBasic
      .post<LoginResponse>('/api/auth/refresh', {}, { withCredentials: true })
      .then(({ data }) => setAuth(data.accessToken, data.user))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [accessToken, setAuth]);

  if (checking) return null;
  if (!accessToken) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
