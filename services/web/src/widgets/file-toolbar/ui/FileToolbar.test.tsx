import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FileToolbar } from './FileToolbar';

vi.mock('@/features', () => ({
  UploadButton: () => <button type="button">업로드</button>,
}));

describe('FileToolbar', () => {
  it('UploadButton 을 노출한다', () => {
    render(<FileToolbar />);

    expect(screen.getByRole('button', { name: '업로드' })).toBeInTheDocument();
  });
});
