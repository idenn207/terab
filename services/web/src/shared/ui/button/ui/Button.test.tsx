import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('Button — 기본 렌더링', () => {
  it('renders a <button type="button"> with the children', () => {
    renderWithRouter(<Button>업로드</Button>);
    const button = screen.getByRole('button', { name: '업로드' });
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('default size enforces ≥48px hit-area (Material 48dp + WCAG 2.5.8)', () => {
    renderWithRouter(<Button>업로드</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('min-h-12');
    expect(button.className).toContain('min-w-12');
  });

  it('size="sm" uses 36px touch target', () => {
    renderWithRouter(<Button size="sm">정렬</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('min-h-9');
  });
});

describe('Button — variant × tone matrix', () => {
  it('default variant=filled tone=accent uses brand accent', () => {
    renderWithRouter(<Button>업로드</Button>);
    expect(screen.getByRole('button').className).toContain('bg-accent');
  });

  it('variant="text" tone="neutral" 은 transparent + 본문 색 위계', () => {
    renderWithRouter(
      <Button variant="text" tone="neutral">
        취소
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-transparent');
    expect(button.className).toContain('text-text-muted');
  });

  it('variant="outlined" tone="neutral" 은 strong border + transparent', () => {
    renderWithRouter(
      <Button variant="outlined" tone="neutral">
        다시
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button.className).toContain('border-border-strong');
    expect(button.className).toContain('bg-transparent');
  });

  it('variant="filled" tone="danger" 는 danger 배경', () => {
    renderWithRouter(
      <Button variant="filled" tone="danger">
        삭제
      </Button>,
    );
    expect(screen.getByRole('button').className).toContain('bg-danger');
  });
});

describe('Button — focus / disabled / loading', () => {
  it('focus-visible 시 ring-accent 적용 (WCAG 2.4.7 Focus Visible)', () => {
    renderWithRouter(<Button>업로드</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('focus-visible:ring-accent');
  });

  it('disabled 시 클릭 차단 + 시각적 dim', () => {
    const handleClick = vi.fn();
    renderWithRouter(
      <Button disabled onClick={handleClick}>
        업로드
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('loading=true 시 aria-busy + 스피너 + 클릭 차단', () => {
    const handleClick = vi.fn();
    renderWithRouter(
      <Button loading onClick={handleClick}>
        업로드
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
    // spinner 슬롯 존재
    expect(button.querySelector('[data-slot="spinner"]')).not.toBeNull();
  });
});

describe('Button — leading / trailing icon slot', () => {
  it('leadingIcon 슬롯이 children 앞에 표시', () => {
    renderWithRouter(
      <Button leadingIcon={<svg data-testid="lead" />}>업로드</Button>,
    );
    expect(screen.getByTestId('lead')).toBeInTheDocument();
  });

  it('trailingIcon 슬롯이 children 뒤에 표시', () => {
    renderWithRouter(
      <Button trailingIcon={<svg data-testid="trail" />}>다음</Button>,
    );
    expect(screen.getByTestId('trail')).toBeInTheDocument();
  });

  it('loading=true 면 leadingIcon 대신 스피너만 표시', () => {
    renderWithRouter(
      <Button loading leadingIcon={<svg data-testid="lead" />}>
        업로드
      </Button>,
    );
    expect(screen.queryByTestId('lead')).toBeNull();
  });
});

describe('Button — href 폴리모픽 → RouterLink', () => {
  it('href 가 있으면 <a> 태그로 렌더 (button 역할 없음)', () => {
    renderWithRouter(<Button href="/drive">드라이브</Button>);
    expect(screen.queryByRole('button')).toBeNull();
    const link = screen.getByRole('link', { name: '드라이브' });
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/drive');
  });

  it('href + disabled 면 클릭 무효 + aria-disabled 표기', () => {
    const handleClick = vi.fn();
    renderWithRouter(
      <Button href="/drive" disabled onClick={handleClick}>
        드라이브
      </Button>,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(link);
    expect(handleClick).not.toHaveBeenCalled();
  });
});
