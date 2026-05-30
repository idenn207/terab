import { Alert, AlertActions, AlertDescription, AlertTitle, Button } from '@/shared/ui';
import { parseApiError } from '@shared/api';
import { useState } from 'react';
import type { TrustedDevice } from '../model/types';
import { useRevokeTrustedDevice } from '../model/useRevokeTrustedDevice';

interface TrustedDeviceRevokeDialogProps {
  device: TrustedDevice | null;
  open: boolean;
  onClose: () => void;
}

type RevokeErrorCode = 'TRUSTED_DEVICE_NOT_FOUND';

export function TrustedDeviceRevokeDialog({ device, open, onClose }: TrustedDeviceRevokeDialogProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { revoke, isPending, reset } = useRevokeTrustedDevice();

  const handleClose = () => {
    if (isPending) return;
    setErrorMessage(null);
    reset();
    onClose();
  };

  const handleConfirm = async () => {
    if (!device) return;
    setErrorMessage(null);
    try {
      await revoke({ id: device.id });
      onClose();
    } catch (error) {
      const parsed = parseApiError<RevokeErrorCode>(error, {
        code: 'UNKNOWN',
        message: '신뢰기기를 해제할 수 없습니다.',
      });
      setErrorMessage(parsed.message);
    }
  };

  const deviceLabel = device?.userAgent ?? '알 수 없는 기기';

  return (
    <Alert open={open && Boolean(device)} onClose={handleClose} size="md">
      <AlertTitle>신뢰기기 해제</AlertTitle>
      <AlertDescription>"{deviceLabel}" 기기의 신뢰를 해제합니다. 해당 기기는 다음 로그인부터 2단계 인증을 다시 요구받습니다.</AlertDescription>
      {errorMessage && (
        <p role="alert" className="mt-2 text-sm text-red-500">
          {errorMessage}
        </p>
      )}
      <AlertActions>
        <Button variant="text" tone="neutral" type="button" onClick={handleClose} disabled={isPending}>
          취소
        </Button>
        <Button variant="filled" tone="danger" type="button" onClick={handleConfirm} disabled={isPending || !device}>
          {isPending ? '해제 중...' : '해제'}
        </Button>
      </AlertActions>
    </Alert>
  );
}
