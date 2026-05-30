import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { server } from '@tests/mocks';
import { makeQueryWrapper } from '@tests/wrappers';
import { InviteDialog } from './InviteDialog';

const handlerUrl = '/api/admin/users/invitations';

const sampleInvitation = {
  token: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  url: 'https://drive.skypark207.com/register/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  expiresAt: '2026-06-05T10:00:00.000Z',
};

// jsdom 은 native <dialog> 의 showModal/close 가 누락돼있어 polyfill 한다.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});

describe('InviteDialog', () => {
  it('open=true 시 폼이 표시된다', () => {
    const Wrapper = makeQueryWrapper();
    render(<InviteDialog open onClose={() => {}} />, { wrapper: Wrapper });
    expect(screen.getByLabelText('만료 기간 (일)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '초대 링크 생성' })).toBeInTheDocument();
  });

  it('폼 제출 시 mutation 호출 후 URL 결과 화면을 표시한다', async () => {
    server.use(http.post(handlerUrl, () => HttpResponse.json(sampleInvitation, { status: 201 })));
    const user = userEvent.setup();
    const Wrapper = makeQueryWrapper();
    render(<InviteDialog open onClose={() => {}} />, { wrapper: Wrapper });

    await user.click(screen.getByRole('button', { name: '초대 링크 생성' }));
    expect(await screen.findByText(sampleInvitation.url)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '링크 복사' })).toBeInTheDocument();
  });

  it('서버 오류 시 오류 메시지를 표시한다', async () => {
    server.use(http.post(handlerUrl, () => new HttpResponse(null, { status: 500 })));
    const user = userEvent.setup();
    const Wrapper = makeQueryWrapper();
    render(<InviteDialog open onClose={() => {}} />, { wrapper: Wrapper });

    await user.click(screen.getByRole('button', { name: '초대 링크 생성' }));
    expect(await screen.findByText(/초대 링크 생성에 실패/)).toBeInTheDocument();
  });

  it('취소 버튼 클릭 시 onClose 가 호출된다', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const Wrapper = makeQueryWrapper();
    render(<InviteDialog open onClose={onClose} />, { wrapper: Wrapper });

    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('링크 복사 버튼 클릭 시 clipboard 가 호출된다', async () => {
    server.use(http.post(handlerUrl, () => HttpResponse.json(sampleInvitation, { status: 201 })));
    const user = userEvent.setup(); // user-event v14 가 navigator.clipboard 를 자동 polyfill 한다
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const Wrapper = makeQueryWrapper();
    render(<InviteDialog open onClose={() => {}} />, { wrapper: Wrapper });

    await user.click(screen.getByRole('button', { name: '초대 링크 생성' }));
    const copyBtn = await screen.findByRole('button', { name: '링크 복사' });
    await user.click(copyBtn);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(sampleInvitation.url));
    expect(await screen.findByRole('button', { name: '복사됨' })).toBeInTheDocument();
  });
});
