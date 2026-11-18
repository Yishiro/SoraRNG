'use client';
import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { Card, Copy } from '../game/core';
import { tradeStacks, selectStackQuantity } from '../game/trade-stacks';
import GameCard from './game-card';

export default function TradeSelection({
  copies,
  cards,
  selection,
  onChange,
  busy,
  onError,
}: {
  copies: Copy[];
  cards: Card[];
  selection: string[];
  onChange: (ids: string[]) => void;
  busy: boolean;
  onError: (message: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [onlySelected, setOnlySelected] = useState(false);
  const groups = tradeStacks(copies);
  const byId = new Map(cards.map((card) => [card.id, card]));
  const setQuantity = (stack: Copy[], quantity: number) => {
    try {
      onChange(selectStackQuantity(selection, stack, quantity));
      onError('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Quantité invalide');
    }
  };
  const visible = groups
    .map((g) => ({
      ...g,
      card: byId.get(g.cardId),
      chosen: g.copies.filter((c) => selection.includes(c.id)).length,
    }))
    .filter(
      (g) =>
        (!onlySelected || g.chosen > 0) &&
        `${g.card?.name} ${g.card?.version} ${g.cardId}`
          .toLocaleLowerCase('fr')
          .includes(search.toLocaleLowerCase('fr')),
    )
    .sort(
      (a, b) =>
        (a.card?.name ?? a.cardId).localeCompare(
          b.card?.name ?? b.cardId,
          'fr',
        ) || Number(b.holo) - Number(a.holo),
    );
  return (
    <>
      <div className="trade-selection-heading">
        <h3>Votre sélection · {selection.length} / 50 exemplaires</h3>
        <input
          aria-label="Rechercher dans les cartes échangeables"
          placeholder="Filtrer les cartes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="trade-only-selected">
          <input
            type="checkbox"
            checked={onlySelected}
            onChange={(e) => setOnlySelected(e.target.checked)}
          />{' '}
          Sélection seulement
        </label>
        <button
          className="text-link"
          disabled={busy || !selection.length}
          onClick={() => onChange([])}
        >
          Tout désélectionner
        </button>
      </div>
      <div className="trade-card-grid">
        {visible.map((g) => {
          const label = `${g.card?.name ?? g.cardId} ${g.holo ? 'holographique' : 'standard'} niveau ${g.level} éveil ${g.awakening}${g.favorite ? ' favori' : ''}`;
          return (
            <div
              key={g.key}
              className={`trade-tile ${g.chosen ? 'selected' : ''}`}
            >
              {g.card ? (
                // Raccourci souris : un clic sur la carte ajoute un exemplaire.
                // Au clavier, le bouton « + » ci-dessous fait la même chose.
                <div
                  className="trade-tile-face"
                  onClick={() =>
                    !busy &&
                    g.chosen < g.copies.length &&
                    setQuantity(g.copies, g.chosen + 1)
                  }
                >
                  <GameCard
                    card={g.card}
                    copy={g.copies[0]}
                    quantity={g.copies.length}
                    showDetails={false}
                  />
                </div>
              ) : (
                <strong>{g.cardId}</strong>
              )}
              {g.chosen > 0 && (
                <span className="trade-tile-badge" aria-hidden="true">
                  {g.chosen}
                </span>
              )}
              <div className="trade-tile-controls">
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Retirer un exemplaire : ${label}`}
                  disabled={busy || g.chosen === 0}
                  onClick={() => setQuantity(g.copies, g.chosen - 1)}
                >
                  <Minus size={15} />
                </button>
                <input
                  aria-label={`Quantité ${label}`}
                  type="number"
                  min={0}
                  max={Math.min(g.copies.length, 50)}
                  step={1}
                  value={g.chosen}
                  disabled={busy}
                  onChange={(e) =>
                    setQuantity(g.copies, Number(e.target.value))
                  }
                />
                <span>/ {g.copies.length}</span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Ajouter un exemplaire : ${label}`}
                  disabled={busy || g.chosen >= g.copies.length}
                  onClick={() => setQuantity(g.copies, g.chosen + 1)}
                >
                  <Plus size={15} />
                </button>
              </div>
              {(g.favorite || g.fusion > 0) && (
                <small className="trade-tile-note">
                  {[
                    g.fusion > 0 ? `Fusion ${g.fusion}` : '',
                    g.favorite ? 'Favori' : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              )}
            </div>
          );
        })}
      </div>
      {!groups.length && (
        <p>
          Aucune carte échangeable. Les exemplaires verrouillés sont exclus.
        </p>
      )}
      {groups.length > 0 && !visible.length && (
        <p>Aucune carte ne correspond à ce filtre.</p>
      )}
    </>
  );
}
