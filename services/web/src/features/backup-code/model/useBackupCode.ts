import { useEffect, useState } from 'react';
import { backupCodeApi } from '../api/backupCodeApi';

export function useBackupCode() {
  const [count, setCount] = useState<number | null>(null);
  const [generatedCodes, setGeneratedCodes] = useState<string[] | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    backupCodeApi.count().then((d) => setCount(d.count));
  }, []);

  const regenerate = async () => {
    if (!window.confirm('기존 백업 코드가 모두 삭제됩니다. 계속하시겠습니까?')) return;
    setIsRegenerating(true);
    try {
      const data = await backupCodeApi.regenerate();
      setGeneratedCodes(data.codes);
      setCount(data.codes.length);
    } finally {
      setIsRegenerating(false);
    }
  };

  const clearGeneratedCodes = () => setGeneratedCodes(null);

  return { count, generatedCodes, isRegenerating, regenerate, clearGeneratedCodes };
}
