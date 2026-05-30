import { Button, Heading } from '@/shared/ui';
import { useState } from 'react';
import type { TrustedDevice } from '../model/types';
import { useTrustedDeviceList } from '../model/useTrustedDeviceList';
import { TrustedDeviceRevokeDialog } from './TrustedDeviceRevokeDialog';

function formatRegisteredAt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return iso;
  }
}

export function TrustedDeviceSection() {
  const { devices, isLoading } = useTrustedDeviceList();
  const [revokeTarget, setRevokeTarget] = useState<TrustedDevice | null>(null);

  return (
    <section aria-labelledby="trusted-device-heading" className="flex flex-col gap-4">
      <Heading id="trusted-device-heading" level={2} className="text-lg font-semibold">
        신뢰된 기기
      </Heading>

      {isLoading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">불러오는 중...</p>
      ) : devices.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">등록된 신뢰기기가 없습니다.</p>
      ) : (
        <ul role="list" className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-white/10 dark:border-white/10">
          {devices.map((device) => (
            <li key={device.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{device.userAgent ?? '알 수 없는 기기'}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{formatRegisteredAt(device.createdAt)} 등록</p>
              </div>
              <Button
                type="button"
                variant="outlined"
                tone="danger"
                size="sm"
                onClick={() => setRevokeTarget(device)}
                aria-label={`${device.userAgent ?? '알 수 없는 기기'} 신뢰기기 해제`}
              >
                해제
              </Button>
            </li>
          ))}
        </ul>
      )}

      <TrustedDeviceRevokeDialog device={revokeTarget} open={Boolean(revokeTarget)} onClose={() => setRevokeTarget(null)} />
    </section>
  );
}
