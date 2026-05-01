import { Heading } from '@/shared/ui';

export function TrustedDeviceSection() {
  // const { data } = useTrustedDevicesQuery();
  // const { revoke, isRevoking } = useTrustedDevice();

  // const devices = data?.status === 200 ? data.body : [];

  return (
    <section>
      <Heading level={2} className="mb-4 text-lg font-semibold">
        신뢰된 기기
      </Heading>
      {/* {devices.length === 0 ? (
        <p className="text-sm text-gray-500">등록된 신뢰기기가 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {devices.map((device) => (
            <li key={device.id} className="flex items-center justify-between rounded border p-3 text-sm">
              <div>
                <p className="font-medium">{device.userAgent ?? '알 수 없는 기기'}</p>
                <p className="text-gray-500">{device.createdAt.toLocaleDateString()}</p>
              </div>
              <Button onClick={() => revoke(device.id)} disabled={isRevoking} plain>
                해제
              </Button>
            </li>
          ))}
        </ul>
      )} */}
    </section>
  );
}
