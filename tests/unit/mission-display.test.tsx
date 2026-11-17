import { test, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import Missions from '../../src/components/missions';
import { initialPlayer } from '../../src/game/core';
import { missionStatus } from '../../src/game/missions';
test('completed quests move down, remain claimable and return after renewal', () => {
  const player = initialPlayer();
  player.summons = 1;
  const date = new Date('2026-10-29T12:00:00Z');
  const claim = vi.fn(),
    daily = vi.fn();
  const statuses = missionStatus(player, { daily: 3, weekly: 4 }, date);
  const { rerender } = render(
    <Missions
      player={player}
      missions={statuses}
      busy={false}
      onClaim={claim}
      onDaily={daily}
      dayKey="2026-10-29"
    />,
  );
  const ongoing = screen.getByRole('region', { name: 'Quêtes en cours' }),
    completed = screen.getByRole('region', { name: 'Quêtes terminées' });
  expect(
    within(ongoing).queryByRole('heading', { name: 'Premier passage' }),
  ).not.toBeInTheDocument();
  const first = within(completed)
    .getByRole('heading', { name: 'Premier passage' })
    .closest('.mission-row') as HTMLElement;
  fireEvent.click(within(first).getByRole('button', { name: 'Récupérer' }));
  expect(claim).toHaveBeenCalledWith('first');
  expect(
    within(completed).getByRole('heading', {
      name: 'Trois portes aujourd’hui',
    }),
  ).toBeInTheDocument();
  expect(
    ongoing.compareDocumentPosition(completed) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  const claimed = {
    ...player,
    daily: '2026-10-29',
    claimed: ['first', 'daily-three:2026-10-29'],
  };
  rerender(
    <Missions
      player={claimed}
      missions={missionStatus(claimed, { daily: 3, weekly: 4 }, date)}
      busy={false}
      onClaim={claim}
      onDaily={daily}
      dayKey="2026-10-29"
    />,
  );
  expect(
    within(completed).getByRole('heading', { name: 'Récompense quotidienne' }),
  ).toBeInTheDocument();
  expect(
    within(
      within(completed)
        .getByRole('heading', { name: 'Premier passage' })
        .closest('.mission-row') as HTMLElement,
    ).getByRole('button', { name: 'Récupéré' }),
  ).toBeDisabled();
  rerender(
    <Missions
      player={claimed}
      missions={missionStatus(
        claimed,
        { daily: 0, weekly: 4 },
        new Date('2026-10-30T12:00:00Z'),
      )}
      busy={false}
      onClaim={claim}
      onDaily={daily}
      dayKey="2026-10-30"
    />,
  );
  expect(
    within(ongoing).getByRole('heading', { name: 'Trois portes aujourd’hui' }),
  ).toBeInTheDocument();
  expect(
    within(completed).queryByRole('heading', {
      name: 'Trois portes aujourd’hui',
    }),
  ).not.toBeInTheDocument();
  expect(
    within(completed).getByRole('heading', { name: 'Premier passage' }),
  ).toBeInTheDocument();
  expect(
    within(completed).queryByRole('heading', {
      name: 'Récompense quotidienne',
    }),
  ).not.toBeInTheDocument();
});
