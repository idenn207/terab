import * as Headless from '@headlessui/react';
import { Checkbox } from '@/shared/ui';

interface TrustThisDeviceCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

// Headless UI v2 의 `<Checkbox>` 는 `<span role="checkbox">` 라 native <label> 로 감싸도 label-input association 이 만들어지지 않는다 — Field 가 자식 Checkbox·Label 에 id/htmlFor 를 자동 wiring 해 WCAG 1.3.1 / 4.1.2 통과
export function TrustThisDeviceCheckbox({ checked, onChange }: TrustThisDeviceCheckboxProps) {
  return (
    <Headless.Field className="flex items-center gap-3 text-sm text-text">
      <Checkbox onChange={onChange} checked={checked} className="h-4 w-4 rounded-2xl border-gray-300" />
      <Headless.Label className="cursor-pointer">이 기기를 30일간 신뢰 (2FA 건너뛰기)</Headless.Label>
    </Headless.Field>
  );
}
