import { TrustedDeviceSection, TrustThisDeviceCheckbox, TwoFactorApprovalPage, TwoFactorBackupEntry, TwoFactorWaiting } from '@/features';
import { BackupCodeIssuePage, DrivePage, LoginPage, RegisterPage, TwoFAApprovalPage, TwoFABackupPage, TwoFAWaitPage } from '@/pages';
import { AuthLayout, DriveLayout } from '@/widgets';
import { PrivateRoute } from '@shared/router';
import { Navigate, Outlet, type RouteObject } from 'react-router-dom';
import { AppShell } from '../AppShell';

const rootRoutes: RouteObject[] = [
  {
    path: '/',
    element: (
      <main className="pt-safe-top">
        <Outlet />
      </main>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/login" replace />,
      },
    ],
  },
];

const registerRoutes: RouteObject[] = [
  {
    path: '/register',
    element: <AuthLayout />,
    children: [
      { path: ':token', element: <RegisterPage /> },
      { path: ':token/backup', element: <BackupCodeIssuePage /> },
    ],
  },
];

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

const appRoutes: RouteObject[] = [
  {
    path: '/drive',
    element: (
      <PrivateRoute>
        <DriveLayout />
      </PrivateRoute>
    ),
    children: [{ index: true, element: <DrivePage /> }],
  },
  {
    path: '/2fa/:id',
    element: <TwoFAApprovalPage />,
  },
];

const previewRoutes: RouteObject[] = [
  {
    path: '/preview',
    children: [
      { index: true, element: <TwoFactorWaiting /> },
      { path: '1', element: <TwoFactorApprovalPage /> },
      { path: '2', element: <TwoFactorBackupEntry /> },
      { path: '4', element: <TrustedDeviceSection /> },
      { path: '5', element: <TrustThisDeviceCheckbox checked={false} onChange={() => {}} /> },
    ],
  },
];

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [...rootRoutes, ...registerRoutes, ...authRoutes, ...appRoutes, ...previewRoutes],
  },
];
