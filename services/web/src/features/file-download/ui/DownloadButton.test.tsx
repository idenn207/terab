import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DownloadButton } from './DownloadButton';

const { mockTrigger, mockState } = vi.hoisted(() => ({
  mockTrigger: vi.fn(),
  mockState: { isPending: false },
}));

vi.mock('../model/useDownloadFile', () => ({
  useDownloadFile: () => ({ trigger: mockTrigger, isPending: mockState.isPending, error: null }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockState.isPending = false;
});

describe('DownloadButton', () => {
  it('클릭 시 trigger(fileId, fileName) 를 호출한다', async () => {
    mockTrigger.mockResolvedValue(undefined);
    render(<DownloadButton fileId="f-1" fileName="a.png" />);

    await userEvent.click(screen.getByRole('button', { name: '다운로드' }));
    expect(mockTrigger).toHaveBeenCalledWith('f-1', 'a.png');
  });

  it('isPending=true 면 disabled 이고 라벨이 변경된다', () => {
    mockState.isPending = true;
    render(<DownloadButton fileId="f-1" fileName="a.png" />);

    const button = screen.getByRole('button', { name: '다운로드 중...' });
    expect(button).toBeDisabled();
  });

  it('상위 클릭 핸들러로 이벤트가 전파되지 않는다 (stopPropagation)', async () => {
    mockTrigger.mockResolvedValue(undefined);
    const onParentClick = vi.fn();

    render(
      <div onClick={onParentClick}>
        <DownloadButton fileId="f-1" fileName="a.png" />
      </div>,
    );
    await userEvent.click(screen.getByRole('button', { name: '다운로드' }));

    expect(onParentClick).not.toHaveBeenCalled();
    expect(mockTrigger).toHaveBeenCalled();
  });
});
