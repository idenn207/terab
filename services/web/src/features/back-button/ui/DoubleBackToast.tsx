interface DoubleBackToastProps {
  visible: boolean;
}

/**
 * "한 번 더 누르면 종료" 토스트. `useBackButton().pendingExit` 와 연동.
 *
 * `transition-opacity` 만 사용 — layout 토글이 아니라 항상 DOM 에 존재하므로 다시 표시될 때 mount 비용 없음.
 * `pointer-events-none` 으로 토스트 영역의 다른 버튼 클릭 방해 없음.
 */
export function DoubleBackToast({ visible }: DoubleBackToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
      className={
        'pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] z-50 flex justify-center transition-opacity duration-150 ' +
        (visible ? 'opacity-100' : 'opacity-0')
      }
    >
      <div className="rounded-full bg-zinc-900/90 px-4 py-2 text-sm text-white shadow-lg dark:bg-white/90 dark:text-zinc-900">한 번 더 누르면 종료됩니다</div>
    </div>
  );
}
