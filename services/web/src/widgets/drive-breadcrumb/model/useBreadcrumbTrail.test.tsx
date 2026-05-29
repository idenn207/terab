import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useBreadcrumbTrail } from './useBreadcrumbTrail';

interface Entry {
  pathname: string;
  search: string;
  state?: unknown;
}

function makeWrapper(entries: Entry[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={entries.map((e) => ({ pathname: e.pathname, search: e.search, state: e.state }))}>
        <Routes>
          <Route path="*" element={<>{children}</>} />
        </Routes>
      </MemoryRouter>
    );
  };
}

function renderTrail(entries: Entry[]) {
  return renderHook(() => ({ trail: useBreadcrumbTrail(), loc: useLocation() }), {
    wrapper: makeWrapper(entries),
  });
}

describe('useBreadcrumbTrail', () => {
  it('루트(folderId 없음): trail 은 빈 배열, currentFolderId 는 null', () => {
    const { result } = renderTrail([{ pathname: '/drive', search: '' }]);
    expect(result.current.trail.trail).toEqual([]);
    expect(result.current.trail.currentFolderId).toBeNull();
  });

  it('folderId 있고 state.trail 있으면 trail 그대로 반환', () => {
    const { result } = renderTrail([
      {
        pathname: '/drive',
        search: '?folderId=f-1',
        state: { trail: [{ id: 'f-1', name: '사진' }] },
      },
    ]);
    expect(result.current.trail.currentFolderId).toBe('f-1');
    expect(result.current.trail.trail).toEqual([{ id: 'f-1', name: '사진' }]);
  });

  it('folderId 없으면 state.trail 이 있어도 무효 (URL 우선)', () => {
    const { result } = renderTrail([
      {
        pathname: '/drive',
        search: '',
        state: { trail: [{ id: 'f-1', name: '사진' }] },
      },
    ]);
    expect(result.current.trail.trail).toEqual([]);
  });

  it('openFolder 호출 시 URL 갱신 + trail 에 항목 추가', () => {
    const { result } = renderTrail([{ pathname: '/drive', search: '' }]);

    act(() => {
      result.current.trail.openFolder({ id: 'f-2', name: '2026' });
    });

    expect(result.current.loc.search).toBe('?folderId=f-2');
    expect((result.current.loc.state as { trail: { id: string; name: string }[] }).trail).toEqual([{ id: 'f-2', name: '2026' }]);
  });

  it('openFolder 가 기존 trail 끝에 새 항목을 append 한다', () => {
    const { result } = renderTrail([
      {
        pathname: '/drive',
        search: '?folderId=f-1',
        state: { trail: [{ id: 'f-1', name: '사진' }] },
      },
    ]);

    act(() => {
      result.current.trail.openFolder({ id: 'f-2', name: '2026' });
    });

    expect((result.current.loc.state as { trail: { id: string; name: string }[] }).trail).toEqual([
      { id: 'f-1', name: '사진' },
      { id: 'f-2', name: '2026' },
    ]);
  });

  it('navigateRoot 호출 시 query 비우고 trail 빈 배열', () => {
    const { result } = renderTrail([
      {
        pathname: '/drive',
        search: '?folderId=f-2',
        state: { trail: [{ id: 'f-1', name: '사진' }, { id: 'f-2', name: '2026' }] },
      },
    ]);

    act(() => {
      result.current.trail.navigateRoot();
    });

    expect(result.current.loc.search).toBe('');
    expect((result.current.loc.state as { trail: unknown[] }).trail).toEqual([]);
  });

  it('navigateToAncestor(0) 호출 시 trail 을 첫 항목까지 자른다', () => {
    const { result } = renderTrail([
      {
        pathname: '/drive',
        search: '?folderId=f-3',
        state: {
          trail: [
            { id: 'f-1', name: '사진' },
            { id: 'f-2', name: '2026' },
            { id: 'f-3', name: '05' },
          ],
        },
      },
    ]);

    act(() => {
      result.current.trail.navigateToAncestor(0);
    });

    expect(result.current.loc.search).toBe('?folderId=f-1');
    expect((result.current.loc.state as { trail: { id: string }[] }).trail).toEqual([{ id: 'f-1', name: '사진' }]);
  });
});
