import { test, expect } from 'vitest';
import { initialPlayer } from '../../src/game/core';
import {
  bonusRules,
  claimBonus,
  bonusNext,
  bankMove,
  bankMicros,
  financeView,
  rouletteResult,
  reserve,
  release,
} from '../../src/game/finance';
import { publicGame, type SavedGame } from '../../src/server/finance';
import { gameMessage } from '../../bot/economy';
const day = 86400000;
test('four rolling bonuses use the approved amounts and do not accumulate missed claims', () => {
  expect(
    Object.fromEntries(
      Object.entries(bonusRules).map(([key, value]) => [key, value.amount]),
    ),
  ).toEqual({ hourly: 1000, daily: 5000, weekly: 5000, monthly: 10000 });
  const p = initialPlayer(),
    now = Date.parse('2026-10-29T12:00:00Z');
  for (const type of ['hourly', 'daily', 'weekly', 'monthly'] as const) {
    claimBonus(p, type, now);
    expect(() => claimBonus(p, type, now)).toThrow('disponible');
    expect(bonusNext(p, type)).toBe(now + bonusRules[type].delay);
  }
  expect(p.munny).toBe(21000);
  expect(p.fragments).toBe(10);
  claimBonus(p, 'hourly', now + 3 * day);
  expect(p.munny).toBe(22000);
});
test('bank compounds at two percent, accrues offline, keeps fractional interest and permits withdrawal', () => {
  const p = { ...initialPlayer(), munny: 10000 };
  bankMove(p, 'deposit', 'tout', 1000);
  expect(p.munny).toBe(0);
  expect(bankMicros(p, 1000 + day)).toBe(10200000000n);
  expect(bankMicros(p, 1000 + 2 * day)).toBe(10404000000n);
  const before = structuredClone(p);
  financeView(p, 1000 + day);
  expect(p).toEqual(before);
  bankMove(p, 'withdraw', '5000', 1000 + day);
  expect(p.munny).toBe(5000);
  expect(financeView(p, 1000 + 2 * day).bank).toBe('5304');
  expect(() => bankMove(p, 'withdraw', '999999', 1000 + 2 * day)).toThrow(
    'insuffisants',
  );
});
test('all-in stakes above 32 bits remain exact and escrow cannot be spent twice', () => {
  const p = { ...initialPlayer(), munny: 4000000000 };
  reserve(p, 4000000000, 2, 1000);
  expect(p.munny).toBe(0);
  expect(p.finance?.reserved).toBe(4000000000);
  expect(() => reserve(p, 1, 2, 1000)).toThrow('insuffisants');
  release(p, 4000000000, 2, 8000000000);
  expect(p.munny).toBe(8000000000);
  expect(p.finance?.reserved).toBe(0);
});
test('roulette uses one zero and consistent colors and number payouts', () => {
  const outcomes = Array.from({ length: 37 }, (_, number) =>
    rouletteResult('rouge', number),
  );
  expect(outcomes.filter((r) => r.color === 'rouge')).toHaveLength(18);
  expect(outcomes.filter((r) => r.color === 'noir')).toHaveLength(18);
  expect(outcomes.filter((r) => r.color === 'vert')).toHaveLength(1);
  expect(rouletteResult('vert', 0)).toMatchObject({
    won: true,
    multiplier: 36,
  });
  expect(rouletteResult('17', 17)).toMatchObject({ won: true, multiplier: 36 });
  expect(rouletteResult('noir', 0).won).toBe(false);
});
test('active guess messages do not leak the answer or advertise odds and potential payouts', () => {
  const game: SavedGame = {
    id: '00000000-0000-4000-8000-000000000001',
    authorId: '900000000000000001',
    opponentId: null,
    kind: 'guess',
    status: 'active',
    expiresAt: null,
    state: { stake: 100, secret: 42, attempts: [] },
  };
  const view = publicGame(game);
  expect(view.state).not.toHaveProperty('secret');
  expect(view.state).not.toHaveProperty('answer');
  const text = JSON.stringify(gameMessage(view));
  expect(text).not.toContain('secret');
  expect(text).not.toContain('Total reçu');
  expect(text).not.toContain('probabilité');
  expect(text).not.toContain('3×');
});
