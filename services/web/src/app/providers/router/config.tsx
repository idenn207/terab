import { TrustedDeviceSection, TrustThisDeviceCheckbox, TwoFactorApprovalPage, TwoFactorBackupEntry, TwoFactorWaiting } from '@/features';
import { BackupCodeIssuePage, DrivePage, Link2TwoFAAuth, LoginPage, RegisterPage, TwoFAApprovalPage, TwoFABackupPage, TwoFAWaitPage } from '@/pages';
import { AuthLayout } from '@/widgets';
import { PrivateRoute } from '@shared/router';
import { Outlet, type RouteObject } from 'react-router-dom';
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
        element: (
          <>
            <ul className="flex flex-col justify-center gap-4 p-6 text-black dark:text-white">
              <a href="/login">login</a>
              <a href="/drive">drive</a>
              <a href="/preview">preview</a>
              <a href="/preview/2fa-auth">2fa auth</a>
            </ul>
          </>
        ),
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
        <Link2TwoFAAuth />
        <DrivePage />
      </PrivateRoute>
    ),
    // element: <SidebarLayout />,
    children: [
      // { index: true, element: <DrivePage /> },
      // { path: ':folderId', element: <div>Drive/:folderId</div> },
    ],
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
      { path: '2fa-auth', element: <Link2TwoFAAuth /> },
    ],
  },
];

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [...rootRoutes, ...registerRoutes, ...authRoutes, ...appRoutes, ...previewRoutes],
  },
];
