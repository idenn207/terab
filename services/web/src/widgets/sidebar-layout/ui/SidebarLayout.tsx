import { SidebarLayout } from '@/shared/ui';
import { Navbar, Sidebar } from '@/widgets';
import { Outlet } from 'react-router-dom';

function sidebarLayout() {
  return <SidebarLayout navbar={<Navbar />} sidebar={<Sidebar />} children={<Outlet />} />;
}

export { sidebarLayout as SidebarLayout };
