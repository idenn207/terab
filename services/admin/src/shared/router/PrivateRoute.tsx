import { useUserStore, type User } from '@/entities';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { axiosInstance } from '../api';

interface RefreshResponse {
  accessToken: string;
  user: User;
}

export function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { accessToken, setAuth } = useUserStore();
  const [checking, setChecking] = useState(!accessToken);

  useEffect(() => {
    if (accessToken) return;
    // refresh 는 public path 이므로 interceptor 가 Authorization 헤더를 부착하지 않고,
    // 401 시 자동 retry 도 발동하지 않는다. 새 탭/새로고침에서 silent 재인증 시도.
    axiosInstance
      .post<RefreshResponse>('/auth/refresh', {})
      .then(({ data }) => setAuth(data.accessToken, data.user))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [accessToken, setAuth]);

  if (checking) return null;
  if (!accessToken) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
