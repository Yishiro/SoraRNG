'use client';
import { useState } from 'react';
import type { Card, Player } from '../game/core';
import { showcaseCopies, showcaseLimit } from '../game/showcase';

export default function ShowcaseEditor({
  player,
  cards,
  busy,
  onSave,
}: {
  player: Player;
  cards: Card[];
  busy: boolean;
  onSave: (copies: string[]) => void;
}) {
  const [selection, setSelection] = useState(() =>
    showcaseCopies(player).map((copy) => copy.id),
  );
  const [choice, setChoice] = useState('');
  const owned = new Map(player.copies.map((copy) => [copy.id, copy]));
  const ids = selection.filter((id) => owned.has(id));
  const label = (id: string) => {
    const copy = owned.get(id)!;
    const card = cards.find((item) => item.id === copy.cardId);
    return `${card?.name ?? copy.cardId} · ${card?.version ?? ''} · Niv. ${copy.level} · Éveil ${copy.awakening}${copy.holo ? ' · Holographique' : ''} · #${id.slice(0, 6)}`;
  };
  function move(index: number, direction: number) {
    const reordered = [...ids];
    [reordered[index], reordered[index + direction]] = [
      reordered[index + direction],
      reordered[index],
    ];
    setSelection(reordered);
  }
  return (
    <details className="panel showcase-editor">
      <summary>Personnaliser ma vitrine</summary>
      <p>
        Choisissez jusqu’à cinq exemplaires. Le premier est votre carte vedette
        sur le profil et dans /vitrine.
      </p>
      <ol className="wishlist-list">
        {ids.map((id, index) => (
          <li key={id}>
            <span>
              {index === 0 && 'Vedette · '}
              {label(id)}
            </span>
            <div className="action-row">
              <button
                className="outline"
                disabled={busy || index === 0}
                aria-label={`Monter la carte ${index + 1}`}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                className="outline"
                disabled={busy || index === ids.length - 1}
                aria-label={`Descendre la carte ${index + 1}`}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                className="outline"
                disabled={busy}
                onClick={() => setSelection(ids.filter((item) => item !== id))}
              >
                Retirer
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="filter-row">
        <select
          aria-label="Exemplaire à exposer"
          value={choice}
          disabled={busy || ids.length >= showcaseLimit}
          onChange={(event) => setChoice(event.target.value)}
        >
          <option value="">Choisir un exemplaire</option>
          {player.copies
            .filter((copy) => !ids.includes(copy.id))
            .map((copy) => (
              <option value={copy.id} key={copy.id}>
                {label(copy.id)}
              </option>
            ))}
        </select>
        <button
          className="outline"
          disabled={
            busy ||
            !owned.has(choice) ||
            ids.includes(choice) ||
            ids.length >= showcaseLimit
          }
          onClick={() => {
            setSelection([...ids, choice]);
            setChoice('');
          }}
        >
          Ajouter à la vitrine
        </button>
        <button className="primary" disabled={busy} onClick={() => onSave(ids)}>
          Enregistrer la vitrine
        </button>
      </div>
    </details>
  );
}
