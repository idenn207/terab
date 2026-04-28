import { LogoLabel } from '@/shared/assets';
import { Button, Heading } from '@/shared/ui';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface LocationState {
  backupCodes?: string[];
}

export function BackupCodeIssuePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;
  const backupCodes = state?.backupCodes ?? [];
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  if (backupCodes.length === 0) {
    navigate('/drive', { replace: true });
    return null;
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
  };

  return (
    <div className="grid w-full max-w-sm grid-cols-1 gap-6">
      <LogoLabel className="h-6 text-zinc-950 dark:text-white forced-colors:text-[CanvasText]" />
      <Heading>백업 코드</Heading>
      <p className="text-sm text-zinc-500">아래 코드는 지금만 확인할 수 있습니다. 분실 시 재발급이 불가하니 안전한 곳에 보관하세요.</p>
      <ul className="grid grid-cols-2 gap-2 rounded-md bg-zinc-100 p-4 font-mono text-sm dark:bg-zinc-800">
        {backupCodes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <Button type="button" onClick={handleCopy}>
        {copied ? '복사됨 ✓' : '클립보드에 복사'}
      </Button>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        백업 코드를 안전한 곳에 저장했습니다.
      </label>
      <Button type="button" disabled={!confirmed} onClick={() => navigate('/drive', { replace: true })}>
        완료
      </Button>
    </div>
  );
}
