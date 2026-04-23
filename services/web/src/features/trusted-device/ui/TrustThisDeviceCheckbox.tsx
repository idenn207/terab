import { Checkbox, CheckboxField, Label } from '@/shared/ui';

interface TrustThisDeviceCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function TrustThisDeviceCheckbox({ checked, onChange }: TrustThisDeviceCheckboxProps) {
  return (
    <CheckboxField>
      <Checkbox onChange={onChange} checked={checked} className="h-4 w-4 rounded-2xl border-gray-300" />
      <Label>이 기기를 30일간 신뢰 (2FA 건너뛰기)</Label>
    </CheckboxField>
  );
}
