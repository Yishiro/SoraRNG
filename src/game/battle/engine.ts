// Moteur de combat tour par tour, pur et déterministe.
// Une graine par combat : le serveur peut rejouer et vérifier chaque tour,
// et le même état donne toujours le même résultat (site, bot, tests).
import type { Card, Copy } from '../core';
import { copyStats, rarityBase } from '../stats';
import { rarities } from '../config';
import { effectiveness, elementOf, type Element } from './elements';
import { canFight, movesFor, type BattleStat, type Move } from './moves';

export const battleRules = {
  teamSize: 3,
  maxTurns: 60,
  sameElementBonus: 1.25,
  critChance: 1 / 16,
  critMultiplier: 1.5,
  // Calibrage : deux cartes équivalentes s'abattent en 3 à 5 attaques.
  damageScale: 0.25,
  maxStages: 3,
} as const;

export type Fighter = {
  copyId: string;
  cardId: string;
  name: string;
  element: Element;
  level: number;
  // Échelle de rareté du défenseur : les dégâts reçus suivent ses PV, pour un
  // rythme de duel stable sans amplifier l'écart entre raretés.
  scale: number;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  stages: Record<BattleStat, number>;
  moves: Move[];
};

export type Side = 'a' | 'b';
export type BattleState = {
  seed: string;
  draws: number; // nombre de tirages aléatoires déjà consommés
  turn: number;
  teams: Record<Side, Fighter[]>;
  active: Record<Side, number>;
  winner: Side | 'draw' | null;
};

export type Action =
  { type: 'move'; index: number } | { type: 'switch'; to: number };

export type BattleEvent =
  | { type: 'switch'; side: Side; from: string; to: string }
  | {
      type: 'move';
      side: Side;
      actor: string;
      move: string;
      target?: string;
      missed?: boolean;
      damage?: number;
      effectiveness?: number;
      crit?: boolean;
    }
  | {
      type: 'stat';
      side: Side;
      fighter: string;
      stat: BattleStat;
      stages: number;
    }
  | { type: 'heal'; side: Side; fighter: string; amount: number }
  | { type: 'faint'; side: Side; fighter: string }
  | { type: 'end'; winner: Side | 'draw' };

