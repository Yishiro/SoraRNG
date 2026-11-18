'use client';
import { useEffect, useMemo, useState } from 'react';
import { Recycle } from 'lucide-react';
import type { Card, Player } from '../game/core';
import { economy } from '../game/config';
import { recycleBatchLimit, suggestedRecycling } from '../game/workshop';

export default function RecycleWorkshop({
  player,
  cards,
  busy,
  onRecycle,
}: {
  player: Player;
  cards: Card[];
  busy: boolean;
  onRecycle: (copyIds: string[]) => void;
}) {
  const suggestions = useMemo(() => suggestedRecycling(player), [player]);
  const groups = useMemo(() => {
    const byCard = new Map<string, string[]>();
    for (const copy of suggestions)
      byCard.set(copy.cardId, [...(byCard.get(copy.cardId) ?? []), copy.id]);
    return [...byCard.entries()]
      .map(([cardId, ids]) => ({
        card: cards.find((c) => c.id === cardId),
        ids,
      }))
      .filter((g) => g.card)
      .sort((a, b) => a.card!.name.localeCompare(b.card!.name, 'fr'));
  }, [suggestions, cards]);
  // On mémorise ce que le joueur décoche : la sélection suit les suggestions.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const selected = new Set(
    suggestions
      .filter((c) => !excluded.has(c.id))
      .slice(0, recycleBatchLimit)
      .map((c) => c.id),
  );
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);
  if (!suggestions.length) return null;
  const count = selected.size;
  const toggle = (ids: string[], on: boolean) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  return (
    <details className="recycle-workshop">
      <summary>
        <Recycle size={16} aria-hidden="true" />
        Atelier de recyclage
        <span className="quest-badge">{suggestions.length}</span>
      </summary>
      <p>
        Doublons standards proposés au recyclage. Pour chaque modèle, le
        meilleur exemplaire est gardé, ainsi que les holographiques et tout ce
        qui est verrouillé, favori ou en vitrine.
      </p>
      <ul>
        {groups.map(({ card, ids }) => {
          const chosen = ids.filter((id) => selected.has(id)).length;
          return (
            <li key={card!.id}>
              <label>
                <input
                  type="checkbox"
                  checked={chosen === ids.length}
                  ref={(el) => {
                    if (el)
                      el.indeterminate = chosen > 0 && chosen < ids.length;
                  }}
                  onChange={(e) => toggle(ids, e.target.checked)}
                />
                <span>
                  <strong>{card!.name}</strong>
                  <small>
                    {card!.version} · {card!.rarity}
                  </small>
                </span>
              </label>
              <span className="recycle-count">
                {chosen} / {ids.length}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="recycle-footer">
        <span>
          {count} exemplaire{count > 1 ? 's' : ''} ·{' '}
          <strong>
            +{(count * economy.recycleFragments).toLocaleString('fr-FR')}{' '}
            fragments
          </strong>
        </span>
        <button
          className={armed ? 'danger' : 'outline'}
          disabled={busy || !count}
          onClick={() => {
            if (!armed) return setArmed(true);
            setArmed(false);
            onRecycle([...selected]);
          }}
        >
          {armed
            ? `Confirmer : détruire ${count} exemplaire${count > 1 ? 's' : ''}`
            : `Recycler la sélection`}
        </button>
      </div>
    </details>
  );
}
