// Éléments de combat, dérivés des affinités du catalogue (17 affinités
// regroupées en 9 éléments lisibles). Système propre à SoraRNG.

export const elements = [
  'Lumière',
  'Ténèbres',
  'Néant',
  'Feu',
  'Eau',
  'Foudre',
  'Nature',
  'Arcane',
  'Neutre',
] as const;
export type Element = (typeof elements)[number];

const fromAffinity: Record<string, Element> = {
  Lumière: 'Lumière',
  Ténèbres: 'Ténèbres',
  Néant: 'Néant',
  Feu: 'Feu',
  Glace: 'Eau',
  Eau: 'Eau',
  Foudre: 'Foudre',
  Terre: 'Nature',
  Vent: 'Nature',
  Fleur: 'Nature',
  Magie: 'Arcane',
  Rêve: 'Arcane',
  Illusion: 'Arcane',
  Temps: 'Arcane',
  Espace: 'Arcane',
  Lune: 'Arcane',
  Neutre: 'Neutre',
};

export function elementOf(affinity: string): Element {
  return fromAffinity[affinity] ?? 'Neutre';
}

// Attaques très efficaces (×2) et peu efficaces (×0,5), attaquant → défenseur.
// Lumière et Ténèbres se frappent mutuellement fort, comme le cœur de l'univers
// de la collection ; le Néant cède à la Lumière et à l'Arcane ; le cycle
// Feu → Nature → Eau → Feu, la Foudre domine l'Eau et cède à la Nature.
const strong: Record<Element, Element[]> = {
  Lumière: ['Ténèbres', 'Néant'],
  Ténèbres: ['Lumière', 'Arcane'],
  Néant: ['Neutre', 'Foudre'],
  Feu: ['Nature'],
  Eau: ['Feu'],
  Foudre: ['Eau'],
  Nature: ['Eau', 'Foudre'],
  Arcane: ['Néant', 'Feu'],
  Neutre: [],
};
const weak: Record<Element, Element[]> = {
  Lumière: ['Lumière'],
  Ténèbres: ['Ténèbres'],
  Néant: ['Lumière', 'Néant'],
  Feu: ['Eau', 'Feu'],
  Eau: ['Nature', 'Eau'],
  Foudre: ['Nature', 'Foudre'],
  Nature: ['Feu'],
  Arcane: ['Arcane'],
  Neutre: [],
};

export function effectiveness(attack: Element, defender: Element) {
  if (strong[attack].includes(defender)) return 2;
  if (weak[attack].includes(defender)) return 0.5;
  return 1;
}

export function effectivenessLabel(multiplier: number) {
  return multiplier > 1
    ? 'C’est très efficace !'
    : multiplier < 1
      ? 'Ce n’est pas très efficace…'
      : '';
}
