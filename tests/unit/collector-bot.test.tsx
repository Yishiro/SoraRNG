import { expect, test, vi } from 'vitest';
import type { Interaction } from 'discord.js';
import type { Card } from '../../src/game/core';
import { initialPlayer } from '../../src/game/core';
import { financeView } from '../../src/game/finance';
import { handleCollector, cardChoices, exactCard } from '../../bot/collector';
const site = 'https://sorarng.example',
  user = '900000000000000001',
  target = '900000000000000002';
const cards = [
  {
    id: 'KH-001',
    name: 'Sora',
    version: 'Classique',
    rarity: 'Commun',
    affinity: 'Lumière',
  },
  {
    id: 'KH-002',
    name: 'Sora',
    version: 'Autre forme',
    rarity: 'Secret',
    affinity: 'Lumière',
  },
] as Card[];
function setup(
  command: string,
  options: { target?: string; sub?: string; card?: string; page?: number } = {},
) {
  const state = {
    ...initialPlayer(),
    munny: 987654321,
    wishlist: ['KH-002'],
    copies: [
      {
        id: 'copy-1',
        cardId: 'KH-001',
        holo: true,
        favorite: true,
        locked: false,
        level: 4,
        awakening: 2,
      },
    ],
  };
  const store = {
    cards: vi.fn().mockResolvedValue(cards),
    prices: vi.fn().mockResolvedValue({
      stats: [{ holo: false, average: 1500, count: 2 }],
      sales: [],
    }),
    profile: vi.fn().mockResolvedValue({ name: 'Alice', state }),
    wishlist: vi.fn().mockResolvedValue(undefined),
    market: vi.fn().mockResolvedValue([
      {
        id: 'sale',
        copy: { cardId: 'KH-001', holo: true },
        startPrice: 500,
        bid: 0,
        status: 'open',
        endsAt: new Date(Date.now() + 1000000),
      },
    ]),
    history: vi.fn().mockResolvedValue([
      {
        kind: 'deposit',
        delta: -500,
        before: 1000,
        after: 500,
        bankMicros: '500000000',
        reserved: 100,
        createdAt: new Date(),
      },
    ]),
  };
  const finance = {
    view: vi.fn().mockResolvedValue(financeView(state, Date.now())),
  };
  const interaction = {
    isAutocomplete: () => false,
    isChatInputCommand: () => true,
    commandName: command,
    user: { id: user },
    id: '900000000000000010',
    options: {
      getUser: vi.fn(() => (options.target ? { id: options.target } : null)),
      getString: vi.fn(() => options.card ?? 'KH-001'),
      getInteger: vi.fn(() => options.page ?? 1),
      getSubcommand: vi.fn(() => options.sub ?? 'afficher'),
    },
    deferReply: vi.fn(),
    editReply: vi.fn(),
  };
  const run = () =>
    handleCollector(
      interaction as unknown as Interaction,
      store,
      finance,
      site,
    );
  return { store, finance, interaction, run, state };
}
test('card search preserves versions and refuses ambiguous names', () => {
  expect(cardChoices(cards, 'sora')).toHaveLength(2);
  expect(cardChoices(cards, 'autre')[0].value).toBe('KH-002');
  expect(exactCard(cards, 'KH-002').version).toBe('Autre forme');
  expect(() => exactCard(cards, 'Sora')).toThrow('Plusieurs versions');
  expect(() => exactCard(cards, 'absent')).toThrow('introuvable');
  expect(
    cardChoices(
      Array.from({ length: 40 }, () => ({
        ...cards[0],
        name: 'x'.repeat(200),
      })),
      '',
    ).every((x) => x.name.length <= 100),
  ).toBe(true);
});
test('card embeds use exact model, legend and completed-sale means without private state', async () => {
  const s = setup('carte');
  await s.run();
  expect(s.store.prices).toHaveBeenCalledWith('KH-001');
  expect(s.interaction.deferReply).toHaveBeenCalledWith({});
  const text = JSON.stringify(s.interaction.editReply.mock.calls);
  expect(text).toContain('Classique');
  expect(text).toContain('peu de références');
  expect(text).not.toContain('987654321');
  expect(s.store.profile).not.toHaveBeenCalled();
});
test.each([undefined, target])(
  'public collection reads the selected member and never includes balances (%s)',
  async (member) => {
    const s = setup('collection', { target: member });
    await s.run();
    expect(s.store.profile).toHaveBeenCalledWith(member ?? user);
    expect(s.interaction.deferReply).toHaveBeenCalledWith({});
    const text = JSON.stringify(s.interaction.editReply.mock.calls);
    expect(text).toContain(`/profile/${member ?? user}`);
    expect(text).not.toContain('987654321');
    expect(s.store.wishlist).not.toHaveBeenCalled();
  },
);
test.each(['ajouter', 'retirer'])(
  'wishlist %s writes only the invoking account, with a stable interaction key',
  async (sub) => {
    const s = setup('wishlist', { sub, target });
    await s.run();
    expect(s.store.wishlist).toHaveBeenCalledExactlyOnceWith(
      user,
      'discord:900000000000000010',
      'KH-001',
      sub === 'ajouter',
    );
    expect(s.interaction.deferReply).toHaveBeenCalledWith({ flags: 64 });
  },
);
test('wishlist display remains private and reads shared site state', async () => {
  const s = setup('wishlist');
  await s.run();
  expect(s.store.profile).toHaveBeenCalledWith(user);
  expect(s.interaction.deferReply).toHaveBeenCalledWith({ flags: 64 });
  expect(JSON.stringify(s.interaction.editReply.mock.calls)).toContain(
    'Autre forme',
  );
  expect(s.store.wishlist).not.toHaveBeenCalled();
});
test.each(['marche', 'ventes'])(
  '%s applies public/private scope and pagination',
  async (command) => {
    const s = setup(command, { page: 2 });
    await s.run();
    expect(s.store.market).toHaveBeenCalledWith(
      command === 'marche' ? 'KH-001' : null,
      command === 'ventes' ? user : null,
      2,
    );
    expect(s.interaction.deferReply).toHaveBeenCalledWith(
      command === 'ventes' ? { flags: 64 } : {},
    );
  },
);
test('private history cannot select another member and exposes recorded reserve/bank separately', async () => {
  const s = setup('historique', { target });
  await s.run();
  expect(s.store.history).toHaveBeenCalledExactlyOnceWith(user);
  expect(s.interaction.options.getUser).not.toHaveBeenCalled();
  expect(s.interaction.deferReply).toHaveBeenCalledWith({ flags: 64 });
  expect(JSON.stringify(s.interaction.editReply.mock.calls)).toContain(
    'Épargne enregistrée',
  );
});
test('bonus lists the four cooldowns without claiming money', async () => {
  const s = setup('bonus');
  await s.run();
  expect(s.finance.view).toHaveBeenCalledExactlyOnceWith(user);
  for (const name of ['hourly', 'daily', 'weekly', 'monthly'])
    expect(JSON.stringify(s.interaction.editReply.mock.calls)).toContain(
      '/' + name,
    );
  expect(s.interaction.deferReply).toHaveBeenCalledWith({ flags: 64 });
  expect(s.store.wishlist).not.toHaveBeenCalled();
});
test('showcase publishes only favorites and preserves their actual finish and level', async () => {
  const s = setup('vitrine');
  await s.run();
  expect(s.store.profile).toHaveBeenCalledWith(user);
  const text = JSON.stringify(s.interaction.editReply.mock.calls);
  expect(text).toContain('Holographique');
  expect(text).toContain('Niveau 4');
  expect(text).not.toContain('987654321');
  expect(s.interaction.deferReply).toHaveBeenCalledWith({});
  expect(s.state.copies[0].favorite).toBe(true);
});
