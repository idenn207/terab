import { useUserStore } from '@/entities';
import { useNavigate } from 'react-router-dom';
import { logoutApi } from '../api/logoutApi';

export function useLogout() {
  const navigate = useNavigate();
  const clearAuth = useUserStore((s) => s.clearAuth);

  const logout = async () => {
    try {
      await logoutApi.logout();
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

  return { logout };
}
