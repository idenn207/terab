import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DrivePage } from './DrivePage';

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
  it('data-region="main" 안에 UploadButton 이 렌더된다', () => {
    renderWithQueryClient();

    const mainRegion = document.querySelector('[data-region="main"]');
    expect(mainRegion).toBeInTheDocument();
    expect(mainRegion).toContainElement(screen.getByRole('button', { name: '업로드' }));
  });

  it('data-region="secondary" 자리는 Phase 4 흡수 전까지 비워둔다', () => {
    renderWithQueryClient();

    const secondary = document.querySelector('[data-region="secondary"]');
    expect(secondary).toBeInTheDocument();
    expect(secondary?.children.length).toBe(0);
  });
});
