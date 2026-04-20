import { TwoFactorApprovalPage, TwoFactorBackupEntry, TwoFactorWaiting } from '@/features';
import { DrivePage, LoginPage } from '@/pages';
import { AuthLayout } from '@/widgets';
import { PrivateRoute } from '@shared/router';
import type { RouteObject } from 'react-router-dom';
import { AppShell } from '../AppShell';

const rootRoutes: RouteObject[] = [
  {
    path: '/',
    children: [
      {
        index: true,
        element: (
          <>
            <ul className="flex flex-col justify-center gap-4 p-6 text-black dark:text-white">
              <a href="/login">login</a>
              <a href="/drive">drive</a>
              <a href="/preview">preview</a>
            </ul>
          </>
        ),
      },
    ],
  },
];

const authRoutes: RouteObject[] = [
  {
    path: '/login',
    element: <AuthLayout />,
    children: [{ index: true, element: <LoginPage /> }],
  },
];

const appRoutes: RouteObject[] = [
  {
    path: '/drive',
    element: (
      <PrivateRoute>
        <DrivePage />
      </PrivateRoute>
    ),
    // element: <SidebarLayout />,
    children: [
      // { index: true, element: <DrivePage /> },
      // { path: ':folderId', element: <div>Drive/:folderId</div> },
    ],
  },
];

const previewRoutes: RouteObject[] = [
  {
    path: '/preview',
    children: [
      { index: true, element: <TwoFactorWaiting onApproved={() => {}} /> },
      { path: '1', element: <TwoFactorApprovalPage /> },
      { path: '2', element: <TwoFactorBackupEntry /> },
    ],
  },
];

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [...rootRoutes, ...authRoutes, ...appRoutes, ...previewRoutes],
  },
];
