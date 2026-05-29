import { Outlet } from 'react-router-dom';

// 데스크탑 전용 admin shell — Capacitor/Splash/StatusBar 분기 없음 (services/web AppShell 미러 후 단순화)
export function AppShell() {
  return <Outlet />;
}
