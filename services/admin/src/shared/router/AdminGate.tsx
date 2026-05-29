import { useMeQuery, useUserStore } from '@/entities';
import { logger } from '@/shared/lib';
import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';

// admin shell 진입에 필요한 permission. RBAC seeder 의 ROLE_PERMISSIONS 표 기준
// ADMIN 역할에만 부여되는 가장 자연스러운 식별자
export const ADMIN_ENTRY_PERMISSION = 'user:manage';

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useMeQuery();
  const clearAuth = useUserStore((s) => s.clearAuth);

  const permissions = data?.permissions;
  const isPermissionsValid = Array.isArray(permissions);
  const hasAdminPermission = isPermissionsValid && permissions.includes(ADMIN_ENTRY_PERMISSION);
  const denied = !isLoading && (isError || !hasAdminPermission);

  useEffect(() => {
    // permissions 필드 누락은 API 회귀의 신호 — silent lockout 을 피하기 위해 운영자 진단 로그를 남긴다.
    // data 값 자체는 userId 등 PII 포함 가능성이라 key 만 인용한다.
    if (data && !isPermissionsValid) {
      logger.error({ keys: Object.keys(data) }, 'AdminGate: permissions field missing or non-array');
    }
  }, [data, isPermissionsValid]);

  useEffect(() => {
    if (denied) clearAuth();
  }, [denied, clearAuth]);

  if (isLoading) return null;
  if (denied) return <Navigate to="/login?error=not_admin" replace />;
  return <>{children}</>;
}
