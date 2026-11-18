'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Card, Copy } from '../game/core';
import {
  copyStats,
  fusion,
  fusionCost,
  fusionFodder,
  fusionRank,
  statKeys,
  statNames,
  unspentPoints,
  type StatKey,
} from '../game/stats';

// Repère visuel des barres : une Secrète niveau max tourne autour de ces valeurs.
const scale: Record<StatKey, number> = {
  hp: 320,
  atk: 160,
  def: 160,
  spd: 160,
};

export default function CopyFusion({
  card,
  copy,
  copies,
  showcase,
  munny,
  busy,
  onFuse,
  onAllocate,
}: {
  card: Card;
  copy: Copy;
  copies: Copy[];
  showcase: readonly string[];
  munny: number;
  busy: boolean;
  onFuse: (duplicateId: string) => void;
  onAllocate: (stat: StatKey) => void;
}) {
  const stats = copyStats(card, copy);
  const rank = fusionRank(copy);
  const points = unspentPoints(copy);
  const fodder = copies.filter((c) => fusionFodder(c, copy, showcase));
  const [choice, setChoice] = useState('');
  const duplicate = fodder.find((c) => c.id === choice) ?? fodder[0];
  const cost = fusionCost(copy);
  const maxed = rank >= fusion.maxRank;
  return (
    <section className="copy-fusion" aria-labelledby={`fusion-${copy.id}`}>
      <div className="copy-fusion-head">
        <h3 id={`fusion-${copy.id}`}>Statistiques de combat</h3>
        <span className="fusion-rank">
          Fusion {rank} / {fusion.maxRank}
        </span>
      </div>
      <dl className="stat-bars">
        {statKeys.map((key) => (
          <div key={key}>
            <dt>{statNames[key]}</dt>
            <dd>
              <span className="stat-track" aria-hidden="true">
                <i
                  style={{
                    width: `${Math.min(100, (stats[key] / scale[key]) * 100)}%`,
                  }}
                />
              </span>
              <strong>{stats[key]}</strong>
              {copy.bonus?.[key] ? <small>+{copy.bonus[key]} pt</small> : null}
              {points > 0 && (
                <button
                  className="icon-button stat-add"
                  disabled={busy}
                  aria-label={`Ajouter un point en ${statNames[key]}`}
                  onClick={() => onAllocate(key)}
                >
                  <Plus size={14} />
                </button>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {points > 0 && (
        <p className="fusion-points" role="status">
          {points} point{points > 1 ? 's' : ''} à répartir.
        </p>
      )}
      {maxed ? (
        <p className="fusion-note">
          Cet exemplaire a atteint la fusion maximale.
        </p>
      ) : fodder.length ? (
        <div className="fusion-form">
          <label>
            Doublon à fusionner
            <select
              value={duplicate?.id ?? ''}
              onChange={(e) => setChoice(e.target.value)}
            >
              {fodder.map((c, i) => (
                <option key={c.id} value={c.id}>
                  Doublon standard {i + 1} · niveau 1
                </option>
              ))}
            </select>
          </label>
          <button
            className="outline"
            disabled={busy || !duplicate || munny < cost}
            onClick={() => duplicate && onFuse(duplicate.id)}
          >
            Fusionner pour {cost.toLocaleString('fr-FR')} Munny
          </button>
          <p className="fusion-note">
            Le doublon est consommé. Rang {rank + 1} : +{fusion.pointsPerRank}{' '}
            points à répartir.
          </p>
        </div>
      ) : (
        <p className="fusion-note">
          Pour fusionner, il faut un doublon standard de ce modèle : niveau 1,
          sans éveil, ni holographique, ni verrouillé, ni favori, ni en vitrine.
        </p>
      )}
    </section>
  );
}
