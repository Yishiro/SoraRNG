// @vitest-environment node
import { expect, test } from 'vitest';
import {
  staffRole,
  requireStaff,
  ForbiddenAccess,
} from '../../src/server/permissions';
import { eventStatus } from '../../src/game/events';
import { selectStackQuantity, tradeStacks } from '../../src/game/trade-stacks';
import type { Copy } from '../../src/game/core';
const copy = (id: string, extra: Partial<Copy> = {}): Copy => ({
  id,
  cardId: 'KH-001',
  holo: false,
  level: 1,
  awakening: 0,
  favorite: false,
  locked: false,
  ...extra,
});
test('aucun rôle implicite et listes Discord strictes', () => {
  const id = '123456789012345678';
  expect(staffRole(id, {})).toBe('player');
  expect(
    staffRole(id, {
      ADMIN_DISCORD_IDS: `bad, ${id} `,
      MODERATOR_DISCORD_IDS: id,
    }),
  ).toBe('admin');
  expect(staffRole(id, { MODERATOR_DISCORD_IDS: id })).toBe('moderator');
  expect(staffRole('bad', { ADMIN_DISCORD_IDS: 'bad' })).toBe('player');
  expect(() => requireStaff('not-an-id')).toThrow(ForbiddenAccess);
});
test('frontières exactes du calendrier', () => {
  const event = {
    startsAt: '2026-10-29T12:00:00Z',
    endsAt: '2026-10-29T13:00:00Z',
  };
  expect(eventStatus(event, Date.parse(event.startsAt) - 1)).toBe('upcoming');
  expect(eventStatus(event, Date.parse(event.startsAt))).toBe('active');
  expect(eventStatus(event, Date.parse(event.endsAt))).toBe('ended');
});
test('piles séparées par finition, niveau, éveil, favori et exclusion des verrous', () => {
  const groups = tradeStacks([
    copy('b'),
    copy('a'),
    copy('h', { holo: true }),
    copy('l', { level: 2 }),
    copy('e', { awakening: 1 }),
    copy('f', { favorite: true }),
    copy('x', { locked: true }),
  ]);
  expect(groups).toHaveLength(5);
  expect(groups[0].copies.map((c) => c.id)).toEqual(['a', 'b']);
  expect(groups.flatMap((g) => g.copies).some((c) => c.id === 'x')).toBe(false);
});
test('quantités déterministes, sélection conservée et plafond de 50', () => {
  const copies = [copy('a'), copy('b'), copy('c')];
  expect(selectStackQuantity(['b', 'other'], copies, 2)).toEqual([
    'other',
    'b',
    'a',
  ]);
  expect(selectStackQuantity(['b', 'other'], copies, 0)).toEqual(['other']);
  for (const n of [-1, 4, 0.5, NaN])
    expect(() => selectStackQuantity([], copies, n)).toThrow();
  expect(() =>
    selectStackQuantity(
      Array.from({ length: 50 }, (_, i) => `other${i}`),
      copies,
      1,
    ),
  ).toThrow('50');
});
