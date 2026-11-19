// Attaques des cartes : 4 par carte, déduites de son élément et de son rôle,
// pour que les 150 cartes soient jouables sans fiche écrite à la main.
import type { Element } from './elements';

export type BattleStat = 'atk' | 'def' | 'spd';
export type Move = {
  id: string;
  name: string;
  element: Element;
  // Puissance 0 = attaque de soutien (boost, soin, affaiblissement).
  power: number;
  accuracy: number; // en %
  priority: number; // les priorités hautes agissent avant la Vitesse
  effect?:
    | { kind: 'boost'; stat: BattleStat; stages: number }
    | { kind: 'lower'; stat: BattleStat; stages: number }
    | { kind: 'heal'; fraction: number };
  description: string;
};

const elemental: Record<Element, [string, string]> = {
  Lumière: ['Rayon sacré', 'Aube éclatante'],
  Ténèbres: ['Onde obscure', 'Griffe des ombres'],
  Néant: ['Lame du néant', 'Vide dévorant'],
  Feu: ['Brasier', 'Fournaise'],
  Eau: ['Torrent', 'Blizzard'],
  Foudre: ['Éclair', 'Orage'],
  Nature: ['Tornade', 'Séisme'],
  Arcane: ['Sort mystique', 'Distorsion'],
  Neutre: ['Coup puissant', 'Charge'],
};

const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');

function elementalMove(element: Element, heavy: boolean): Move {
  const name = elemental[element][heavy ? 1 : 0];
  return {
    id: slug(name),
    name,
    element,
    power: heavy ? 95 : 80,
    accuracy: heavy ? 85 : 100,
    priority: 0,
    description: heavy
      ? `Attaque ${element.toLowerCase()} puissante mais moins précise.`
      : `Attaque ${element.toLowerCase()} fiable.`,
  };
}

const basic: Move = {
  id: 'frappe',
  name: 'Frappe',
  element: 'Neutre',
  power: 50,
  accuracy: 100,
  priority: 0,
  description: 'Coup simple et sûr.',
};

const roleMoves: Record<string, (element: Element) => [Move, Move]> = {
  Attaquant: (element) => [
    elementalMove(element, true),
    {
      id: 'concentration',
      name: 'Concentration',
      element: 'Neutre',
      power: 0,
      accuracy: 100,
      priority: 0,
      effect: { kind: 'boost', stat: 'atk', stages: 2 },
      description: 'Augmente fortement l’Attaque.',
    },
  ],
  Mage: (element) => [
    elementalMove(element, true),
    {
      id: 'aura',
      name: 'Aura',
      element: 'Arcane',
      power: 0,
      accuracy: 100,
      priority: 0,
      effect: { kind: 'boost', stat: 'atk', stages: 1 },
      description: 'Augmente l’Attaque.',
    },
  ],
  Défenseur: () => [
    {
      id: 'riposte',
      name: 'Riposte',
      element: 'Neutre',
      power: 70,
      accuracy: 100,
      priority: 0,
      description: 'Contre-attaque solide.',
    },
    {
      id: 'garde',
      name: 'Garde',
      element: 'Neutre',
      power: 0,
      accuracy: 100,
      priority: 0,
      effect: { kind: 'boost', stat: 'def', stages: 2 },
      description: 'Augmente fortement la Défense.',
    },
  ],
  Soutien: () => [
    {
      id: 'soin',
      name: 'Soin',
      element: 'Lumière',
      power: 0,
      accuracy: 100,
      priority: 0,
      effect: { kind: 'heal', fraction: 0.5 },
      description: 'Rend la moitié des PV maximum.',
    },
    {
      id: 'entrave',
      name: 'Entrave',
      element: 'Neutre',
      power: 0,
      accuracy: 90,
      priority: 0,
      effect: { kind: 'lower', stat: 'atk', stages: 1 },
      description: 'Baisse l’Attaque adverse.',
    },
  ],
  Agile: () => [
    {
      id: 'coup-eclair',
      name: 'Coup éclair',
      element: 'Neutre',
      power: 45,
      accuracy: 100,
      priority: 1,
      description: 'Frappe toujours en premier.',
    },
    {
      id: 'hate',
      name: 'Hâte',
      element: 'Neutre',
      power: 0,
      accuracy: 100,
      priority: 0,
      effect: { kind: 'boost', stat: 'spd', stages: 2 },
      description: 'Augmente fortement la Vitesse.',
    },
  ],
  Polyvalent: () => [
    {
      id: 'assaut',
      name: 'Assaut',
      element: 'Neutre',
      power: 75,
      accuracy: 95,
      priority: 0,
      description: 'Attaque équilibrée.',
    },
    {
      id: 'preparation',
      name: 'Préparation',
      element: 'Neutre',
      power: 0,
      accuracy: 100,
      priority: 0,
      effect: { kind: 'boost', stat: 'atk', stages: 1 },
      description: 'Augmente l’Attaque.',
    },
  ],
  Collection: () => [
    {
      id: 'assaut',
      name: 'Assaut',
      element: 'Neutre',
      power: 75,
      accuracy: 95,
      priority: 0,
      description: 'Attaque équilibrée.',
    },
    {
      id: 'intimidation',
      name: 'Intimidation',
      element: 'Neutre',
      power: 0,
      accuracy: 100,
      priority: 0,
      effect: { kind: 'lower', stat: 'atk', stages: 1 },
      description: 'Baisse l’Attaque adverse.',
    },
  ],
};

// Les objets (rôle « Objet ») ne combattent pas.
export function canFight(role: string) {
  return role !== 'Objet' && role in roleMoves;
}

export function movesFor(element: Element, role: string): Move[] {
  const [roleAttack, utility] = (roleMoves[role] ?? roleMoves.Polyvalent)(
    element,
  );
  return [elementalMove(element, false), roleAttack, utility, basic];
}
