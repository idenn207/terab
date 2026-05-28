import { AuthLayout as AuthLayoutShell } from '@/shared/ui';
import { Outlet } from 'react-router-dom';

function authLayout() {
  return (
    <AuthLayoutShell>
      <Outlet />
    </AuthLayoutShell>
  );
}

export { authLayout as AuthLayout };
