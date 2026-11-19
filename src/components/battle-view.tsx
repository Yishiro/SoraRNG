'use client';
import { useEffect, useState } from 'react';
import { Flag, Repeat } from 'lucide-react';
import type { BattleEvent, Fighter } from '../game/battle/engine';
import { effectiveness } from '../game/battle/elements';
import { describeEvent } from '../game/battle/log';

export type PublicBattle = {
  id: string;
  status: string;
  winner: 'a' | 'b' | 'draw' | null;
  result: {
    reason: string;
    attacker: { before: number; after: number };
    defender: { before: number; after: number };
  } | null;
  state: {
    turn: number;
    teams: { a: Fighter[]; b: Fighter[] };
    active: { a: number; b: number };
  };
  log: (BattleEvent & { turn: number })[];
  needsReplacement: boolean;
};

const stageText = (f: Fighter) =>
  (['atk', 'def', 'spd'] as const)
    .filter((k) => f.stages[k])
    .map(
      (k) =>
        `${{ atk: 'Att', def: 'Déf', spd: 'Vit' }[k]} ${f.stages[k] > 0 ? '+' : ''}${f.stages[k]}`,
    )
    .join(' · ');

function FighterPanel({ f, mine }: { f: Fighter; mine: boolean }) {
  const pct = Math.max(0, (f.hp / f.maxHp) * 100);
  return (
    <div className={`battle-fighter ${mine ? 'mine' : 'foe'}`}>
      <div className="battle-fighter-head">
        <strong>{f.name}</strong>
        <span className="element-chip">{f.element}</span>
      </div>
      <div
        className={`hp-bar ${pct < 25 ? 'low' : pct < 50 ? 'mid' : ''}`}
        role="progressbar"
        aria-label={`PV de ${f.name}`}
        aria-valuemin={0}
        aria-valuemax={f.maxHp}
        aria-valuenow={f.hp}
      >
        <i style={{ width: `${pct}%` }} />
      </div>
      <small>
        {f.hp} / {f.maxHp} PV · Nv. {f.level}
        {stageText(f) ? ` · ${stageText(f)}` : ''}
      </small>
    </div>
  );
}

export default function BattleView({
  battle,
  busy,
  onTurn,
  onReplace,
  onForfeit,
  onClose,
}: {
  battle: PublicBattle;
  busy: boolean;
  onTurn: (
    move: { type: 'move'; index: number } | { type: 'switch'; to: number },
  ) => void;
  onReplace: (to: number) => void;
  onForfeit: () => void;
  onClose: () => void;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);
  const { teams, active } = battle.state;
  const me = teams.a[active.a];
  const foe = teams.b[active.b];
  const finished = battle.status !== 'active';
  const bench = teams.a
    .map((f, i) => ({ f, i }))
    .filter(({ f, i }) => i !== active.a && f.hp > 0);
  return (
    <section className="panel battle" aria-labelledby="battle-title">
      <div className="section-title">
        <h2 id="battle-title">Combat · tour {battle.state.turn}</h2>
        {!finished && (
          <button
            className={armed ? 'danger' : 'text-link'}
            disabled={busy}
            onClick={() => (armed ? onForfeit() : setArmed(true))}
          >
            <Flag size={14} aria-hidden="true" />{' '}
            {armed ? 'Confirmer l’abandon' : 'Abandonner'}
          </button>
        )}
      </div>
      <div className="battle-field">
        <FighterPanel f={foe} mine={false} />
        <FighterPanel f={me} mine />
      </div>
      <div className="battle-teams">
        {(['a', 'b'] as const).map((side) => (
          <div
            key={side}
            aria-label={side === 'a' ? 'Votre équipe' : 'Équipe adverse'}
          >
            {teams[side].map((f, i) => (
              <span
                key={`${f.copyId}-${i}`}
                className={`team-dot ${f.hp <= 0 ? 'ko' : ''} ${i === active[side] ? 'active' : ''}`}
                title={`${f.name} · ${f.hp}/${f.maxHp} PV`}
              />
            ))}
          </div>
        ))}
      </div>

      {finished ? (
        <div className="battle-result" role="status">
          <h3>
            {battle.winner === 'a'
              ? 'Victoire !'
              : battle.winner === 'draw'
                ? 'Match nul'
                : 'Défaite'}
          </h3>
          {battle.result && (
            <p>
              Classement : {battle.result.attacker.before} →{' '}
              <strong>{battle.result.attacker.after}</strong> (
              {battle.result.attacker.after - battle.result.attacker.before >= 0
                ? '+'
                : ''}
              {battle.result.attacker.after - battle.result.attacker.before})
              {battle.result.reason === 'abandon' ? ' · abandon' : ''}
            </p>
          )}
          <button className="primary" onClick={onClose}>
            Retour à l’arène
          </button>
        </div>
      ) : battle.needsReplacement ? (
        <div className="battle-actions">
          <h3>{me.name} est K.O. : choisissez la carte suivante</h3>
          <div className="battle-moves">
            {teams.a.map((f, i) =>
              f.hp > 0 ? (
                <button
                  key={i}
                  className="outline"
                  disabled={busy}
                  onClick={() => onReplace(i)}
                >
                  {f.name} · {f.hp}/{f.maxHp} PV
                </button>
              ) : null,
            )}
          </div>
        </div>
      ) : (
        <div className="battle-actions">
          <div className="battle-moves">
            {me.moves.map((move, index) => {
              const eff =
                move.power > 0 ? effectiveness(move.element, foe.element) : 1;
              return (
                <button
                  key={move.id}
                  className={`move-button ${eff > 1 ? 'strong' : eff < 1 ? 'weak' : ''}`}
                  disabled={busy}
                  onClick={() => onTurn({ type: 'move', index })}
                  title={move.description}
                >
                  <strong>{move.name}</strong>
                  <small>
                    {move.element}
                    {move.power > 0 ? ` · ${move.power}` : ' · soutien'}
                    {move.priority > 0 ? ' · prioritaire' : ''}
                    {eff > 1
                      ? ' · très efficace'
                      : eff < 1
                        ? ' · peu efficace'
                        : ''}
                  </small>
                </button>
              );
            })}
          </div>
          {bench.length > 0 && (
            <div className="battle-switch">
              <Repeat size={14} aria-hidden="true" /> Changer :
              {bench.map(({ f, i }) => (
                <button
                  key={i}
                  className="workshop-chip"
                  disabled={busy}
                  onClick={() => onTurn({ type: 'switch', to: i })}
                >
                  {f.name} ({f.element})
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <ol className="battle-log" aria-label="Déroulé du combat">
        {battle.log.slice(-12).map((event, i) => (
          <li key={`${event.turn}-${i}`}>
            <span>T{event.turn}</span> {describeEvent(event)}
          </li>
        ))}
      </ol>
    </section>
  );
}
