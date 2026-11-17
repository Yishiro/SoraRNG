// Succès : insignes calculés depuis la collection, sans récompense en Munny.
import type { Card, Player } from './core';
import { worlds } from './worlds';
import { fusion, fusionRank } from './stats';

export type Achievement = {
  id: string;
  name: string;
  description: string;
  progress: number;
  target: number;
  done: boolean;
};

export function achievements(player: Player, cards: Card[]): Achievement[] {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const owned = player.copies;
  const discovered = new Set([
    ...(player.discoveries ?? []),
    ...owned.map((copy) => copy.cardId),
  ]);
  const ownedRarity = (rarity: string) =>
    owned.filter((copy) => byId.get(copy.cardId)?.rarity === rarity).length;
  const holos = owned.filter((copy) => copy.holo).length;
  const maxAwakening = Math.max(0, ...owned.map((copy) => copy.awakening));
  const maxFusion = Math.max(0, ...owned.map((copy) => fusionRank(copy)));
  const worldsDone = worlds.filter((world) =>
    world.cards.every((id) => discovered.has(id)),
  ).length;
  const list: Omit<Achievement, 'done'>[] = [
    a(
      'codex-25',
      'Apprenti archiviste',
      'Découvrir 25 modèles',
      discovered.size,
      25,
    ),
    a(
      'codex-75',
      'Archiviste confirmé',
      'Découvrir 75 modèles',
      discovered.size,
      75,
    ),
    a(
      'codex-150',
      'Mémoire des mondes',
      'Découvrir les 150 modèles',
      discovered.size,
      150,
    ),
    a('holo-1', 'Premier reflet', 'Posséder une carte holographique', holos, 1),
    a(
      'holo-10',
      'Collection irisée',
      'Posséder 10 cartes holographiques',
      holos,
      10,
    ),
    a(
      'legend-1',
      'Légende vivante',
      'Posséder une carte Légendaire',
      ownedRarity('Légendaire'),
      1,
    ),
    a(
      'mythic-1',
      'Mythe en main',
      'Posséder une carte Mythique',
      ownedRarity('Mythique'),
      1,
    ),
    a(
      'secret-1',
      'Secret dévoilé',
      'Posséder une carte Secrète',
      ownedRarity('Secret'),
      1,
    ),
    a(
      'awaken-5',
      'Éveil complet',
      'Éveiller un exemplaire au niveau 5',
      maxAwakening,
      5,
    ),
    a('fusion-1', 'Première fusion', 'Fusionner un exemplaire', maxFusion, 1),
    a(
      'fusion-max',
      'Forgé dix fois',
      `Atteindre la fusion ${fusion.maxRank}`,
      maxFusion,
      fusion.maxRank,
    ),
    a(
      'summons-100',
      'Cent rencontres',
      'Révéler 100 cartes',
      player.summons,
      100,
    ),
    a(
      'summons-1000',
      'Mille rencontres',
      'Révéler 1 000 cartes',
      player.summons,
      1000,
    ),
    a('worlds-1', 'Voyageur', 'Compléter un monde du carnet', worldsDone, 1),
    a(
      'worlds-all',
      'Gardien des mondes',
      'Compléter tous les mondes du carnet',
      worldsDone,
      worlds.length,
    ),
  ];
  return list.map((item) => ({ ...item, done: item.progress >= item.target }));
}

function a(
  id: string,
  name: string,
  description: string,
  value: number,
  target: number,
): Omit<Achievement, 'done'> {
  return { id, name, description, progress: Math.min(value, target), target };
}
