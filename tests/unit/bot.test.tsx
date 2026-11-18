import { test, expect, vi } from 'vitest';
import { botReply, replyVisibility } from '../../bot/replies';
import { botConfig } from '../../bot/config';
import { commands } from '../../bot/commands';
import { handleEconomy, economyVisibility } from '../../bot/economy';
import type { Interaction } from 'discord.js';
import type { FinanceService } from '../../src/server/finance';
const site = 'https://sorarng.example',
  id = '900000000000000001';
const state = {
  munny: 5000,
  tickets: 2,
  fragments: 10,
  summons: 3,
  copies: [
    { cardId: 'KH-001', holo: false },
    { cardId: 'KH-001', holo: true },
  ],
  discoveries: ['KH-001', 'KH-002'],
};
test('balances and gambling results are public while bank actions and rewards remain private', () => {
  for (const command of [
    'solde',
    'double',
    'roulette',
    'guess',
    'coinflip',
    'duel-des',
  ])
    expect(economyVisibility(command)).toEqual({});
  for (const command of ['banque', 'don', 'hourly'])
    expect(economyVisibility(command)).toMatchObject({ flags: 64 });
});
test.each(['modal', 'abandon'])(
  'Guess Number %s responses are public',
  async (mode) => {
    const game = {
      id: 'test-game',
      authorId: id,
      opponentId: null,
      kind: 'guess',
      status: mode === 'modal' ? 'active' : 'abandoned',
      expiresAt: null,
      state: {
        stake: 100,
        attempts: [],
        answer: mode === 'abandon' ? 42 : undefined,
      },
    };
    const finance = {
      action: vi.fn().mockResolvedValue({ kind: 'guess', wallet: 1000, game }),
    };
    const interaction = {
      isButton: () => mode === 'abandon',
      isModalSubmit: () => mode === 'modal',
      customId:
        mode === 'modal' ? 'econ:number:test-game' : 'econ:abandon:test-game',
      user: { id },
      id: 'interaction',
      guildId: 'guild',
      fields: { getTextInputValue: () => '20' },
      deferReply: vi.fn(),
      editReply: vi.fn(),
    };
    expect(
      await handleEconomy(
        interaction as unknown as Interaction,
        finance as unknown as FinanceService,
      ),
    ).toBe(true);
    expect(interaction.deferReply).toHaveBeenCalledWith({});
    expect(interaction.editReply).toHaveBeenCalled();
  },
);
test('collection is public while profile responses stay private', () => {
  expect(replyVisibility('collection')).toEqual({});
  expect(replyVisibility('profile')).toMatchObject({ flags: 64 });
});
test('bot command declarations are unique and config never echoes invalid secrets', () => {
  const names = commands.map((c) => c.name);
  expect(names).toHaveLength(30);
  expect(new Set(names).size).toBe(30);
  expect(names).toContain('defi-maintenant');
  expect(names).toContain('defis');
  expect(names).not.toContain('ajouter-argent');
  expect(
    commands.find((command) => command.name === 'double')?.options,
  ).toMatchObject([{ name: 'mise', required: true, type: 3 }]);
  expect(names).toContain('don');
  expect(names).not.toContain('cf');
  expect(names).not.toContain('partie');
  expect(
    commands.find((command) => command.name === 'solde')?.options,
  ).toMatchObject([{ name: 'pseudo', required: false, type: 6 }]);
  expect(names).toEqual(
    expect.arrayContaining([
      'play',
      'profile',
      'collection',
      'leaderboard',
      'quetes',
      'serie',
      'guilde',
      'saison',
      'help',
      'hourly',
      'daily',
      'weekly',
      'monthly',
      'banque',
      'roulette',
      'guess',
      'coinflip',
      'duel-des',
      'solde',
    ]),
  );
  const env = {
    DISCORD_BOT_TOKEN: 'PRIVATE-CANARY',
    DISCORD_APPLICATION_ID: id,
    DISCORD_SITE_URL: site,
  };
  try {
    botConfig(env);
    throw new Error('Expected invalid configuration');
  } catch (error) {
    expect(String(error)).not.toContain('PRIVATE-CANARY');
  }
  expect(() =>
    botConfig(
      {
        ...env,
        DISCORD_BOT_TOKEN: 'valid-test-token-long-enough',
        DISCORD_SITE_URL: 'https://user:PRIVATE-CANARY@example.com',
      },
      { database: false },
    ),
  ).toThrow('Configuration');
});

test.each([null, { id: '900000000000000002', username: 'Autre membre' }])(
  'balance targets the optional member or the caller without mutating accounts: %j',
  async (target) => {
    const finance = {
      expireDue: vi.fn(),
      view: vi.fn().mockResolvedValue({
        wallet: 1234,
        bank: '500',
        reserved: 0,
        bonuses: {},
      }),
    };
    const interaction = {
      isButton: () => false,
      isModalSubmit: () => false,
      isChatInputCommand: () => true,
      commandName: 'solde',
      user: { id },
      id: 'interaction',
      options: { getUser: vi.fn().mockReturnValue(target) },
      deferReply: vi.fn(),
      editReply: vi.fn(),
    };
    expect(
      await handleEconomy(
        interaction as unknown as Interaction,
        finance as unknown as FinanceService,
      ),
    ).toBe(true);
    expect(finance.view).toHaveBeenCalledWith(target?.id ?? id);
    expect(interaction.deferReply).toHaveBeenCalledExactlyOnceWith({});
    const response = JSON.stringify(interaction.editReply.mock.calls[0]);
    expect(response).toContain('1');
    expect(response).toContain('Épargne');
    expect(response).toContain('500 Munny');
    expect(response).toContain(
      target ? 'Solde de Autre membre' : 'Votre solde',
    );
  },
);
test('bot reads the invoking Discord identity only and preserves inventory and resources', async () => {
  const findState = vi.fn(async () => state);
  const before = structuredClone(state);
  const profile = await botReply('profile', id, site, { findState });
  expect(findState).toHaveBeenCalledExactlyOnceWith(id);
  const fields = profile.embeds![0].toJSON().fields!;
  expect(fields.find((f) => f.name === 'Codex')?.value).toBe('2 / 150');
  expect(fields.find((f) => f.name === 'Tickets')?.value).toBe('2');
  const collection = await botReply('collection', id, site, { findState });
  expect(
    collection
      .embeds![0].toJSON()
      .fields!.find((f) => f.name === 'Modèles présents')?.value,
  ).toBe('1 / 150');
  expect(collection.allowedMentions).toEqual({ parse: [] });
  expect(state).toEqual(before);
});
test('missing and suspended profiles do not create accounts or expose their resources', async () => {
  const missing = await botReply('profile', id, site, {
    findState: async () => null,
  });
  expect(missing.embeds![0].toJSON().description).toContain('Aucun profil');
  const suspended = await botReply('collection', id, site, {
    findState: async () => ({ ...state, moderation: { suspended: true } }),
  });
  expect(suspended.content).toContain('suspendu');
  expect(suspended).not.toHaveProperty('embeds');
});
test('play, help and construction ranking require no database lookup', async () => {
  const findState = vi.fn(async () => {
    throw new Error('must not read');
  });
  for (const command of ['play', 'help', 'leaderboard']) {
    const response = await botReply(command, id, site, { findState });
    expect(response.allowedMentions).toEqual({ parse: [] });
  }
  await botReply('unexpected', id, site, { findState });
  await botReply('profile', 'invalid', site, { findState });
  expect(findState).not.toHaveBeenCalled();
});
