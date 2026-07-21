import { useMountCredentialListQuery, useMyDriveQuery } from '@/entities';
import { IssueMountCredentialButton, RevokeMountCredentialButton } from '@/features';

function formatIqn(iqn: unknown): string {
  if (typeof iqn === 'string') return iqn;
  if (iqn == null) return '—';
  return JSON.stringify(iqn);
}

export function DriveMountPanel() {
  const { data: drive, isLoading: isDriveLoading, error: driveError } = useMyDriveQuery();
  const { data: credentials, isLoading: isListLoading, error: listError } = useMountCredentialListQuery();
  const hasError = driveError !== null || listError !== null;

  return (
    <section aria-labelledby="drive-mount-panel-heading" className="rounded-2xl border border-border bg-surface-elevated p-6 shadow-sm">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 id="drive-mount-panel-heading" className="text-lg font-semibold text-text">
            내 드라이브 마운트
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Windows PC 에서 iSCSI 로 마운트할 수 있는 자격증명을 발급/회수합니다.
          </p>
        </div>
        <IssueMountCredentialButton driveId={drive?.id} />
      </header>

      {isDriveLoading || isListLoading ? (
        <p className="mt-6 text-sm text-text-muted" aria-live="polite">
          불러오는 중…
        </p>
      ) : hasError ? (
        <p role="alert" className="mt-6 rounded-xl bg-danger-soft px-4 py-6 text-center text-sm text-danger">
          마운트 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </p>
      ) : credentials && credentials.length > 0 ? (
        <ul className="mt-6 flex flex-col gap-3">
          {credentials.map((cred) => (
            <li
              key={cred.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <dl className="grid gap-2 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-4">
                <dt className="text-text-muted">사용자명</dt>
                <dd className="font-mono select-all">{cred.osUsername}</dd>
                <dt className="text-text-muted">IQN</dt>
                <dd className="font-mono break-all select-all">{formatIqn(cred.iqn)}</dd>
                <dt className="text-text-muted">Portal</dt>
                <dd className="font-mono select-all">
                  {cred.portalHost}:{cred.portalPort}
                </dd>
              </dl>
              <RevokeMountCredentialButton credentialId={cred.id} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-xl bg-surface-muted px-4 py-6 text-center text-sm text-text-muted">
          활성 마운트 자격증명이 없습니다. "마운트 발급" 으로 시작하세요.
        </p>
      )}
    </section>
  );
}
