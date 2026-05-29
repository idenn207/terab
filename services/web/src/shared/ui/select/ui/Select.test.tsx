import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Select } from './Select';

function Controlled({ onChangeSpy }: { onChangeSpy?: (v: string) => void }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <Select
      value={value}
      onChange={(next) => {
        onChangeSpy?.(next);
        setValue(next);
      }}
      label="국가 선택"
      placeholder="선택"
    >
      <Select.Option value="kr">한국</Select.Option>
      <Select.Option value="us">미국</Select.Option>
      <Select.Option value="jp">일본</Select.Option>
    </Select>
  );
}

describe('Select — 기본 렌더링 + a11y', () => {
  it('button 으로 trigger 노출 + aria-label', () => {
    render(<Controlled />);
    expect(screen.getByRole('button', { name: '국가 선택' })).toBeInTheDocument();
  });

  it('48dp hit-area on trigger (min-h-12)', () => {
    render(<Controlled />);
    expect(screen.getByRole('button').className).toContain('min-h-12');
  });

  it('placeholder 표시 (선택 전)', () => {
    render(<Controlled />);
    expect(screen.getByText('선택')).toBeInTheDocument();
  });
});

describe('Select — open/close + single-select', () => {
  it('trigger 클릭 시 옵션 표시 + 옵션 클릭 시 onChange', () => {
    const spy = vi.fn();
    render(<Controlled onChangeSpy={spy} />);
    fireEvent.click(screen.getByRole('button'));
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    fireEvent.click(options[0]);
    expect(spy).toHaveBeenCalledWith('kr');
  });
});

describe('Select — disabled', () => {
  it('disabled Select 는 클릭해도 열리지 않음', () => {
    function Disabled() {
      return (
        <Select value={null} onChange={() => {}} label="x" disabled>
          <Select.Option value="a">A</Select.Option>
        </Select>
      );
    }
    render(<Disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByRole('option')).toBeNull();
  });
});
