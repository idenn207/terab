import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Modal } from './Modal';

function ModalHarness({
  initialOpen = false,
  dismissible,
  onCloseSpy,
}: {
  initialOpen?: boolean;
  dismissible?: boolean;
  onCloseSpy?: () => void;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <Modal
        open={open}
        onClose={() => {
          onCloseSpy?.();
          setOpen(false);
        }}
        dismissible={dismissible}
      >
        <Modal.Header>제목</Modal.Header>
        <Modal.Body>내용</Modal.Body>
        <Modal.Footer>
          <button type="button" onClick={() => setOpen(false)}>
            확인
          </button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

describe('Modal — 열림/닫힘', () => {
  it('open=false 일 때 컨텐츠가 hidden', () => {
    render(<ModalHarness initialOpen={false} />);
    expect(screen.queryByText('제목')).toBeNull();
  });

  it('open=true 일 때 dialog role 노출', () => {
    render(<ModalHarness initialOpen={true} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('제목')).toBeInTheDocument();
  });
});

describe('Modal — a11y', () => {
  it('aria-modal="true" 자동 부착 (Headless.Dialog)', () => {
    render(<ModalHarness initialOpen={true} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('DialogTitle 이 dialog 의 aria-labelledby 로 연결', () => {
    render(<ModalHarness initialOpen={true} />);
    const dialog = screen.getByRole('dialog');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    if (labelledBy) {
      expect(document.getElementById(labelledBy)).toHaveTextContent('제목');
    }
  });
});

describe('Modal — dismissible 분기', () => {
  it('dismissible=true 기본: Esc 누르면 onClose 호출', () => {
    const spy = vi.fn();
    render(<ModalHarness initialOpen={true} onCloseSpy={spy} />);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(spy).toHaveBeenCalled();
  });

  it('dismissible=false: Esc 무시', () => {
    const spy = vi.fn();
    render(<ModalHarness initialOpen={true} dismissible={false} onCloseSpy={spy} />);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('Modal — compound 슬롯', () => {
  it('Header/Body/Footer 모두 렌더', () => {
    render(<ModalHarness initialOpen={true} />);
    expect(screen.getByText('제목')).toBeInTheDocument();
    expect(screen.getByText('내용')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '확인' })).toBeInTheDocument();
  });
});

describe('Modal — mobile-first BottomSheet vs desktop Dialog', () => {
  it('panel 에 mobile=BottomSheet (rounded-t-2xl) + desktop=Dialog (sm:rounded-2xl) 클래스 동시 부착', () => {
    render(<ModalHarness initialOpen={true} />);
    // panel 은 dialog 의 inner DialogPanel — 제목 텍스트 가진 가장 가까운 panel 조상으로 식별
    const heading = screen.getByText('제목');
    const panel = heading.closest('[class*="rounded-t-2xl"]');
    expect(panel).not.toBeNull();
    expect(panel?.className).toContain('rounded-t-2xl');
    expect(panel?.className).toContain('sm:rounded-2xl');
  });
});
