import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UploadButton } from './UploadButton';

const { mockMutate, mockUseUploadFile } = vi.hoisted(() => {
  const mutate = vi.fn();
  return {
    mockMutate: mutate,
    mockUseUploadFile: vi.fn(() => ({ mutate, isPending: false })),
  };
});

vi.mock('../model/useUploadFile', () => ({
  useUploadFile: mockUseUploadFile,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseUploadFile.mockReturnValue({ mutate: mockMutate, isPending: false });
});

describe('UploadButton', () => {
  it('업로드 버튼 클릭 시 hidden input click 이 호출된다', () => {
    render(<UploadButton />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: '업로드' }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('파일 선택 시 onProgress 콜백과 함께 mutate 가 호출된다', () => {
    render(<UploadButton />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['a'], 'a.png', { type: 'image/png' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const [firstArg] = mockMutate.mock.calls[0];
    expect(firstArg.file).toBe(file);
    expect(typeof firstArg.onProgress).toBe('function');
  });

  it('isPending 동안 버튼은 disabled 상태가 된다', () => {
    mockUseUploadFile.mockReturnValueOnce({ mutate: mockMutate, isPending: true });
    render(<UploadButton />);
    expect(screen.getByRole('button', { name: '업로드 중...' })).toBeDisabled();
  });

  it('업로드 실패 시 role="alert" 로 에러 메시지를 노출한다', () => {
    mockMutate.mockImplementationOnce((_input, options) => {
      options?.onError?.(new Error('네트워크 끊김'));
    });
    render(<UploadButton />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
    expect(screen.getByRole('alert')).toHaveTextContent('네트워크 끊김');
  });

  it('진행률 변화 시 progressbar 의 value 가 갱신된다', () => {
    mockMutate.mockImplementationOnce((input) => {
      input.onProgress?.(42);
    });
    render(<UploadButton />);
    const inputEl = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(inputEl, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
    const progress = screen.getByRole('progressbar') as HTMLProgressElement;
    expect(progress.value).toBe(42);
  });
});
