import { AdminUsersPage, LoginPage, TwoFABackupPage, TwoFAWaitPage } from '@/pages';
import { AdminGate, PrivateRoute } from '@shared/router';
import { AdminLayout, AuthLayout } from '@/widgets';
import { Navigate, type RouteObject } from 'react-router-dom';
import { AppShell } from '../AppShell';

const rootRoutes: RouteObject[] = [{ path: '/', element: <Navigate to="/admin" replace /> }];

const authRoutes: RouteObject[] = [
  {
    path: '/login',
    element: <AuthLayout />,
    children: [
      { index: true, element: <LoginPage /> },
      { path: '2fa', element: <TwoFAWaitPage /> },
      { path: 'backup', element: <TwoFABackupPage /> },
    ],
  },
];

const adminRoutes: RouteObject[] = [
  {
    path: '/admin',
    element: (
      <PrivateRoute>
        <AdminGate>
          <AdminLayout />
        </AdminGate>
      </PrivateRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/admin/users" replace /> },
      { path: 'users', element: <AdminUsersPage /> },
    ],
  },
];

const fallbackRoutes: RouteObject[] = [{ path: '*', element: <Navigate to="/admin" replace /> }];

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [...rootRoutes, ...authRoutes, ...adminRoutes, ...fallbackRoutes],
  },
];
