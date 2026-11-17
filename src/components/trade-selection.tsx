'use client';
import { useState } from 'react';
import type { Card, Copy } from '../game/core';
import { tradeStacks, selectStackQuantity } from '../game/trade-stacks';
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
  const groups = tradeStacks(copies);
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
        <button
          className="text-link"
          disabled={busy || !selection.length}
          onClick={() => onChange([])}
        >
          Tout désélectionner
        </button>
      </div>
      <div className="trade-stacks">
        {groups
          .filter((g) => {
            const card = cards.find((c) => c.id === g.cardId);
            return `${card?.name} ${card?.version} ${g.cardId}`
              .toLocaleLowerCase('fr')
              .includes(search.toLocaleLowerCase('fr'));
          })
          .map((g) => {
            const card = cards.find((c) => c.id === g.cardId);
            const quantity = g.copies.filter((c) =>
              selection.includes(c.id),
            ).length;
            return (
              <div
                className={`trade-stack ${g.holo ? 'trade-stack-holo' : ''}`}
                key={g.key}
              >
                <div>
                  <strong>{card?.name ?? g.cardId}</strong>
                  <small>
                    {card?.version} · {g.holo ? 'Holographique' : 'Standard'} ·
                    Nv.{g.level} · Éveil {g.awakening}
                    {g.favorite ? ' · Favori' : ''}
                  </small>
                  <small>
                    {g.copies.length} exemplaire{g.copies.length > 1 ? 's' : ''}{' '}
                    disponible{g.copies.length > 1 ? 's' : ''}
                  </small>
                </div>
                <label>
                  Quantité
                  <input
                    aria-label={`Quantité ${card?.name ?? g.cardId} ${g.holo ? 'holographique' : 'standard'} niveau ${g.level} éveil ${g.awakening}${g.favorite ? ' favori' : ''}`}
                    type="number"
                    min={0}
                    max={Math.min(g.copies.length, 50)}
                    step={1}
                    value={quantity}
                    disabled={busy}
                    onChange={(e) => {
                      try {
                        onChange(
                          selectStackQuantity(
                            selection,
                            g.copies,
                            Number(e.target.value),
                          ),
                        );
                        onError('');
                      } catch (err) {
                        onError(
                          err instanceof Error
                            ? err.message
                            : 'Quantité invalide',
                        );
                      }
                    }}
                  />
                </label>
              </div>
            );
          })}
      </div>
      {!groups.length && (
        <p>
          Aucune carte échangeable. Les exemplaires verrouillés sont exclus.
        </p>
      )}
    </>
  );
}
