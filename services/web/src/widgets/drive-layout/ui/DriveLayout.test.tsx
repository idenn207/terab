import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';

vi.mock('@/entities', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/entities');
  return {
    ...actual,
    useMeQuery: () => ({
      data: { id: 'u-1', username: 'me', nickname: '본인' },
      isLoading: false,
      isError: false,
    }),
  };
});

import { DriveLayout } from './DriveLayout';

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/drive']}>
      <Routes>
        <Route path="/drive" element={<DriveLayout />}>
          <Route index element={<div data-testid="child">child</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('DriveLayout', () => {
  test('useMeQuery 가 user 를 반환하면 topbar 에 nickname 이 표시된다', () => {
    renderLayout();
    expect(screen.getByText('본인')).toBeInTheDocument();
  });

  test('"Tom Cook" 더미 문자열이 등장하지 않는다', () => {
    renderLayout();
    expect(screen.queryByText('Tom Cook')).toBeNull();
  });

  test('search input 이 disabled 속성을 가진다', () => {
    renderLayout();
    const search = screen.getByRole('searchbox', { name: '검색' });
    expect(search).toBeDisabled();
  });

  test('Outlet 자리에 child route 가 렌더된다', () => {
    renderLayout();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
