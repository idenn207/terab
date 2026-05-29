import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/widgets', () => ({
  TrashList: () => <div data-testid="trash-list-mock" />,
}));

import { TrashPage } from './TrashPage';

describe('TrashPage', () => {
  it('헤더와 TrashList 위젯을 렌더링한다', () => {
    render(<TrashPage />);

    expect(screen.getByRole('heading', { name: '휴지통' })).toBeInTheDocument();
    expect(screen.getByTestId('trash-list-mock')).toBeInTheDocument();
  });
});
