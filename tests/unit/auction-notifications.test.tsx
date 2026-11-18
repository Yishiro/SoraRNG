// @vitest-environment node
import { test, expect, vi } from 'vitest';
import type { Client } from 'discord.js';
import {
  noticeMessage,
  discordNoticeDelivery,
  type PendingNotice,
} from '../../bot/auction-notifications';
const base: PendingNotice = {
  id: '0123456789abcdef01234567',
  playerId: '100000000000000001',
  auctionId: 'a',
  kind: 'outbid',
  attempts: 0,
  name: 'Sora',
  version: 'KH1',
  payload: {
    amount: 2500,
    copy: {
      id: 'c',
      cardId: 'KH-001',
      holo: true,
      level: 1,
      awakening: 0,
      favorite: false,
      locked: false,
    },
  },
};
test.each(['outbid', 'won', 'sold', 'unsold', 'wishlist'] as const)(
  'notification %s has no mentions and uses the stable Discord nonce',
  (kind) => {
    const message = noticeMessage({ ...base, kind }, 'https://example.com');
    expect(message.allowedMentions).toEqual({ parse: [] });
    expect(message.nonce).toBe(base.id);
    expect(message.enforceNonce).toBe(true);
    expect(JSON.stringify(message)).toContain('Sora');
    expect(JSON.stringify(message)).toContain('/settings');
    if (kind !== 'unsold') expect(JSON.stringify(message)).toMatch(/2.500/);
  },
);
test('ambiguous sends are reconciled from the DM history before retrying', async () => {
  const send = vi.fn(async () => ({ id: 'new' }));
  const channel = {
    send,
    messages: {
      fetch: vi.fn(async () => [
        {
          id: 'previous',
          author: { id: 'bot' },
          embeds: [{ url: `https://example.com/trade#notice-${base.id}` }],
        },
      ]),
    },
  };
  const client = {
    user: { id: 'bot' },
    users: { fetch: vi.fn(async () => ({ createDM: async () => channel })) },
  } as unknown as Client;
  expect(
    await discordNoticeDelivery(
      client,
      'https://example.com',
    )({ ...base, attempts: 1 }),
  ).toBe('previous');
  expect(send).not.toHaveBeenCalled();
});
test('first delivery sends a DM with nonce checking enabled', async () => {
  const send = vi.fn(async () => ({ id: 'new' }));
  const client = {
    users: { fetch: vi.fn(async () => ({ createDM: async () => ({ send }) })) },
  } as unknown as Client;
  expect(await discordNoticeDelivery(client, 'https://example.com')(base)).toBe(
    'new',
  );
  expect(send.mock.calls[0]).toBeDefined();
});
