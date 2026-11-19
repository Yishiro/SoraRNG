// Récit d'un combat en français, partagé par le site et le bot.
import type { BattleEvent, Side } from './engine';
import { effectivenessLabel } from './elements';

const statNames = { atk: 'Attaque', def: 'Défense', spd: 'Vitesse' } as const;

export function describeEvent(event: BattleEvent, me: Side = 'a') {
  const who = (side: Side) => (side === me ? 'Vous' : 'L’adversaire');
  switch (event.type) {
    case 'switch':
      return `${who(event.side)} envoie ${event.to}.`;
    case 'move': {
      if (event.missed)
        return `${event.actor} utilise ${event.move}… mais rate.`;
      if (event.damage === undefined)
        return `${event.actor} utilise ${event.move}.`;
      const extra = [
        event.crit ? 'Coup critique !' : '',
        effectivenessLabel(event.effectiveness ?? 1),
      ]
        .filter(Boolean)
        .join(' ');
      return `${event.actor} utilise ${event.move} : ${event.damage} dégâts.${extra ? ` ${extra}` : ''}`;
    }
    case 'stat':
      return event.stages === 0
        ? `${statNames[event.stat]} de ${event.fighter} ne bouge plus.`
        : `${statNames[event.stat]} de ${event.fighter} ${event.stages > 0 ? 'augmente' : 'baisse'}${Math.abs(event.stages) > 1 ? ' fortement' : ''}.`;
    case 'heal':
      return `${event.fighter} récupère ${event.amount} PV.`;
    case 'faint':
      return `${event.fighter} est K.O. !`;
    case 'end':
      return event.winner === 'draw'
        ? 'Match nul.'
        : event.winner === me
          ? 'Victoire !'
          : 'Défaite…';
  }
}
