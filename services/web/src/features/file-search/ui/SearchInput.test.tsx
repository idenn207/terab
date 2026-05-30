import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchInput } from './SearchInput';

const { mockUseFileSearch } = vi.hoisted(() => ({
  mockUseFileSearch: vi.fn(),
}));

vi.mock('../model/useFileSearch', () => ({
  useFileSearch: (...args: unknown[]) => mockUseFileSearch(...args),
}));

const baseState = {
  value: '',
  setValue: vi.fn(),
  scope: 'all' as 'all' | 'folder',
  setScope: vi.fn(),
  debouncedQ: '',
  isSearching: false,
  files: [],
  isLoading: false,
  isFetching: false,
  clear: vi.fn(),
  flush: vi.fn(),
  onCompositionStart: vi.fn(),
  onCompositionEnd: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseFileSearch.mockReturnValue({ ...baseState });
});

describe('SearchInput', () => {
  it('role="search" 컨테이너와 role="searchbox" input 이 노출된다', () => {
    render(<SearchInput folderId={null} />);
    expect(screen.getByRole('search', { name: '파일 검색' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: '파일 검색' })).toBeInTheDocument();
  });

  it('placeholder 가 "파일 검색 (2자 이상)" 으로 노출된다', () => {
    render(<SearchInput folderId={null} />);
    expect(screen.getByPlaceholderText('파일 검색 (2자 이상)')).toBeInTheDocument();
  });

  it('타이핑하면 setValue 가 매 키 입력 시 호출된다', async () => {
    const setValue = vi.fn();
    mockUseFileSearch.mockReturnValue({ ...baseState, setValue });

    render(<SearchInput folderId={null} />);
    await userEvent.type(screen.getByRole('searchbox'), 'ab');

    expect(setValue).toHaveBeenCalledTimes(2);
    expect(setValue).toHaveBeenNthCalledWith(1, 'a');
    expect(setValue).toHaveBeenNthCalledWith(2, 'b');
  });

  it('value 가 비어있으면 clear 버튼이 노출되지 않는다', () => {
    render(<SearchInput folderId={null} />);
    expect(screen.queryByRole('button', { name: '검색어 지우기' })).not.toBeInTheDocument();
  });

  it('value 가 있으면 clear 버튼이 노출되고 클릭 시 clear 호출', async () => {
    const clear = vi.fn();
    mockUseFileSearch.mockReturnValue({ ...baseState, value: 'hello', clear });

    render(<SearchInput folderId={null} />);
    const clearButton = screen.getByRole('button', { name: '검색어 지우기' });
    expect(clearButton).toBeInTheDocument();

    await userEvent.click(clearButton);
    expect(clear).toHaveBeenCalled();
  });

  it('Escape 키 입력 시 clear 가 호출된다', async () => {
    const clear = vi.fn();
    mockUseFileSearch.mockReturnValue({ ...baseState, value: 'foo', clear });

    render(<SearchInput folderId={null} />);
    const input = screen.getByRole('searchbox');
    input.focus();
    await userEvent.keyboard('{Escape}');

    expect(clear).toHaveBeenCalled();
  });

  it('Enter 키 입력 시 flush 가 호출된다 (debounce 무시)', async () => {
    const flush = vi.fn();
    mockUseFileSearch.mockReturnValue({ ...baseState, value: 'foo', flush });

    render(<SearchInput folderId={null} />);
    const input = screen.getByRole('searchbox');
    input.focus();
    await userEvent.keyboard('{Enter}');

    expect(flush).toHaveBeenCalled();
  });

  it('scope toggle: "전체" 클릭 시 setScope("all") 호출', async () => {
    const setScope = vi.fn();
    mockUseFileSearch.mockReturnValue({ ...baseState, scope: 'folder', setScope });

    render(<SearchInput folderId="p-1" />);
    await userEvent.click(screen.getByRole('button', { name: '전체' }));

    expect(setScope).toHaveBeenCalledWith('all');
  });

  it('scope toggle: "이 폴더" 클릭 시 setScope("folder") 호출', async () => {
    const setScope = vi.fn();
    mockUseFileSearch.mockReturnValue({ ...baseState, setScope });

    render(<SearchInput folderId="p-1" />);
    await userEvent.click(screen.getByRole('button', { name: '이 폴더' }));

    expect(setScope).toHaveBeenCalledWith('folder');
  });

  it('folderId 가 null 이면 "이 폴더" 버튼이 disabled 되고 안내 tooltip 이 부착된다', () => {
    render(<SearchInput folderId={null} />);
    const folderBtn = screen.getByRole('button', { name: '이 폴더' });

    expect(folderBtn).toBeDisabled();
    expect(folderBtn).toHaveAttribute('title', '폴더 안에서만 사용 가능');
  });

  it('folderId 가 설정되면 "이 폴더" 버튼은 활성 상태', () => {
    render(<SearchInput folderId="p-1" />);
    const folderBtn = screen.getByRole('button', { name: '이 폴더' });
    expect(folderBtn).not.toBeDisabled();
  });

  it('현재 scope 가 aria-pressed 로 표시된다 (a11y)', () => {
    mockUseFileSearch.mockReturnValue({ ...baseState, scope: 'all' });
    render(<SearchInput folderId="p-1" />);

    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '이 폴더' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('compositionstart/compositionend 가 useFileSearch 의 IME 핸들러로 연결된다', () => {
    const onCompositionStart = vi.fn();
    const onCompositionEnd = vi.fn();
    mockUseFileSearch.mockReturnValue({ ...baseState, onCompositionStart, onCompositionEnd });

    render(<SearchInput folderId={null} />);
    const input = screen.getByRole('searchbox');

    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    expect(onCompositionStart).toHaveBeenCalled();

    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    expect(onCompositionEnd).toHaveBeenCalled();
  });
});
