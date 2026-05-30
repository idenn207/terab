import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { TrustThisDeviceCheckbox } from './TrustThisDeviceCheckbox';

describe('TrustThisDeviceCheckbox', () => {
  it('label 텍스트가 렌더된다', () => {
    render(<TrustThisDeviceCheckbox checked={false} onChange={() => {}} />);
    expect(screen.getByText('이 기기를 30일간 신뢰 (2FA 건너뛰기)')).toBeInTheDocument();
  });

  it('초기 unchecked 상태로 렌더된다', () => {
    render(<TrustThisDeviceCheckbox checked={false} onChange={() => {}} />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
  });

  it('checked=true 면 aria-checked="true" 가 부착된다', () => {
    render(<TrustThisDeviceCheckbox checked={true} onChange={() => {}} />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
  });

  it('label 클릭 시 onChange 가 호출된다', () => {
    const onChange = vi.fn();
    render(<TrustThisDeviceCheckbox checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByText('이 기기를 30일간 신뢰 (2FA 건너뛰기)'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('axe-core a11y violations 0건', async () => {
    const { container } = render(<TrustThisDeviceCheckbox checked={false} onChange={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
