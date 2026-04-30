import { Heading } from '@/shared/ui';
import { useState } from 'react';
import { useTrustedDevice } from '../model/useTrustedDevice';

export function TrustedDeviceSection() {
  const [devices, setDevices] = useState<[]>([]);
  const { register, revoke, isRegistering, isRevoking } = useTrustedDevice();

  return (
    <section>
      <Heading level={2} className="mb-4 text-lg font-semibold">
        신뢰된 기기
      </Heading>
      {devices.length === 0 ? <p className="text-sm text-gray-500">등록된 신뢰기기가 없습니다.</p> : <></>}
    </section>
  );
}
