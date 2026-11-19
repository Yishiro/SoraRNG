// Règles du PvP fixées par le propriétaire le 19 novembre 2026.
// Toute modification de ces valeurs est une décision économique.

export const pvpRules = {
  team: {
    minSize: 1,
    maxSize: 3,
    // Plusieurs exemplaires du même modèle peuvent combattre ensemble.
    duplicateModels: true,
  },
  stake: {
    min: 100,
    max: 10000,
    // Mise identique des deux côtés, en séquestre ; le gagnant prend tout.
    feePercent: 0,
  },
  duel: {
    inviteTtlMs: 10 * 60 * 1000,
    turnMs: 60 * 1000,
    // Au-delà d'un délai, l'IA joue à la place du joueur ; au 3e délai
    // dépassé, défaite par abandon (mises perdues).
    maxTimeouts: 3,
  },
  arena: {
    attacksPerDay: 10,
  },
  elo: {
    start: 1000,
    k: 40,
    floor: 100,
  },
  // Récompenses mensuelles du classement d'arène, dans chaque ligue.
  monthlyRewards: [15000, 10000, 5000],
} as const;

export const leagues = [
  { id: 'bronze', name: 'Bronze', minPower: 0 },
  { id: 'argent', name: 'Argent', minPower: 700 },
  { id: 'or', name: 'Or', minPower: 900 },
  { id: 'platine', name: 'Platine', minPower: 1100 },
] as const;
export type LeagueId = (typeof leagues)[number]['id'];

export function leagueOf(power: number) {
  return [...leagues].reverse().find((l) => power >= l.minPower)!;
}

// Classement Elo : le gagnant prend des points au perdant, d'autant plus que
// l'adversaire était mieux classé. Les deux camps (attaque et défense) bougent.
export function eloUpdate(
  winner: number,
  loser: number,
  draw = false,
): { winner: number; loser: number } {
  const expected = 1 / (1 + 10 ** ((loser - winner) / 400));
  const score = draw ? 0.5 : 1;
  const delta = Math.round(pvpRules.elo.k * (score - expected));
  return {
    winner: Math.max(pvpRules.elo.floor, winner + delta),
    loser: Math.max(pvpRules.elo.floor, loser - delta),
  };
}

export function validStake(amount: unknown) {
  return (
    Number.isInteger(amount) &&
    (amount as number) >= pvpRules.stake.min &&
    (amount as number) <= pvpRules.stake.max
  );
}

// Résultat financier d'un duel avec mise (aucune commission) : le gagnant
// reçoit les deux mises ; match nul, chacun récupère la sienne.
export function stakePayout(stake: number, outcome: 'a' | 'b' | 'draw') {
  if (outcome === 'draw') return { a: stake, b: stake };
  const pot = stake * 2;
  return outcome === 'a' ? { a: pot, b: 0 } : { a: 0, b: pot };
}
