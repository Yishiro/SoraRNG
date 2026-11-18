// Quêtes journalières (10 par jour, 250 à 1 000 Munny) et hebdomadaires
// (50 par semaine, 500 à 2 000 Munny). La sélection est déterministe pour une
// période donnée : tous les joueurs voient les mêmes quêtes.
import type { Card, Copy } from './core';
import { rarities } from './config';
import { missionPeriods } from './missions';

export const activityMetrics = [
  'cards',
  'boosters',
  'holos',
  'rarePlus',
  'epicPlus',
  'legendPlus',
  'upgrades',
  'awakenings',
  'recycles',
  'fusions',
  'statPoints',
  'shop',
  'bonuses',
  'deposits',
  'games',
  'donations',
  'trades',
  'auctions',
  'wishlist',
  'showcase',
  'favorites',
  'challenges',
  'dailyQuests',
] as const;
export type ActivityMetric = (typeof activityMetrics)[number];
export type Activity = Record<ActivityMetric, number>;

export const emptyActivity = (): Activity =>
  Object.fromEntries(activityMetrics.map((m) => [m, 0])) as Activity;

export type QuestTemplate = {
  id: string;
  name: string;
  metric: ActivityMetric;
  target: number;
  munny: number;
};

const q = (
  id: string,
  name: string,
  metric: ActivityMetric,
  target: number,
  munny: number,
): QuestTemplate => ({ id, name, metric, target, munny });

export const dailyPool: QuestTemplate[] = [
  q('d-booster-1', 'Ouvrir un booster', 'boosters', 1, 250),
  q('d-booster-3', 'Ouvrir trois boosters', 'boosters', 3, 600),
  q('d-booster-5', 'Ouvrir cinq boosters', 'boosters', 5, 1000),
  q('d-cards-15', 'Révéler 15 cartes', 'cards', 15, 500),
  q('d-rare-1', 'Obtenir une Rare ou mieux', 'rarePlus', 1, 400),
  q('d-rare-3', 'Obtenir trois Rares ou mieux', 'rarePlus', 3, 800),
  q('d-epic-1', 'Obtenir une Épique ou mieux', 'epicPlus', 1, 1000),
  q('d-bonus-1', 'Réclamer un bonus', 'bonuses', 1, 250),
  q('d-bonus-2', 'Réclamer deux bonus', 'bonuses', 2, 400),
  q('d-upgrade-1', 'Améliorer une carte', 'upgrades', 1, 300),
  q('d-upgrade-3', 'Améliorer trois fois', 'upgrades', 3, 700),
  q('d-recycle-1', 'Recycler une carte', 'recycles', 1, 250),
  q('d-fusion-1', 'Réussir une fusion', 'fusions', 1, 800),
  q('d-stat-1', 'Répartir un point de statistique', 'statPoints', 1, 300),
  q('d-shop-1', 'Faire un achat en boutique', 'shop', 1, 300),
  q('d-deposit-1', 'Déposer à la banque', 'deposits', 1, 250),
  q('d-game-1', 'Jouer à un mini-jeu Discord', 'games', 1, 300),
  q('d-game-3', 'Jouer à trois mini-jeux Discord', 'games', 3, 700),
  q('d-favorite-1', 'Marquer un favori', 'favorites', 1, 250),
  q('d-wishlist-1', 'Mettre à jour sa liste de souhaits', 'wishlist', 1, 250),
  q('d-auction-1', 'Mettre une carte aux enchères', 'auctions', 1, 500),
  q('d-showcase-1', 'Arranger sa vitrine', 'showcase', 1, 250),
];

const tiers = (
  prefix: string,
  label: (n: number) => string,
  metric: ActivityMetric,
  steps: [number, number][],
) =>
  steps.map(([n, munny]) => q(`w-${prefix}-${n}`, label(n), metric, n, munny));

