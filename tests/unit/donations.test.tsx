import { test, expect, vi } from 'vitest';
import { revealResult } from '../../bot/economy';
import { donationConfirmation, readDonation } from '../../bot/donations';
test('donation confirmation binds author, amount, recipient, secret and expiration', () => {
  const id = donationConfirmation(
    '100000000000000001',
    '100000000000000002',
    5000,
    'test-secret',
    1000000,
  );
  expect(id.length).toBeLessThanOrEqual(100);
  expect(
    readDonation(id, '100000000000000001', 'test-secret', 1001000),
  ).toMatchObject({ recipient: '100000000000000002', amount: 5000 });
  expect(() =>
    readDonation(id, '100000000000000002', 'test-secret', 1001000),
  ).toThrow();
  expect(() =>
    readDonation(id, '100000000000000001', 'different-secret', 1001000),
  ).toThrow();
  expect(() =>
    readDonation(
      id.replace('100000000000000002', '100000000000000003'),
      '100000000000000001',
      'test-secret',
      1001000,
    ),
  ).toThrow();
  expect(() =>
    readDonation(id, '100000000000000001', 'test-secret', 1301000),
  ).toThrow();
});
test('animated reveal ends with the saved result and still delivers it if an animation edit fails', async () => {
  vi.useFakeTimers();
  try {
    const result = {
      kind: 'roulette',
      wallet: 1200,
      roulette: {
        number: 1,
        color: 'rouge',
        won: true,
        payout: 200,
        stake: 100,
      },
    };
    const edit = vi.fn().mockResolvedValue(undefined);
    const pending = revealResult(edit, result);
    await vi.runAllTimersAsync();
    await pending;
    expect(edit).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(edit.mock.calls[2])).toContain('200');
    const unreliable = vi
      .fn()
      .mockRejectedValueOnce(new Error('Temporary edit failure'))
      .mockResolvedValue(undefined);
    await revealResult(unreliable, result);
    expect(unreliable).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(unreliable.mock.calls[1])).toContain('200');
  } finally {
    vi.useRealTimers();
  }
});
