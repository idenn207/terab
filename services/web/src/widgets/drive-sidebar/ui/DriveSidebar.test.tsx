import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { DriveSidebar } from './DriveSidebar';

function renderSidebar({ pathname = '/drive', isOpen = false } = {}) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <DriveSidebar isOpen={isOpen} onClose={vi.fn()} />
    </MemoryRouter>,
  );
}

describe('DriveSidebar', () => {
  test('"/drive" 경로에서 "내 드라이브" 항목이 aria-current="page" 를 가진다', () => {
    renderSidebar({ pathname: '/drive' });

    const desktopNav = screen.getByLabelText('데스크탑 사이드바');
    const home = within(desktopNav).getByRole('link', { name: '내 드라이브' });
    const trash = within(desktopNav).getByRole('link', { name: '휴지통' });

    expect(home).toHaveAttribute('aria-current', 'page');
    expect(trash).not.toHaveAttribute('aria-current');
  });

  test('네비게이션 항목은 정확히 3개이며 제거된 메뉴(최근/즐겨찾기/공유)는 포함하지 않는다', () => {
    renderSidebar({ pathname: '/drive' });

    const desktopNav = screen.getByLabelText('데스크탑 사이드바');
    const links = within(desktopNav).getAllByRole('link');

    expect(links).toHaveLength(3);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/drive', '/trash', '/settings']);
    expect(screen.queryByText('최근 파일')).toBeNull();
    expect(screen.queryByText('즐겨찾기')).toBeNull();
    expect(screen.queryByText('공유 파일')).toBeNull();
  });

  test('isOpen=false 일 때 모바일 사이드바가 마운트되지 않는다', () => {
    renderSidebar({ isOpen: false });

    expect(screen.queryByLabelText('모바일 사이드바')).toBeNull();
  });
});