// --- Aléatoire reproductible (mulberry32, graine + nombre de tirages) ---
function seedHash(text: string) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function draw(state: BattleState) {
  let t = (seedHash(state.seed) + Math.imul(state.draws++, 0x6d2b79f5)) | 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// --- Construction ---
export function cardCanFight(card: Card) {
  return canFight(String((card as { role?: string }).role ?? 'Polyvalent'));
}

export function buildFighter(card: Card, copy: Copy): Fighter {
  const element = elementOf(card.affinity);
  const stats = copyStats(card, copy);
  return {
    copyId: copy.id,
    cardId: card.id,
    name: card.name,
    element,
    level: copy.level,
    scale: rarityBase[Math.max(0, rarities.indexOf(card.rarity))] / 40,
    maxHp: stats.hp,
    hp: stats.hp,
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd,
    stages: { atk: 0, def: 0, spd: 0 },
    moves: movesFor(
      element,
      String((card as { role?: string }).role ?? 'Polyvalent'),
    ),
  };
}

// Puissance d'une équipe, pour les ligues : même calcul pour tous.
export function teamPower(team: Fighter[]) {
  return team.reduce(
    (sum, f) => sum + Math.round(f.maxHp / 2 + f.atk * 1.5 + f.def + f.spd),
    0,
  );
}

export function createBattle(
  a: Fighter[],
  b: Fighter[],
  seed: string,
): BattleState {
  for (const team of [a, b])
    if (team.length < 1 || team.length > battleRules.teamSize)
      throw new Error(
        `Une équipe compte de 1 à ${battleRules.teamSize} cartes.`,
      );
  const clone = (team: Fighter[]) =>
    team.map((f) => ({ ...f, stages: { ...f.stages }, moves: [...f.moves] }));
  return {
    seed,
    draws: 0,
    turn: 0,
    teams: { a: clone(a), b: clone(b) },
    active: { a: 0, b: 0 },
    winner: null,
  };
}

// --- Règles ---
const stageMultiplier = (stages: number) =>
  stages >= 0 ? (2 + stages) / 2 : 2 / (2 - stages);

export const activeFighter = (state: BattleState, side: Side) =>
  state.teams[side][state.active[side]];
const other = (side: Side): Side => (side === 'a' ? 'b' : 'a');
const alive = (team: Fighter[]) => team.some((f) => f.hp > 0);

export function effectiveSpeed(f: Fighter) {
  return f.spd * stageMultiplier(f.stages.spd);
}

export function damageFor(
  attacker: Fighter,
  defender: Fighter,
  move: Move,
  roll = 1,
  crit = false,
) {
  const atk = attacker.atk * stageMultiplier(attacker.stages.atk);
  const def = defender.def * stageMultiplier(defender.stages.def);
  const eff = effectiveness(move.element, defender.element);
  const stab =
    move.element === attacker.element ? battleRules.sameElementBonus : 1;
  const raw =
    move.power *
    battleRules.damageScale *
    (atk / def) *
    defender.scale *
    eff *
    stab *
    roll *
    (crit ? battleRules.critMultiplier : 1);
  return { damage: Math.max(1, Math.round(raw)), effectiveness: eff };
}

export function needsReplacement(state: BattleState, side: Side) {
  return (
    !state.winner &&
    activeFighter(state, side).hp <= 0 &&
    alive(state.teams[side])
  );
}

// Remplace une carte K.O. (ne consomme pas de tour).
export function replace(state: BattleState, side: Side, to: number) {
  const team = state.teams[side];
  if (!needsReplacement(state, side))
    throw new Error('Aucun remplacement attendu.');
  if (!team[to] || team[to].hp <= 0) throw new Error('Carte indisponible.');
  const events: BattleEvent[] = [
    {
      type: 'switch',
      side,
      from: activeFighter(state, side).name,
      to: team[to].name,
    },
  ];
  state.active[side] = to;
  return events;
}

function validate(state: BattleState, side: Side, action: Action) {
  const team = state.teams[side];
  if (action.type === 'switch') {
    if (
      action.to === state.active[side] ||
      !team[action.to] ||
      team[action.to].hp <= 0
    )
      throw new Error('Changement impossible.');
  } else if (!activeFighter(state, side).moves[action.index])
    throw new Error('Attaque inconnue.');
}

// Résout un tour complet : changements d'abord, puis attaques par priorité,
// puis Vitesse (égalité tranchée au hasard reproductible).
export function resolveTurn(
  state: BattleState,
  actions: Record<Side, Action>,
): BattleEvent[] {
  if (state.winner) throw new Error('Combat terminé.');
  if (needsReplacement(state, 'a') || needsReplacement(state, 'b'))
    throw new Error('Une carte K.O. doit d’abord être remplacée.');
  validate(state, 'a', actions.a);
  validate(state, 'b', actions.b);
  const events: BattleEvent[] = [];
  state.turn++;

  for (const side of ['a', 'b'] as const) {
    const action = actions[side];
    if (action.type !== 'switch') continue;
    events.push({
      type: 'switch',
      side,
      from: activeFighter(state, side).name,
      to: state.teams[side][action.to].name,
    });
    state.active[side] = action.to;
    // Changer de carte remet ses modifications de stats à zéro.
    activeFighter(state, side).stages = { atk: 0, def: 0, spd: 0 };
  }

  const movers = (['a', 'b'] as const).filter(
    (s) => actions[s].type === 'move',
  );
  const tie = draw(state);
  movers.sort((x, y) => {
    const mx = activeFighter(state, x).moves[
      (actions[x] as { index: number }).index
    ];
    const my = activeFighter(state, y).moves[
      (actions[y] as { index: number }).index
    ];
    if (mx.priority !== my.priority) return my.priority - mx.priority;
    const sx = effectiveSpeed(activeFighter(state, x));
    const sy = effectiveSpeed(activeFighter(state, y));
    if (sx !== sy) return sy - sx;
    return tie < 0.5 ? -1 : 1;
  });

  for (const side of movers) {
    const actor = activeFighter(state, side);
    if (actor.hp <= 0) continue; // mis K.O. avant d'agir
    const target = activeFighter(state, other(side));
    const move = actor.moves[(actions[side] as { index: number }).index];
    const hit = draw(state) * 100 < move.accuracy;
    if (!hit) {
      events.push({
        type: 'move',
        side,
        actor: actor.name,
        move: move.name,
        missed: true,
      });
      continue;
    }
    if (move.power > 0) {
      if (target.hp <= 0) continue;
      const roll = 0.85 + draw(state) * 0.15;
      const crit = draw(state) < battleRules.critChance;
      const { damage, effectiveness: eff } = damageFor(
        actor,
        target,
        move,
        roll,
        crit,
      );
      target.hp = Math.max(0, target.hp - damage);
      events.push({
        type: 'move',
        side,
        actor: actor.name,
        move: move.name,
        target: target.name,
        damage,
        effectiveness: eff,
        crit,
      });
      if (target.hp === 0)
        events.push({ type: 'faint', side: other(side), fighter: target.name });
    } else {
      events.push({ type: 'move', side, actor: actor.name, move: move.name });
      const effect = move.effect;
      if (effect?.kind === 'heal') {
        const amount = Math.min(
          actor.maxHp - actor.hp,
          Math.round(actor.maxHp * effect.fraction),
        );
        actor.hp += amount;
        events.push({ type: 'heal', side, fighter: actor.name, amount });
      } else if (effect) {
        const who = effect.kind === 'boost' ? actor : target;
        const whoSide = effect.kind === 'boost' ? side : other(side);
        const delta = effect.kind === 'boost' ? effect.stages : -effect.stages;
        const before = who.stages[effect.stat];
        who.stages[effect.stat] = Math.max(
          -battleRules.maxStages,
          Math.min(battleRules.maxStages, before + delta),
        );
        events.push({
          type: 'stat',
          side: whoSide,
          fighter: who.name,
          stat: effect.stat,
          stages: who.stages[effect.stat] - before,
        });
      }
    }
  }

  const aAlive = alive(state.teams.a);
  const bAlive = alive(state.teams.b);
  if (!aAlive || !bAlive) state.winner = aAlive ? 'a' : bAlive ? 'b' : 'draw';
  else if (state.turn >= battleRules.maxTurns) {
    // Limite de tours : la part de PV restante départage.
    const share = (team: Fighter[]) =>
      team.reduce((s, f) => s + f.hp / f.maxHp, 0);
    const sa = share(state.teams.a);
    const sb = share(state.teams.b);
    state.winner = sa === sb ? 'draw' : sa > sb ? 'a' : 'b';
  }
  if (state.winner) events.push({ type: 'end', winner: state.winner });
  return events;
}
