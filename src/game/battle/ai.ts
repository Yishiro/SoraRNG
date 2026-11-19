// Intelligence de défense de l'arène : joue les équipes des joueurs absents.
// Déterministe (aucun hasard propre) : même état → même décision.
import {
  activeFighter,
  damageFor,
  effectiveSpeed,
  type Action,
  type BattleState,
  type Fighter,
  type Side,
} from './engine';
import { effectiveness } from './elements';

const other = (side: Side): Side => (side === 'a' ? 'b' : 'a');

function bestDamage(attacker: Fighter, defender: Fighter) {
  let best = { index: 0, expected: -1 };
  attacker.moves.forEach((move, index) => {
    if (move.power <= 0) return;
    const expected =
      damageFor(attacker, defender, move, 0.925).damage * (move.accuracy / 100);
    if (expected > best.expected) best = { index, expected };
  });
  return best;
}

// Avantage d'un combattant face à l'adversaire actif (plus haut = mieux).
function matchup(me: Fighter, foe: Fighter) {
  const attack = Math.max(
    ...me.moves
      .filter((m) => m.power > 0)
      .map((m) => effectiveness(m.element, foe.element)),
  );
  const defense = Math.max(
    ...foe.moves
      .filter((m) => m.power > 0)
      .map((m) => effectiveness(m.element, me.element)),
  );
  return attack / defense;
}

export function chooseAction(state: BattleState, side: Side): Action {
  const me = activeFighter(state, side);
  const foe = activeFighter(state, other(side));
  const team = state.teams[side];
  const best = bestDamage(me, foe);

  // Achever l'adversaire si c'est possible.
  if (best.expected >= foe.hp) return { type: 'move', index: best.index };

  // Se soigner quand il reste peu de PV.
  const heal = me.moves.findIndex((m) => m.effect?.kind === 'heal');
  if (heal >= 0 && me.hp < me.maxHp * 0.4) return { type: 'move', index: heal };

  // Changer de carte face à un net désavantage d'élément.
  if (matchup(me, foe) <= 0.25) {
    const candidates = team
      .map((f, i) => ({ f, i }))
      .filter(({ f, i }) => i !== state.active[side] && f.hp > 0)
      .sort((x, y) => matchup(y.f, foe) - matchup(x.f, foe));
    if (candidates[0] && matchup(candidates[0].f, foe) > 1)
      return { type: 'switch', to: candidates[0].i };
  }

  // Se renforcer une fois en début de duel, si l'on est en bonne santé.
  const boost = me.moves.findIndex(
    (m) => m.effect?.kind === 'boost' && me.stages[m.effect.stat] < 2,
  );
  if (boost >= 0 && me.hp > me.maxHp * 0.75 && best.expected < foe.hp * 0.3)
    return { type: 'move', index: boost };

  return { type: 'move', index: best.index };
}

export function chooseReplacement(state: BattleState, side: Side) {
  const foe = activeFighter(state, other(side));
  return state.teams[side]
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.hp > 0)
    .sort(
      (x, y) =>
        matchup(y.f, foe) - matchup(x.f, foe) ||
        effectiveSpeed(y.f) - effectiveSpeed(x.f),
    )[0]?.i;
}
