import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DrivePage } from './DrivePage';

vi.mock('@/widgets', () => ({
  FileToolbar: () => <div data-testid="file-toolbar" />,
  FileList: () => <div data-testid="file-list" />,
}));

function renderWithQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DrivePage />
    </QueryClientProvider>,
  );
}

describe('DrivePage', () => {
  it('data-region="main" 안에 FileToolbar + FileList 가 렌더된다', () => {
    renderWithQueryClient();

    const mainRegion = document.querySelector('[data-region="main"]');
    expect(mainRegion).toBeInTheDocument();
    expect(mainRegion).toContainElement(screen.getByTestId('file-toolbar'));
    expect(mainRegion).toContainElement(screen.getByTestId('file-list'));
  });

  it('data-region="secondary" 자리는 Phase 4 도 비워 둔다 (Phase 5+ 흡수 대상)', () => {
    renderWithQueryClient();

    const secondary = document.querySelector('[data-region="secondary"]');
    expect(secondary).toBeInTheDocument();
    expect(secondary?.children.length).toBe(0);
  });
});