export const weeklyPool: QuestTemplate[] = [
  ...tiers('booster', (n) => `Ouvrir ${n} boosters`, 'boosters', [
    [5, 500],
    [10, 800],
    [20, 1200],
    [35, 1600],
    [50, 2000],
  ]),
  ...tiers('cards', (n) => `Révéler ${n} cartes`, 'cards', [
    [25, 500],
    [75, 900],
    [150, 1400],
    [250, 2000],
  ]),
  ...tiers('rare', (n) => `Obtenir ${n} Rares ou mieux`, 'rarePlus', [
    [3, 500],
    [8, 900],
    [15, 1400],
  ]),
  ...tiers('epic', (n) => `Obtenir ${n} Épiques ou mieux`, 'epicPlus', [
    [1, 600],
    [4, 1200],
    [8, 1800],
  ]),
  ...tiers(
    'legend',
    (n) => `Obtenir ${n} Légendaire(s) ou mieux`,
    'legendPlus',
    [
      [1, 1500],
      [3, 2000],
    ],
  ),
  ...tiers('holo', (n) => `Obtenir ${n} carte(s) holographique(s)`, 'holos', [
    [1, 2000],
  ]),
  ...tiers('bonus', (n) => `Réclamer ${n} bonus`, 'bonuses', [
    [3, 500],
    [7, 900],
    [14, 1500],
  ]),
  ...tiers('upgrade', (n) => `Améliorer ${n} fois des cartes`, 'upgrades', [
    [5, 500],
    [15, 1000],
    [30, 1600],
  ]),
  ...tiers('awaken', (n) => `Réussir ${n} éveil(s)`, 'awakenings', [
    [1, 700],
    [3, 1400],
  ]),
  ...tiers('recycle', (n) => `Recycler ${n} cartes`, 'recycles', [
    [3, 500],
    [10, 1000],
  ]),
  ...tiers('fusion', (n) => `Réussir ${n} fusion(s)`, 'fusions', [
    [1, 600],
    [3, 1100],
    [6, 1700],
  ]),
  ...tiers(
    'stat',
    (n) => `Répartir ${n} points de statistiques`,
    'statPoints',
    [
      [3, 500],
      [9, 1000],
    ],
  ),
  ...tiers('shop', (n) => `Faire ${n} achats en boutique`, 'shop', [
    [2, 500],
    [5, 900],
  ]),
  ...tiers('deposit', (n) => `Déposer ${n} fois à la banque`, 'deposits', [
    [2, 500],
    [5, 900],
  ]),
  ...tiers('game', (n) => `Jouer ${n} mini-jeux Discord`, 'games', [
    [5, 600],
    [15, 1200],
    [30, 1800],
  ]),
  ...tiers('donate', (n) => `Faire ${n} don(s) à un joueur`, 'donations', [
    [1, 500],
  ]),
  ...tiers('trade', (n) => `Conclure ${n} échange(s) direct(s)`, 'trades', [
    [1, 1000],
    [3, 1800],
  ]),
  ...tiers('auction', (n) => `Mettre ${n} carte(s) aux enchères`, 'auctions', [
    [1, 500],
    [3, 900],
    [6, 1400],
  ]),
  ...tiers('challenge', (n) => `Remporter ${n} défi(s) Discord`, 'challenges', [
    [1, 800],
    [3, 1500],
  ]),
  ...tiers('daily', (n) => `Terminer ${n} quêtes journalières`, 'dailyQuests', [
    [10, 600],
    [25, 1200],
    [50, 2000],
  ]),
  ...tiers('favorite', (n) => `Marquer ${n} favoris`, 'favorites', [[3, 500]]),
  ...tiers(
    'wishlist',
    (n) => `Mettre à jour ${n} fois sa liste de souhaits`,
    'wishlist',
    [[3, 500]],
  ),
  ...tiers('showcase', (n) => `Arranger ${n} fois sa vitrine`, 'showcase', [
    [2, 500],
  ]),
];

export const questLimits = { daily: 10, weekly: 50 } as const;

