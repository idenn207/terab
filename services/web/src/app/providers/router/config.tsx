import { TrustedDeviceSection, TrustThisDeviceCheckbox, TwoFactorApprovalPage, TwoFactorBackupEntry, TwoFactorWaiting } from '@/features';
import {
  BackupCodeIssuePage,
  DevicesPage,
  DrivePage,
  LoginPage,
  RegisterPage,
  SettingsPage,
  TrashPage,
  TwoFAApprovalPage,
  TwoFABackupPage,
  TwoFAWaitPage,
} from '@/pages';
import { AuthLayout, DriveLayout } from '@/widgets';
import { type AppRouteHandle, PrivateRoute } from '@shared/router';
import { Navigate, Outlet, type RouteObject } from 'react-router-dom';
import { AppShell } from '../AppShell';

const rootDestinationHandle: AppRouteHandle = { isRootDestination: true };

const rootRoutes: RouteObject[] = [
  {
    path: '/',
    element: (
      <main>
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
      { index: true, element: <LoginPage />, handle: rootDestinationHandle },
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
    children: [{ index: true, element: <DrivePage />, handle: rootDestinationHandle }],
  },
  {
    path: '/trash',
    element: (
      <PrivateRoute>
        <DriveLayout />
      </PrivateRoute>
    ),
    children: [{ index: true, element: <TrashPage /> }],
  },
  {
    path: '/settings',
    element: (
      <PrivateRoute>
        <DriveLayout />
      </PrivateRoute>
    ),
    children: [
      { index: true, element: <SettingsPage /> },
      { path: 'devices', element: <DevicesPage /> },
    ],
  },
  {
    path: '/2fa/:id',
    element: <TwoFAApprovalPage />,
    handle: rootDestinationHandle,
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
