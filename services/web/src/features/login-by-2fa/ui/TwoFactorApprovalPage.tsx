import { useParams } from 'react-router-dom';
import { useTwoFactorRespond } from '../model/useTwoFactorRespond';

export function TwoFactorApprovalPage() {
  const { id: challengeId = '' } = useParams<{ id: string }>();
  const { options, respondStatus, respond } = useTwoFactorRespond(challengeId);

  if (respondStatus === 'loading') {
    return <div className="p-8 text-center text-gray-500">불러오는 중...</div>;
  }

  if (respondStatus === 'expired') {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">만료된 요청입니다.</p>
      </div>
    );
  }

  if (respondStatus === 'done') {
    return (
      <div className="p-8 text-center">
        <p className="font-bold text-green-600">선택 완료</p>
        <p className="mt-2 text-sm text-gray-600">PC 화면에서 결과를 확인하세요.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      <h1 className="text-xl font-bold">로그인 승인</h1>
      <p className="text-center text-sm text-gray-600">PC 화면에 표시된 숫자를 선택해 로그인을 승인해 주세요.</p>
      <div className="flex gap-4">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => respond(opt)}
            className="h-20w20 flex items-center justify-center rounded-lg border-2 text-2xl font-bold hover:bg-blue-50 active:bg-blue-100"
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
