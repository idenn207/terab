import { DrivePage, LoginPage, NavbarPage, SidebarLayoutPage, SidebarPage } from '@/pages';
import { AuthLayout } from '@/widgets';
import type { RouteObject } from 'react-router-dom';

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
              <a href="/test">test</a>
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
    element: <DrivePage />,
    // element: <SidebarLayout />,
    children: [
      // { index: true, element: <DrivePage /> },
      // { path: ':folderId', element: <div>Drive/:folderId</div> },
    ],
  },
];

const testRoutes: RouteObject[] = [
  {
    path: '/test',
    children: [
      {
        index: true,
        element: (
          <>
            <ul className="flex flex-col justify-center gap-4 p-6 text-black dark:text-white">
              <a href="/test/navbar">Navbar</a>
              <a href="/test/sidebar">Sidebar</a>
              <a href="/test/layout">Layouts</a>
            </ul>
          </>
        ),
      },
      { path: 'navbar', element: <NavbarPage /> },
      { path: 'sidebar', element: <SidebarPage /> },
      {
        path: 'layout',
        children: [
          {
            index: true,
            element: (
              <>
                <ul className="flex flex-col justify-center gap-4 p-6 text-black dark:text-white">
                  <a href="/test/layout/sidebar">Sidebar Layout</a>
                </ul>
              </>
            ),
          },
          { path: 'sidebar', element: <SidebarLayoutPage /> },
        ],
      },
    ],
  },
];

export const routes: RouteObject[] = [...rootRoutes, ...authRoutes, ...appRoutes, ...testRoutes];
