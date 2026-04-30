import { useUserStore } from '@/entities';
import { useNavigate } from 'react-router-dom';
import { useLogoutMutation } from '../api/mutation';

export function useLogout() {
  const navigate = useNavigate();
  const clearAuth = useUserStore((s) => s.clearAuth);
  const mutation = useLogoutMutation();

  const logout = () => {
    mutation.mutate(
      { body: {} },
      {
        onSettled: () => {
          clearAuth();
          navigate('/login');
        },
      },
    );
  };

  return { logout };
}
