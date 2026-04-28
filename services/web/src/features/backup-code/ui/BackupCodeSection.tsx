import { Button, Heading } from '@/shared/ui';
import { useBackupCode } from '../model/useBackupCode';

export function BackupCodeSection() {
  const { count, generatedCodes, isRegenerating, regenerate, clearGeneratedCodes } = useBackupCode();

  return (
    <section className="rounded-xl border p-6">
      <Heading level={2} className="mb-4 text-lg font-semibold">
        백업 코드
      </Heading>
      <p className="text-sm text-gray-600">
        남은 코드: <strong className="font-mono">{count ?? '...'} / 8</strong>
      </p>
      <Button onClick={regenerate} disabled={isRegenerating} className="mt-4 rounded-2xl bg-gray-800 px-4 py-2 text-sm text-white disabled:opacity-50">
        {isRegenerating ? '생성 중...' : '백업 코드 재발급'}
      </Button>

      {generatedCodes && (
        <div className="mt-4 rounded-2xl bg-gray-50 p-4">
          <p className="mb-2 text-xs text-red-600">이 코드는 지금 한 번만 표시됩니다. 안전한 곳에 보관하세요.</p>
          <ul className="grid grid-cols-2 gap-2">
            {generatedCodes.map((code) => (
              <li key={code} className="font-mono text-sm">
                {code}
              </li>
            ))}
          </ul>
          <Button onClick={clearGeneratedCodes} plain>
            확인했습니다
          </Button>
        </div>
      )}
    </section>
  );
}
