import { Button, Heading } from '@/shared/ui';
import { useEffect, useState } from 'react';
import { trustedDeviceApi, type TrustedDeviceItem } from '../api/trustedDeviceApi';
import { useTrustedDevice } from '../model/useTrustedDevice';

export function TrustedDeviceSection() {
  const [devices, setDevices] = useState<TrustedDeviceItem[]>([]);
  const { revoke } = useTrustedDevice();

  useEffect(() => {
    trustedDeviceApi.list().then(setDevices);
  }, []);

  return (
    <section>
      <Heading level={2} className="mb-4 text-lg font-semibold">
        신뢰된 기기
      </Heading>
      {devices.length === 0 ? (
        <p className="text-sm text-gray-500">등록된 신뢰기기가 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {devices.map((device) => (
            <li key={device.id} className="px4 flex items-center justify-between rounded-2xl border py-3">
              <div>
                <p className="text-sm font-medium">{device.userAgent ?? '알 수 없는 기기'}</p>
                <p className="text-xs text-gray-500">만료: {new Date(device.expiresAt).toLocaleDateString('ko-KR')}</p>
              </div>
              <Button
                onClick={async () => {
                  await revoke(device.id);
                  setDevices((prev) => prev.filter((d) => d.id !== device.id));
                }}
                className="text-sm text-red-500 underline"
                plain
              >
                해제
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
