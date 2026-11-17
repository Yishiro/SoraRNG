export const rarities = [
  'Commun',
  'Rare',
  'Épique',
  'Légendaire',
  'Mythique',
  'Secret',
] as const;
export const rates = [9000, 560, 280, 120, 36, 4];
export const holoRate = 40;
export const caps = [20, 30, 40, 50, 60, 70];
export const trialBoosterClaim = 'trial-booster-v2';
// Configuration de lancement, à équilibrer après validation du propriétaire.
export const economy = {
  cardsPerBooster: 5,
  summon: 1000,
  freeCooldownMs: 900000,
  dailyMunny: 5000,
  dailyFragments: 10,
  fragmentPackCost: 500,
  fragmentPack: 10,
  levelCost: 100,
  levelFragments: 2,
  awakeningDuplicates: [1, 1, 2, 2, 3],
  awakeningMunny: 500,
  alternativeFragments: 100,
  recycleFragments: 5,
} as const;
