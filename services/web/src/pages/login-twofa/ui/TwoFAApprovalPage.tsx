import { TwoFactorApprovalPage as ApprovalView } from '@/features';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function TwoFAApprovalPage() {
  const navigate = useNavigate();

  const close = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/drive');
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="2단계 인증"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl dark:bg-zinc-900">
        <button
          type="button"
          onClick={close}
          aria-label="닫기"
          className="absolute top-3 right-3 inline-flex h-12 w-12 items-center justify-center rounded-full text-2xl text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800"
        >
          ×
        </button>
        <ApprovalView />
      </div>
    </div>
  );
}
