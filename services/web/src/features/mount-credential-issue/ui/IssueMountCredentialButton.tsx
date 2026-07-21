import { useEffect, useState } from 'react';
import { Button, Modal } from '@/shared/ui';
import { useIssueMountCredential } from '../model/useIssueMountCredential';

interface IssueMountCredentialButtonProps {
  driveId?: string;
}

function formatIqn(iqn: unknown): string {
  if (typeof iqn === 'string') return iqn;
  if (iqn == null) return '—';
  return JSON.stringify(iqn);
}

function downloadScript(filename: string, body: string) {
  const blob = new Blob([body], { type: 'application/x-powershell;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function IssueMountCredentialButton({ driveId }: IssueMountCredentialButtonProps) {
  const { issue, issued, clearIssued, isIssuing, error } = useIssueMountCredential();
  const [showPassword, setShowPassword] = useState(false);

  // 발급 다이얼로그를 닫지 않고 컴포넌트가 unmount 되면 password 가 메모리에 남는다 — cleanup 으로 GC
  useEffect(() => clearIssued, [clearIssued]);

  const handleIssue = () => {
    setShowPassword(false);
    return issue(driveId);
  };

  const handleClose = () => {
    setShowPassword(false);
    clearIssued();
  };

  return (
    <>
      <Button onClick={handleIssue} loading={isIssuing} aria-label="마운트 자격증명 발급">
        마운트 발급
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          발급에 실패했습니다. 다시 시도해주세요.
        </p>
      )}
      <Modal open={issued !== null} onClose={handleClose} dismissible={false} size="lg">
        <Modal.Header>마운트 자격증명이 발급되었습니다</Modal.Header>
        <Modal.Body>
          <p className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
            비밀번호는 지금 한 번만 표시됩니다. 안전한 곳에 보관하세요.
          </p>
          {issued && (
            <dl className="mt-4 grid gap-3 sm:grid-cols-[max-content_1fr] sm:gap-x-4">
              <dt className="text-sm font-medium text-text-muted">CHAP 사용자명</dt>
              <dd className="font-mono text-sm break-all select-all">{issued.osUsername}</dd>

              <dt className="text-sm font-medium text-text-muted">CHAP 비밀번호</dt>
              <dd className="flex items-center gap-2">
                <span className="flex-1 font-mono text-sm break-all select-all">
                  {showPassword ? issued.password : '•'.repeat(Math.min(issued.password.length, 24))}
                </span>
                <Button
                  variant="outlined"
                  tone="neutral"
                  size="sm"
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? '숨기기' : '보기'}
                </Button>
              </dd>

              <dt className="text-sm font-medium text-text-muted">IQN</dt>
              <dd className="font-mono text-sm break-all select-all">{formatIqn(issued.iqn)}</dd>

              <dt className="text-sm font-medium text-text-muted">Portal</dt>
              <dd className="font-mono text-sm break-all select-all">
                {issued.portalHost}:{issued.portalPort}
              </dd>
            </dl>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="text" tone="neutral" onClick={handleClose}>
            닫기 — 다시 표시되지 않습니다
          </Button>
          <Button
            onClick={() => issued && downloadScript(`mount-${issued.id}.ps1`, issued.script)}
            disabled={!issued}
          >
            Windows .ps1 다운로드
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
