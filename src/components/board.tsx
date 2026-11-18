'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import type { Card, Player } from '../game/core';
import {
  announcementKinds,
  boardRules,
  type AnnouncementKind,
} from '../game/community';

type Announcement = {
  id: string;
  playerId: string;
  playerName: string;
  kind: AnnouncementKind;
  text: string;
  cardIds: string[];
  createdAt: string;
  expiresAt: string;
};
type Filter = 'all' | AnnouncementKind | 'wishlist';

function timeLeft(iso: string) {
  const ms = Math.max(0, Date.parse(iso) - Date.now());
  const h = Math.floor(ms / 3600000);
  return h >= 1 ? `${h} h restantes` : `${Math.ceil(ms / 60000)} min restantes`;
}

export default function Board({
  player,
  playerId,
  cards,
  busy,
  onAction,
}: {
  player?: Player;
  playerId?: string;
  cards: Card[];
  busy: boolean;
  onAction: (
    kind: string,
    payload: Record<string, unknown>,
  ) => Promise<unknown> | void;
}) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [kind, setKind] = useState<AnnouncementKind>('seek');
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [armed, setArmed] = useState(false);
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/announcements', { cache: 'no-store' });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error ?? 'Tableau indisponible.');
      setItems(Array.isArray(body?.announcements) ? body.announcements : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tableau indisponible.');
    }
  }, []);
  useEffect(() => {
    // Chargement initial depuis l'API : l'état est mis à jour après la réponse.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);
  const wishlist = new Set(player?.wishlist ?? []);
  const shown = items.filter((a) =>
    filter === 'all'
      ? true
      : filter === 'wishlist'
        ? a.kind === 'offer' && a.cardIds.some((id) => wishlist.has(id))
        : a.kind === filter,
  );
  const mineActive = items.filter((a) => a.playerId === playerId).length;
  const matches = search.trim()
    ? cards
        .filter(
          (c) =>
            !picked.includes(c.id) &&
            `${c.name} ${c.version}`
              .toLocaleLowerCase('fr')
              .includes(search.toLocaleLowerCase('fr')),
        )
        .slice(0, 6)
    : [];
  const publish = async () => {
    if (!armed) return setArmed(true);
    setArmed(false);
    await onAction('announce', { kind, text, cardIds: picked });
    setText('');
    setPicked([]);
    await load();
  };
  return (
    <>
      {player && (
        <section className="panel board-compose" aria-labelledby="board-new">
          <h2 id="board-new">
            <Megaphone size={18} aria-hidden="true" /> Publier une annonce
          </h2>
          <p>
            {boardRules.cost.toLocaleString('fr-FR')} Munny par annonce, visible
            24 heures. {mineActive} / {boardRules.maxActive} annonces actives.
          </p>
          <div className="quest-tabs" role="group" aria-label="Type d’annonce">
            {(Object.keys(announcementKinds) as AnnouncementKind[]).map((k) => (
              <button
                key={k}
                aria-pressed={kind === k}
                className={kind === k ? 'active' : ''}
                onClick={() => setKind(k)}
              >
                {announcementKinds[k]}
              </button>
            ))}
          </div>
          <textarea
            aria-label="Texte de l’annonce"
            maxLength={boardRules.maxLength}
            rows={3}
            placeholder="Par exemple : je cherche Sora holographique, j’échange des doublons de Cité du Crépuscule."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <small className="board-count">
            {text.length} / {boardRules.maxLength}
          </small>
          <div className="board-cards-picker">
            <input
              aria-label="Ajouter une carte à l’annonce"
              placeholder={`Associer des cartes (${picked.length} / ${boardRules.maxCards})`}
              value={search}
              disabled={picked.length >= boardRules.maxCards}
              onChange={(e) => setSearch(e.target.value)}
            />
            {matches.length > 0 && (
              <ul>
                {matches.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => {
                        setPicked([...picked, c.id]);
                        setSearch('');
                      }}
                    >
                      {c.name} · {c.version}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {picked.length > 0 && (
              <div className="board-chips">
                {picked.map((id) => (
                  <span key={id}>
                    {byId.get(id)?.name ?? id}
                    <button
                      aria-label={`Retirer ${byId.get(id)?.name ?? id}`}
                      onClick={() => setPicked(picked.filter((p) => p !== id))}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            className={armed ? 'primary' : 'outline'}
            disabled={
              busy ||
              text.trim().length < 5 ||
              mineActive >= boardRules.maxActive ||
              player.munny < boardRules.cost
            }
            onClick={() => void publish()}
          >
            {armed
              ? `Confirmer : payer ${boardRules.cost.toLocaleString('fr-FR')} Munny`
              : 'Publier l’annonce'}
          </button>
        </section>
      )}
      <section className="panel" aria-labelledby="board-list">
        <div className="section-title">
          <h2 id="board-list">Le tableau</h2>
          <div className="quest-tabs" role="group" aria-label="Filtrer">
            {(
              [
                ['all', 'Toutes'],
                ['seek', 'Je cherche'],
                ['offer', 'Je propose'],
                ...(player ? [['wishlist', 'Pour ma liste']] : []),
              ] as [Filter, string][]
            ).map(([f, label]) => (
              <button
                key={f}
                aria-pressed={filter === f}
                className={filter === f ? 'active' : ''}
                onClick={() => setFilter(f)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {error && <p role="alert">{error}</p>}
        {shown.length ? (
          <ul className="board-list">
            {shown.map((a) => (
              <li key={a.id} className={`board-item board-${a.kind}`}>
                <div className="board-meta">
                  <span className="board-kind">
                    {announcementKinds[a.kind]}
                  </span>
                  <Link href={`/profile/${a.playerId}`}>{a.playerName}</Link>
                  <small>{timeLeft(a.expiresAt)}</small>
                </div>
                <p>{a.text}</p>
                {a.cardIds.length > 0 && (
                  <div className="board-chips">
                    {a.cardIds.map((id) => (
                      <Link
                        key={id}
                        href={`/cards/${id}`}
                        className={wishlist.has(id) ? 'wanted' : ''}
                      >
                        {byId.get(id)?.name ?? id}
                      </Link>
                    ))}
                  </div>
                )}
                {a.playerId === playerId && (
                  <button
                    className="text-link"
                    disabled={busy}
                    onClick={async () => {
                      await onAction('announce-remove', { id: a.id });
                      await load();
                    }}
                  >
                    Retirer mon annonce
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>Aucune annonce pour ce filtre.</p>
        )}
      </section>
    </>
  );
}
