import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useInvite } from '../model/useInvite';

interface InviteFormValues {
  expiresInDays: number;
}

const DEFAULT_EXPIRES_IN_DAYS = 7;
const MIN_EXPIRES = 1;
const MAX_EXPIRES = 30;

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
}

export function InviteDialog({ open, onClose }: InviteDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { invitation, isLoading, errorMessage, invite, reset } = useInvite();
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset: resetForm,
  } = useForm<InviteFormValues>({ defaultValues: { expiresInDays: DEFAULT_EXPIRES_IN_DAYS } });

  // open prop 과 native <dialog> 의 open 속성 동기화. cleanup 은 handleClose 가 담당 —
  // useEffect 안의 setState 호출은 react-compiler/cascading-renders 위반이므로 단일 진입점에서만.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClose = () => {
    reset();
    resetForm({ expiresInDays: DEFAULT_EXPIRES_IN_DAYS });
    setCopied(false);
    onClose();
  };

  const onSubmit = (values: InviteFormValues) => {
    invite(values.expiresInDays);
  };

  const handleCopy = async () => {
    if (!invitation) return;
    try {
      await navigator.clipboard.writeText(invitation.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      className="w-full max-w-md rounded-md border border-zinc-200 bg-white p-6 text-zinc-900 shadow-lg backdrop:bg-zinc-950/60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
    >
      <div className="flex flex-col gap-4">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">사용자 초대</h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="닫기"
            className="-mt-2 -mr-2 rounded-md p-2 text-zinc-500 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-700 focus-visible:outline-none dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            ×
          </button>
        </header>

        {invitation ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">아래 링크를 새 사용자에게 전달하세요.</p>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs break-all dark:border-zinc-800 dark:bg-zinc-900">
              {invitation.url}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">만료: {new Date(invitation.expiresAt).toLocaleString('ko-KR')}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-700 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {copied ? '복사됨' : '링크 복사'}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-700 focus-visible:ring-offset-2 focus-visible:outline-none dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                닫기
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="invite-expires-in-days" className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                만료 기간 (일)
              </label>
              <input
                id="invite-expires-in-days"
                type="number"
                min={MIN_EXPIRES}
                max={MAX_EXPIRES}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-700 focus-visible:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                {...register('expiresInDays', {
                  required: '만료 기간을 입력해 주세요.',
                  valueAsNumber: true,
                  min: { value: MIN_EXPIRES, message: `최소 ${MIN_EXPIRES}일` },
                  max: { value: MAX_EXPIRES, message: `최대 ${MAX_EXPIRES}일` },
                })}
              />
              {errors.expiresInDays?.message && (
                <p role="alert" className="text-xs text-red-500">
                  {errors.expiresInDays.message}
                </p>
              )}
            </div>
            {errorMessage && (
              <p role="alert" className="text-sm text-red-500">
                {errorMessage}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-700 focus-visible:ring-offset-2 focus-visible:outline-none dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-700 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {isLoading ? '생성 중...' : '초대 링크 생성'}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
