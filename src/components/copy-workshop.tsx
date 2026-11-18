'use client';
import { useEffect, useState } from 'react';
import {
  Gem,
  Heart,
  Lock,
  LockOpen,
  Minus,
  Plus,
  Recycle,
  Sparkles,
  TrendingUp,
  Combine,
} from 'lucide-react';
import type { Card, Copy, Player } from '../game/core';
import { economy } from '../game/config';
import {
  affordableLevels,
  awakeningFodder,
  awakeningNeed,
  levelCap,
  recyclable,
  upgradeCost,
} from '../game/workshop';
import CopyFusion from './copy-fusion';

type Tab = 'level' | 'awaken' | 'fusion' | 'recycle';
const tabs: [Tab, string, typeof TrendingUp][] = [
  ['level', 'Niveau', TrendingUp],
  ['awaken', 'Éveil', Sparkles],
  ['fusion', 'Fusion', Combine],
  ['recycle', 'Recycler', Recycle],
];
const fmt = (n: number) => n.toLocaleString('fr-FR');

export default function CopyWorkshop({
  card,
  copy,
  player,
  busy,
  onAction,
}: {
  card: Card;
  copy: Copy;
  player: Player;
  busy: boolean;
  onAction: (kind: string, payload: Record<string, unknown>) => void;
}) {
  const [tab, setTab] = useState<Tab>('level');
  const cap = levelCap(card);
  const room = Math.max(0, cap - copy.level);
  const affordable = affordableLevels(
    copy,
    card,
    player.munny,
    player.fragments,
  );
  const [levels, setLevels] = useState(1);
  const steps = Math.min(Math.max(1, levels), Math.max(1, room));
  const cost = upgradeCost(copy.level, steps);
  const awaken = awakeningNeed(copy);
  const fodder = player.copies.filter((c) => awakeningFodder(c, copy));
  const protectedCopy = !recyclable(copy, player);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <div className="workshop">
      <div className="workshop-top">
        <div className="workshop-wallet" aria-label="Vos ressources">
          <span>
            <Gem size={14} aria-hidden="true" /> {fmt(player.munny)} Munny
          </span>
          <span>
            <Sparkles size={14} aria-hidden="true" /> {fmt(player.fragments)}{' '}
            fragments
          </span>
        </div>
        <div className="workshop-toggles">
          <button
            className="workshop-toggle"
            aria-pressed={copy.favorite}
            disabled={busy}
            onClick={() => onAction('favorite', { copyId: copy.id })}
          >
            <Heart size={15} aria-hidden="true" />
            {copy.favorite ? 'Favori' : 'Ajouter aux favoris'}
          </button>
          <button
            className="workshop-toggle"
            aria-pressed={copy.locked}
            disabled={busy}
            onClick={() => onAction('lock', { copyId: copy.id })}
          >
            {copy.locked ? (
              <Lock size={15} aria-hidden="true" />
            ) : (
              <LockOpen size={15} aria-hidden="true" />
            )}
            {copy.locked ? 'Verrouillé' : 'Verrouiller'}
          </button>
        </div>
      </div>

      <div className="workshop-tabs" role="tablist" aria-label="Atelier">
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            id={`workshop-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`workshop-panel-${id}`}
            className={tab === id ? 'active' : ''}
            onClick={() => {
              setTab(id);
              setArmed(false);
            }}
          >
            <Icon size={15} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div
        className="workshop-panel"
        role="tabpanel"
        id={`workshop-panel-${tab}`}
        aria-labelledby={`workshop-tab-${tab}`}
      >
        {tab === 'level' && (
          <>
            <div className="workshop-meter">
              <div>
                <strong>Niveau {copy.level}</strong>
                <span>sur {cap}</span>
              </div>
              <span className="meter-track" aria-hidden="true">
                <i style={{ width: `${(copy.level / cap) * 100}%` }} />
                {room > 0 && (
                  <b
                    style={{
                      left: `${(copy.level / cap) * 100}%`,
                      width: `${(steps / cap) * 100}%`,
                    }}
                  />
                )}
              </span>
            </div>
            {room === 0 ? (
              <p className="workshop-note">Niveau maximum atteint.</p>
            ) : (
              <>
                <div className="workshop-stepper">
                  <span>Niveaux à gagner</span>
                  <div>
                    <button
                      className="icon-button"
                      aria-label="Un niveau de moins"
                      disabled={steps <= 1}
                      onClick={() => setLevels(steps - 1)}
                    >
                      <Minus size={16} />
                    </button>
                    <output aria-live="polite">{steps}</output>
                    <button
                      className="icon-button"
                      aria-label="Un niveau de plus"
                      disabled={steps >= room}
                      onClick={() => setLevels(steps + 1)}
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      className="workshop-chip"
                      disabled={affordable < 1}
                      onClick={() => setLevels(affordable)}
                    >
                      Maximum finançable ({affordable})
                    </button>
                  </div>
                </div>
                <dl className="workshop-cost">
                  <div className={cost.munny > player.munny ? 'short' : ''}>
                    <dt>Munny</dt>
                    <dd>{fmt(cost.munny)}</dd>
                  </div>
                  <div
                    className={cost.fragments > player.fragments ? 'short' : ''}
                  >
                    <dt>Fragments</dt>
                    <dd>{fmt(cost.fragments)}</dd>
                  </div>
                </dl>
                <button
                  className="primary workshop-go"
                  disabled={busy || steps > affordable}
                  onClick={() =>
                    onAction('upgrade', {
                      copyId: copy.id,
                      ...(steps > 1 ? { levels: steps } : {}),
                    })
                  }
                >
                  Monter au niveau {copy.level + steps}
                </button>
                {steps > affordable && (
                  <p className="workshop-note">
                    Ressources insuffisantes pour {steps} niveau
                    {steps > 1 ? 'x' : ''}.
                  </p>
                )}
              </>
            )}
            <p className="workshop-note">
              Le niveau et l’éveil ne modifient ni la rareté, ni la finition, ni
              les chances d’invocation. Ils renforcent les statistiques de
              combat.
            </p>
          </>
        )}

        {tab === 'awaken' && (
          <>
            <div
              className="workshop-stars"
              aria-label={`Éveil ${copy.awakening} sur 5`}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={n <= copy.awakening ? 'lit' : ''}>
                  ✦
                </span>
              ))}
            </div>
            {copy.awakening >= 5 ? (
              <p className="workshop-note">Éveil maximum atteint.</p>
            ) : (
              <div className="workshop-options">
                <div>
                  <h3>Avec des doublons</h3>
                  <p>
                    {awaken.needed} doublon{awaken.needed > 1 ? 's' : ''}{' '}
                    standard{awaken.needed > 1 ? 's' : ''} · {fmt(awaken.munny)}{' '}
                    Munny
                  </p>
                  <small>
                    {fodder.length} disponible{fodder.length > 1 ? 's' : ''}{' '}
                    (niveau 1, sans éveil ni fusion, ni holo, ni verrou, ni
                    favori)
                  </small>
                  <button
                    className="outline"
                    disabled={
                      busy ||
                      fodder.length < awaken.needed ||
                      player.munny < awaken.munny
                    }
                    onClick={() => onAction('awaken', { copyId: copy.id })}
                  >
                    Éveiller avec des doublons
                  </button>
                </div>
                <div>
                  <h3>Avec des fragments</h3>
                  <p>
                    {fmt(awaken.fragments)} fragments · {fmt(awaken.munny)}{' '}
                    Munny
                  </p>
                  <small>Aucun doublon consommé.</small>
                  <button
                    className="outline"
                    disabled={
                      busy ||
                      player.fragments < awaken.fragments ||
                      player.munny < awaken.munny
                    }
                    onClick={() =>
                      onAction('awaken', { copyId: copy.id, alternative: true })
                    }
                  >
                    Éveiller avec des fragments
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'fusion' && (
          <CopyFusion
            card={card}
            copy={copy}
            copies={player.copies}
            munny={player.munny}
            busy={busy}
            onFuse={(duplicateId) =>
              onAction('fuse', { copyId: copy.id, duplicateId })
            }
            onAllocate={(stat) =>
              onAction('allocate', { copyId: copy.id, stat })
            }
          />
        )}

        {tab === 'recycle' && (
          <>
            <p>
              Le recyclage détruit définitivement cet exemplaire et rapporte{' '}
              <strong>{economy.recycleFragments} fragments</strong>.
            </p>
            {protectedCopy ? (
              <p className="workshop-note">
                Exemplaire protégé : retirez le verrou, le favori ou la vitrine
                pour pouvoir le recycler.
              </p>
            ) : (
              <button
                className={armed ? 'danger workshop-go' : 'outline workshop-go'}
                disabled={busy}
                onClick={() => {
                  if (!armed) return setArmed(true);
                  setArmed(false);
                  onAction('recycle', { copyId: copy.id });
                }}
              >
                {armed
                  ? 'Confirmer : détruire cet exemplaire'
                  : 'Recycler cet exemplaire'}
              </button>
            )}
            {(copy.level > 1 || copy.awakening > 0 || (copy.fusion ?? 0) > 0) &&
              !protectedCopy && (
                <p className="workshop-note warn">
                  Attention : son niveau, son éveil et ses fusions seront
                  perdus.
                </p>
              )}
            <p className="workshop-note">
              Pour recycler plusieurs doublons d’un coup, utilisez l’atelier de
              recyclage de la collection.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
