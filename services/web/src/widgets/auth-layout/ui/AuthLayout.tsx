import { AuthLayout } from '@/shared/ui';
import { Outlet } from 'react-router-dom';

function authLayout() {
  return (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  );
}

export { authLayout as AuthLayout };
