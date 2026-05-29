import { Heading } from '@/shared/ui';
import { useParams } from 'react-router-dom';
import { useTwoFactorRespond } from '../model/useTwoFactorRespond';

export function TwoFactorApprovalPage() {
  const { id: challengeId = '' } = useParams<{ id: string }>();
  const { options, respondStatus, respond } = useTwoFactorRespond(challengeId);

  if (respondStatus === 'loading') {
    return (
      <section className="gap-gutter py-section flex w-full max-w-sm flex-col items-center">
        <p aria-live="polite" className="text-text-muted text-base">
          불러오는 중...
        </p>
      </section>
    );
  }

  if (respondStatus === 'expired') {
    return (
      <section className="gap-gutter py-section flex w-full max-w-sm flex-col items-center text-center">
        <Heading level={1}>요청이 만료되었습니다</Heading>
        <p role="alert" className="text-danger text-base">
          PC 에서 다시 로그인을 시도해 주세요.
        </p>
      </section>
    );
  }

  if (respondStatus === 'done') {
    return (
      <section className="gap-gutter py-section flex w-full max-w-sm flex-col items-center text-center">
        <p role="status" className="text-success text-2xl font-semibold">
          선택 완료
        </p>
        <p className="text-text-muted text-base">PC 화면에서 결과를 확인하세요.</p>
      </section>
    );
  }

  return (
    <section className="gap-gutter py-section flex w-full max-w-sm flex-col">
      <header className="flex flex-col gap-2 text-center">
        <Heading level={1}>로그인 승인</Heading>
        <p className="text-text-muted text-base">PC 화면에 표시된 숫자를 선택해 주세요.</p>
      </header>

      <div role="group" aria-label="승인 번호 선택" className="mx-auto flex gap-4">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => respond(opt)}
            className="bg-surface-elevated text-text border-border-strong hover:bg-accent-soft hover:border-accent active:bg-accent-soft focus-visible:ring-accent duration-fast flex h-20 w-20 items-center justify-center rounded-xl border text-2xl font-semibold shadow-sm transition-colors ease-out focus-visible:ring-2 focus-visible:outline-none"
          >
            {opt}
          </button>
        ))}
      </div>
    </section>
  );
}
