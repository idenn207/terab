import { Button } from '@/shared/ui';
import { useRevokeMountCredential } from '../model/useRevokeMountCredential';

interface RevokeMountCredentialButtonProps {
  credentialId: string;
  onRevoked?: () => void;
}

export function RevokeMountCredentialButton({ credentialId, onRevoked }: RevokeMountCredentialButtonProps) {
  const { revoke, isRevoking, error } = useRevokeMountCredential();

  const handleClick = async () => {
    if (!window.confirm('이 마운트 자격증명을 회수하시겠습니까? 회수 후에는 PC 의 iSCSI 연결이 즉시 끊어집니다.')) return;
    await revoke(credentialId);
    onRevoked?.();
  };

  return (
    <>
      <Button
        variant="outlined"
        tone="danger"
        size="sm"
        onClick={handleClick}
        loading={isRevoking}
        aria-label="마운트 자격증명 회수"
      >
        회수
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          회수에 실패했습니다. 다시 시도해주세요.
        </p>
      )}
    </>
  );
}
