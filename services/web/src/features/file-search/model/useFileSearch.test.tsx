import { server } from '@tests/mocks';
import { makeRouterWrapper } from '@tests/wrappers';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFileSearch } from './useFileSearch';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useFileSearch', () => {
  it('200ms 동안 입력이 안정되어야 URL 이 갱신된다 (debounce)', async () => {
    const wrapper = makeRouterWrapper({ initialEntries: ['/drive'] });
    const { result } = renderHook(() => useFileSearch({ folderId: null }), { wrapper });

    act(() => result.current.setValue('hello'));
    expect(result.current.debouncedQ).toBe('');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(199);
    });
    expect(result.current.debouncedQ).toBe('');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    await waitFor(() => expect(result.current.debouncedQ).toBe('hello'));
  });

  it('짧은 입력(2자 미만)은 URL 에 반영되지 않는다', async () => {
    const wrapper = makeRouterWrapper({ initialEntries: ['/drive'] });
    const { result } = renderHook(() => useFileSearch({ folderId: null }), { wrapper });

    act(() => result.current.setValue('a'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(result.current.debouncedQ).toBe('');
    expect(result.current.isSearching).toBe(false);
  });

  it('scope 변경도 debounce 후 URL 에 반영된다', async () => {
    const wrapper = makeRouterWrapper({ initialEntries: ['/drive?q=foo&scope=all'] });
    const { result } = renderHook(() => useFileSearch({ folderId: 'p-1' }), { wrapper });

    expect(result.current.scope).toBe('all');

    act(() => result.current.setScope('folder'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    await waitFor(() => expect(result.current.scope).toBe('folder'));
  });

  it('IME 조합 중에는 debounce 가 발화하지 않는다 (한글 토큰 분리 방지)', async () => {
    const wrapper = makeRouterWrapper({ initialEntries: ['/drive'] });
    const { result } = renderHook(() => useFileSearch({ folderId: null }), { wrapper });

    act(() => result.current.onCompositionStart());
    act(() => result.current.setValue('ㄱㅏ'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current.debouncedQ).toBe('');

    act(() => result.current.onCompositionEnd());
    act(() => result.current.setValue('가나'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    await waitFor(() => expect(result.current.debouncedQ).toBe('가나'));
  });

  it('clear() 호출 시 input 과 URL 모두 비워진다', async () => {
    const wrapper = makeRouterWrapper({ initialEntries: ['/drive?q=hello&scope=all'] });
    const { result } = renderHook(() => useFileSearch({ folderId: null }), { wrapper });

    await waitFor(() => expect(result.current.value).toBe('hello'));

    act(() => result.current.clear());

    expect(result.current.value).toBe('');
    expect(result.current.debouncedQ).toBe('');
    expect(result.current.isSearching).toBe(false);
  });

  it('flush() 는 200ms 를 기다리지 않고 즉시 URL 을 갱신한다', async () => {
    const wrapper = makeRouterWrapper({ initialEntries: ['/drive'] });
    const { result } = renderHook(() => useFileSearch({ folderId: null }), { wrapper });

    act(() => result.current.setValue('quick'));
    act(() => result.current.flush());

    await waitFor(() => expect(result.current.debouncedQ).toBe('quick'));
  });

  it('isSearching 은 debouncedQ.length >= 2 일 때 true', async () => {
    const wrapper = makeRouterWrapper({ initialEntries: ['/drive?q=hi'] });
    const { result } = renderHook(() => useFileSearch({ folderId: null }), { wrapper });

    await waitFor(() => expect(result.current.isSearching).toBe(true));
  });

  it('debouncedQ 가 2자 이상이면 GET /files/search 가 호출되어 결과를 반환한다', async () => {
    let searchHit = false;
    let receivedQ: string | null = null;
    server.use(
      http.get('/api/files/search', ({ request }) => {
        searchHit = true;
        const url = new URL(request.url);
        receivedQ = url.searchParams.get('q');
        return HttpResponse.json({
          files: [{ id: 'f1', folderId: null, name: 'matched.png', size: 1, mimeType: 'image/png', createdAt: '', updatedAt: '' }],
        });
      }),
    );

    const wrapper = makeRouterWrapper({ initialEntries: ['/drive?q=matched&scope=all'] });
    const { result } = renderHook(() => useFileSearch({ folderId: null }), { wrapper });

    await waitFor(() => expect(searchHit).toBe(true));
    expect(receivedQ).toBe('matched');
    await waitFor(() => expect(result.current.files).toHaveLength(1));
    expect(result.current.files[0]?.name).toBe('matched.png');
  });

  it("scope='folder' 인데 folderId 가 null 이면 query 가 disable 되어 호출되지 않는다", async () => {
    let searchHit = false;
    server.use(
      http.get('/api/files/search', () => {
        searchHit = true;
        return HttpResponse.json({ files: [] });
      }),
    );

    const wrapper = makeRouterWrapper({ initialEntries: ['/drive?q=foo&scope=folder'] });
    renderHook(() => useFileSearch({ folderId: null }), { wrapper });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(searchHit).toBe(false);
  });
});