// Mélange déterministe (mulberry32) à partir de la date de la période.
function seededPick<T>(items: T[], count: number, seed: string) {
  let state = 0;
  for (const ch of seed) state = (Math.imul(state, 31) + ch.charCodeAt(0)) | 0;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export function activeQuests(now = new Date()) {
  const { day, week, dailyReset, weeklyReset } = missionPeriods(now);
  const dayKey = day.toISOString().slice(0, 10);
  const weekKey = week.toISOString().slice(0, 10);
  return {
    daily: {
      key: dayKey,
      start: day,
      resetsAt: dailyReset,
      quests: seededPick(dailyPool, questLimits.daily, `daily:${dayKey}`),
    },
    weekly: {
      key: weekKey,
      start: week,
      resetsAt: weeklyReset,
      quests: seededPick(weeklyPool, questLimits.weekly, `weekly:${weekKey}`),
    },
  };
}

export const questClaimKey = (
  cycle: 'daily' | 'weekly',
  period: string,
  id: string,
) => `quest:${cycle}:${period}:${id}`;

// Une ligne du journal : opération du site, de l'économie Discord ou enchère créée.
export type ActivityRow = {
  kind: string;
  result?: {
    copies?: Pick<Copy, 'cardId' | 'holo'>[];
    boosterCount?: number;
    spent?: number;
  } | null;
  request?: Record<string, unknown> | null;
};

const gameKinds = new Set([
  'double',
  'roulette',
  'guess.start',
  'duel.start',
  'coinflip',
  'dice',
]);

export function activityFrom(rows: ActivityRow[], cards: Card[]): Activity {
  const rarityOf = new Map(
    cards.map((card) => [card.id, rarities.indexOf(card.rarity)]),
  );
  const a = emptyActivity();
  for (const row of rows) {
    const kind = row.kind;
    if (kind === 'summon') {
      const copies = Array.isArray(row.result?.copies) ? row.result.copies : [];
      a.boosters += row.result?.boosterCount ?? (copies.length ? 1 : 0);
      a.cards += copies.length;
      for (const copy of copies) {
        const rank = rarityOf.get(copy.cardId) ?? 0;
        if (copy.holo) a.holos++;
        if (rank >= 1) a.rarePlus++;
        if (rank >= 2) a.epicPlus++;
        if (rank >= 3) a.legendPlus++;
      }
    } else if (kind === 'upgrade')
      a.upgrades += Number(row.request?.levels) || 1;
    else if (kind === 'awaken') a.awakenings++;
    else if (kind === 'recycle') a.recycles++;
    else if (kind === 'recycle-many')
      a.recycles += Array.isArray(row.request?.copyIds)
        ? row.request.copyIds.length
        : 0;
    else if (kind === 'fuse') a.fusions++;
    else if (kind === 'allocate') a.statPoints++;
    else if (kind === 'shop') a.shop++;
    else if (kind === 'daily' || kind === 'bonus') a.bonuses++;
    else if (kind === 'deposit') a.deposits++;
    else if (kind === 'donate') a.donations++;
    else if (kind === 'trade') a.trades++;
    else if (kind === 'auction.create') a.auctions++;
    else if (kind === 'wishlist') a.wishlist++;
    else if (kind === 'showcase') a.showcase++;
    else if (kind === 'favorite') a.favorites++;
    else if (kind === 'challenge.answer') a.challenges++;
    else if (kind === 'quest' && row.request?.cycle === 'daily')
      a.dailyQuests++;
    else if (gameKinds.has(kind)) a.games++;
  }
  return a;
}

export type QuestStatus = QuestTemplate & {
  cycle: 'daily' | 'weekly';
  progress: number;
  claimKey: string;
  claimed: boolean;
  claimable: boolean;
  resetsAt: string;
};

export function questStatus(
  claimed: string[],
  daily: Activity,
  weekly: Activity,
  now = new Date(),
): QuestStatus[] {
  const active = activeQuests(now);
  const done = new Set(claimed);
  return (['daily', 'weekly'] as const).flatMap((cycle) => {
    const period = active[cycle];
    const activity = cycle === 'daily' ? daily : weekly;
    return period.quests.map((quest) => {
      const claimKey = questClaimKey(cycle, period.key, quest.id);
      const value = activity[quest.metric];
      const isClaimed = done.has(claimKey);
      return {
        ...quest,
        cycle,
        progress: Math.min(value, quest.target),
        claimKey,
        claimed: isClaimed,
        claimable: !isClaimed && value >= quest.target,
        resetsAt: period.resetsAt.toISOString(),
      };
    });
  });
}

// Les clés de quêtes des périodes passées ne servent plus : on les retire pour
// garder un état joueur compact. Les autres réclamations restent intactes.
export function pruneQuestClaims(claimed: string[], now = new Date()) {
  const { week } = missionPeriods(now);
  const oldest = week.toISOString().slice(0, 10);
  return claimed.filter((key) => {
    if (!key.startsWith('quest:')) return true;
    const period = key.split(':')[2] ?? '';
    return period >= oldest;
  });
}
