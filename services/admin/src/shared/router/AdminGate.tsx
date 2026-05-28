import { useMeQuery, useUserStore } from '@/entities';
import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';

// admin shell 진입에 필요한 permission. RBAC seeder 의 ROLE_PERMISSIONS 표 기준
// ADMIN 역할에만 부여되는 가장 자연스러운 식별자
export const ADMIN_ENTRY_PERMISSION = 'user:manage';

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useMeQuery();
  const clearAuth = useUserStore((s) => s.clearAuth);

  const denied = !isLoading && (isError || !data?.permissions?.includes(ADMIN_ENTRY_PERMISSION));

  useEffect(() => {
    if (denied) clearAuth();
  }, [denied, clearAuth]);

  if (isLoading) return null;
  if (denied) return <Navigate to="/login?error=not_admin" replace />;
  return <>{children}</>;
}
