import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Input } from './Input';

describe('Input — 기본 렌더링 + hit-area', () => {
  it('renders a native <input>', () => {
    render(<Input aria-label="이름" />);
    const input = screen.getByLabelText('이름');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  it('default size enforces ≥48px hit-area (Material 48dp)', () => {
    render(<Input aria-label="이름" />);
    const input = screen.getByLabelText('이름');
    expect(input.className).toContain('min-h-12');
  });

  it('size="sm" 은 36px hit-area', () => {
    render(<Input aria-label="이름" size="sm" />);
    expect(screen.getByLabelText('이름').className).toContain('min-h-9');
  });
});

describe('Input — 타이핑 + onChange', () => {
  function Controlled() {
    const [value, setValue] = useState('');
    return <Input aria-label="이름" value={value} onChange={(e) => setValue(e.target.value)} />;
  }

  it('controlled typing reflects input value', () => {
    render(<Controlled />);
    const input = screen.getByLabelText('이름') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'hello' } });
    expect(input.value).toBe('hello');
  });

  it('onChange handler fires on input', () => {
    const handle = vi.fn();
    render(<Input aria-label="이름" onChange={handle} />);
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: 'x' } });
    expect(handle).toHaveBeenCalledTimes(1);
  });
});

describe('Input — invalid / a11y', () => {
  it('tone="danger" 은 aria-invalid="true" 자동 부착', () => {
    render(<Input aria-label="이름" tone="danger" />);
    expect(screen.getByLabelText('이름')).toHaveAttribute('aria-invalid', 'true');
  });

  it('describedById 가 aria-describedby 로 연결', () => {
    render(<Input aria-label="이름" describedById="err-1" />);
    expect(screen.getByLabelText('이름')).toHaveAttribute('aria-describedby', 'err-1');
  });

  it('disabled 시 입력 차단', () => {
    render(<Input aria-label="이름" disabled />);
    expect(screen.getByLabelText('이름')).toBeDisabled();
  });
});

describe('Input — focus ring + danger 시 ring-danger', () => {
  it('default focus ring 은 ring-accent', () => {
    const { container } = render(<Input aria-label="이름" />);
    const wrapper = container.querySelector('[data-slot="input-control"]');
    expect(wrapper?.className).toContain('focus-within:ring-accent');
  });

  it('tone="danger" 시 focus ring 도 danger 로 분기', () => {
    const { container } = render(<Input aria-label="이름" tone="danger" />);
    const wrapper = container.querySelector('[data-slot="input-control"]');
    expect(wrapper?.className).toContain('focus-within:ring-danger');
  });
});

describe('Input — transform 호환 (catalyst 잔존 호환)', () => {
  it('transform="uppercase" 시 uppercase utility 적용', () => {
    render(<Input aria-label="코드" transform="uppercase" />);
    expect(screen.getByLabelText('코드').className).toContain('uppercase');
  });
});

describe('Input — icon slot', () => {
  it('leadingIcon 슬롯 표시 + 좌측 padding', () => {
    render(<Input aria-label="검색" leadingIcon={<svg data-testid="lead" />} />);
    expect(screen.getByTestId('lead')).toBeInTheDocument();
    expect(screen.getByLabelText('검색').className).toContain('pl-12');
  });

  it('trailingIcon 슬롯 표시 + 우측 padding', () => {
    render(<Input aria-label="검색" trailingIcon={<svg data-testid="trail" />} />);
    expect(screen.getByTestId('trail')).toBeInTheDocument();
    expect(screen.getByLabelText('검색').className).toContain('pr-12');
  });
});
