import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { initialPlayer, type Player } from '../../src/game/core';
import { liveCatalog, parseSourceCatalog } from '../../src/game/catalog';
import {
  buildFighter,
  cardCanFight,
  createBattle,
} from '../../src/game/battle/engine';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cards = liveCatalog(
  parseSourceCatalog(
    JSON.parse(readFileSync('data/kingdom_hearts_catalogue_150.json', 'utf8')),
  ).cards,
);
const fighters = cards.filter(cardCanFight).slice(0, 3);
const copies = fighters.map((card, i) => ({
  id: `copy-${i}`,
  cardId: card.id,
  holo: false,
  level: 1,
  awakening: 0,
  locked: false,
  favorite: false,
}));
const team = fighters.map((card, i) => buildFighter(card, copies[i]));

function battleView(turn: number, finished = false) {
  const state = createBattle(team, team, 'graine-test');
  return {
    id: '00000000-0000-4000-8000-000000000001',
    status: finished ? 'finished' : 'active',
    winner: finished ? 'a' : null,
    result: finished
      ? {
          reason: 'victoire',
          attacker: { before: 1000, after: 1020 },
          defender: { before: 1000, after: 980 },
        }
      : null,
    state: { turn, teams: state.teams, active: state.active, winner: null },
    log: turn
      ? [
          {
            type: 'move',
            side: 'a',
            actor: team[0].name,
            move: team[0].moves[0].name,
            damage: 9,
            effectiveness: 1,
            turn,
          },
        ]
      : [],
    needsReplacement: false,
  };
}

for (const width of [1280, 375]) {
  test(`arène : équipe, attaque et tour de combat (${width})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const player: Player = { ...initialPlayer(), copies };
    const posts: Record<string, unknown>[] = [];
    let saved: string[] | null = null;
    await page.route('**/api/game', (route) =>
      route.fulfill({
        json: {
          id: '100000000000000001',
          name: 'Test',
          state: player,
          cards,
          history: [],
          missions: [],
          quests: [],
        },
      }),
    );
    await page.route('**/api/arena**', (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        posts.push(body);
        if (body.action === 'team') {
          saved = body.copyIds;
          return route.fulfill({ json: { power: 500, league: 'bronze' } });
        }
        if (body.action === 'attack')
          return route.fulfill({ json: battleView(0) });
        if (body.action === 'turn')
          return route.fulfill({ json: battleView(1, true) });
      }
      return route.fulfill({
        json: {
          team: saved ? { copyIds: saved, power: 500, league: 'bronze' } : null,
          rating: { rating: 1000, wins: 0, losses: 0, draws: 0 },
          attacksLeft: 10,
          opponents: saved
            ? [
                {
                  id: '200000000000000002',
                  name: 'Rival',
                  power: 510,
                  rating: 1004,
                },
              ]
            : [],
          leaderboards: { bronze: [], argent: [], or: [], platine: [] },
          active: null,
          recent: [],
        },
      });
    });
    await page.route('**/api/catalog', (r) => r.fulfill({ json: { cards } }));
    await page.route('**/api/notifications', (r) =>
      r.fulfill({ json: { items: [], unread: 0 } }),
    );
    await page.route('**/api/listed-cards', (r) => r.fulfill({ json: [] }));
    await page.route('**/api/recent-drops', (r) =>
      r.fulfill({ json: { drops: [] } }),
    );

    await page.goto('/arena');
    await expect(
      page.getByRole('heading', { name: /Équipe de défense/ }),
    ).toBeVisible();
    for (const card of fighters)
      await page
        .getByRole('button', { name: new RegExp(escape(card.name)) })
        .first()
        .click();
    await page.getByRole('button', { name: 'Enregistrer l’équipe' }).click();
    await expect(page.getByText('Équipe enregistrée.')).toBeVisible();
    expect(posts[0]).toMatchObject({
      action: 'team',
      copyIds: ['copy-0', 'copy-1', 'copy-2'],
    });

    await page.getByRole('button', { name: /Attaquer/ }).click();
    await expect(
      page.getByRole('heading', { name: /Combat · tour 0/ }),
    ).toBeVisible();
    const attackPost = posts.find((p) => p.action === 'attack')!;
    expect(attackPost.battleId).toMatch(/^[0-9a-f-]{36}$/);
    await page
      .getByRole('button', { name: new RegExp(escape(team[0].moves[0].name)) })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Victoire !' }),
    ).toBeVisible();
    await expect(page.getByText(/1000 → 1020/)).toBeVisible();
    expect(posts.find((p) => p.action === 'turn')).toMatchObject({
      turn: 0,
      move: { type: 'move', index: 0 },
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });
}
