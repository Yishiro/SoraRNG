import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from '../../app/page';
test('game landing page renders', () => {
  render(<Home />);
  expect(
    screen.getByRole('heading', { name: 'Collection Kingdom Hearts' }),
  ).toBeInTheDocument();
});
