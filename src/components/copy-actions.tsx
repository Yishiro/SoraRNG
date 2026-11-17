'use client';
import type { Copy } from '../game/core';
import { economy } from '../game/config';
export default function CopyActions({
  copy,
  maxLevel,
  busy,
  onAction,
}: {
  copy: Copy;
  maxLevel: number;
  busy: boolean;
  onAction: (kind: string, payload: Record<string, unknown>) => void;
}) {
  const needed = economy.awakeningDuplicates[copy.awakening] ?? 0;
  function confirm(kind: string, text: string, alternative = false) {
    if (window.confirm(text))
      onAction(kind, {
        copyId: copy.id,
        ...(alternative ? { alternative: true } : {}),
      });
  }
  return (
    <div className="copy-action-groups">
      <div className="copy-quick-actions">
        <button
          className="outline"
          disabled={busy}
          onClick={() => onAction('favorite', { copyId: copy.id })}
        >
          {copy.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        </button>
        <button
          className="outline"
          disabled={busy}
          onClick={() => onAction('lock', { copyId: copy.id })}
        >
          {copy.locked ? 'Déverrouiller' : 'Verrouiller'}
        </button>
      </div>
      <details>
        <summary>Améliorer cet exemplaire</summary>
        <p>
          Le niveau et l’éveil sont des progressions de collection. Ils ne
          modifient ni la rareté, ni la finition, ni les chances d’invocation.
        </p>
        <div className="copy-improvements">
          <div>
            <h3>
              Niveau {copy.level} / {maxLevel}
            </h3>
            <p>
              Le niveau suivant coûte{' '}
              {(copy.level * economy.levelCost).toLocaleString('fr-FR')} Munny
              et {economy.levelFragments} fragments. Les fragments sont une
              ressource utilisable pour améliorer vos cartes.
            </p>
            <button
              className="outline"
              disabled={busy || copy.locked || copy.level >= maxLevel}
              onClick={() =>
                confirm(
                  'upgrade',
                  `Passer au niveau ${copy.level + 1} pour ${copy.level * economy.levelCost} Munny et ${economy.levelFragments} fragments ?`,
                )
              }
            >
              Passer au niveau suivant
            </button>
          </div>
          <div>
            <h3>Éveil {copy.awakening} / 5</h3>
            <p>
              Un éveil consomme {needed} doublon(s) standard, niveau 1, sans
              éveil, ni verrou, ni favori et {needed * economy.awakeningMunny}{' '}
              Munny. Seuls les exemplaires éligibles du même modèle sont
              utilisés.
            </p>
            <button
              className="outline"
              disabled={busy || copy.locked || copy.awakening >= 5}
              onClick={() =>
                confirm(
                  'awaken',
                  `Consommer ${needed} doublon(s) éligible(s) et ${needed * economy.awakeningMunny} Munny pour cet éveil ?`,
                )
              }
            >
              Éveiller avec des doublons
            </button>
            <p>
              Alternative : {needed * economy.alternativeFragments} fragments et{' '}
              {needed * economy.awakeningMunny} Munny, sans consommer de
              doublon.
            </p>
            <button
              className="outline"
              disabled={busy || copy.locked || copy.awakening >= 5}
              onClick={() =>
                confirm(
                  'awaken',
                  `Consommer ${needed * economy.alternativeFragments} fragments et ${needed * economy.awakeningMunny} Munny ?`,
                  true,
                )
              }
            >
              Éveiller avec des fragments
            </button>
          </div>
        </div>
        {copy.locked && (
          <p>Déverrouillez cet exemplaire avant de l’améliorer.</p>
        )}
      </details>
      <details className="copy-danger">
        <summary>Gérer et recycler</summary>
        <p>
          Le recyclage détruit définitivement cet exemplaire et rapporte{' '}
          {economy.recycleFragments} fragments. Cette action est irréversible.
        </p>
        <button
          className="outline"
          disabled={busy || copy.locked}
          onClick={() =>
            confirm(
              'recycle',
              `Détruire définitivement cet exemplaire pour ${economy.recycleFragments} fragments ?`,
            )
          }
        >
          Recycler cet exemplaire
        </button>
        {copy.locked && <p>Déverrouillez cet exemplaire avant de recycler.</p>}
      </details>
    </div>
  );
}
