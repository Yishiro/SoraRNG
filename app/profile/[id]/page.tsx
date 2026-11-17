import Link from 'next/link';
import { notFound } from 'next/navigation';
import { pool, catalog } from '../../../src/server/game';
import GameCard from '../../../src/components/game-card';
import type { Player } from '../../../src/game/core';
import { showcaseCopies } from '../../../src/game/showcase';
import { worlds } from '../../../src/game/worlds';
export const dynamic = 'force-dynamic';
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = (
    await pool.query(
      'SELECT name,state,"createdAt" FROM "Player" WHERE id=$1',
      [id],
    )
  ).rows[0];
  if (!row || row.state.moderation?.suspended) notFound();
  const p: Player = row.state;
  const cards = await catalog();
  const discovered = new Set(
    p.discoveries ?? p.copies.map((copy) => copy.cardId),
  ).size;
  const owned = new Set(p.copies.map((copy) => copy.cardId));
  const favorites = showcaseCopies(p);
  const discoveries = new Set([...(p.discoveries ?? []), ...owned]);
  const badges = worlds.filter((world) =>
    world.cards.every((id) => discoveries.has(id)),
  );
  const wished = cards.filter((card) => p.wishlist?.includes(card.id));
  return (
    <main
      className="card-club collector-profile"
      style={{ maxWidth: 1100, margin: 'auto', padding: '60px 25px' }}
    >
      <Link className="text-link" href="/dashboard">
        ← Retour au sanctuaire
      </Link>
      <section className="panel" style={{ marginTop: 25 }}>
        <span className="eyebrow">PROFIL COLLECTIONNEUR · ÉDITION 01</span>
        <h1>{row.name}</h1>
        <p>
          {p.copies.length} exemplaires ·{' '}
          {p.discoveries?.length ?? new Set(p.copies.map((c) => c.cardId)).size}
          /150 modèles découverts · {p.summons} invocations.
        </p>
        <p>
          Membre depuis{' '}
          {new Date(row.createdAt).toLocaleDateString('fr-FR', {
            month: 'long',
            year: 'numeric',
            timeZone: 'Europe/Paris',
          })}
        </p>
        <div className="edition-progress-track">
          <span
            style={{ width: `${Math.min(100, (discovered / 150) * 100)}%` }}
          />
        </div>
        <div className="collection-overview">
          <div>
            <span>Modèles possédés</span>
            <strong>
              {owned.size}
              <small> / 150</small>
            </strong>
          </div>
          <div>
            <span>Holographiques</span>
            <strong>{p.copies.filter((copy) => copy.holo).length}</strong>
          </div>
          <div>
            <span>Doublons</span>
            <strong>{p.copies.length - owned.size}</strong>
          </div>
          <div>
            <span>Cartes recherchées</span>
            <strong>{wished.length}</strong>
          </div>
        </div>
      </section>
      <section className="panel">
        <span className="eyebrow">LA VITRINE</span>
        <h2>{p.showcase ? 'Exemplaires exposés' : 'Cartes favorites'}</h2>
        {badges.length > 0 && (
          <p>
            Insignes du Carnet · {badges.map((world) => world.name).join(' · ')}
          </p>
        )}
        {!favorites.length && (
          <p>Aucune carte favorite exposée pour le moment.</p>
        )}
        <div className="profile-card-grid">
          {favorites.map((copy, index) => {
            const card = cards.find((card) => card.id === copy.cardId);
            return (
              card && (
                <div key={`${card.id}-${index}`}>
                  {index === 0 && (
                    <span className="eyebrow">Carte vedette</span>
                  )}
                  <GameCard
                    key={`${card.id}-${index}`}
                    card={card}
                    copy={{
                      id: card.id,
                      cardId: card.id,
                      holo: copy.holo,
                      level: copy.level,
                      awakening: copy.awakening,
                      locked: false,
                      favorite: false,
                    }}
                  />
                </div>
              )
            );
          })}
        </div>
      </section>
      <section className="panel wishlist-panel">
        <span className="eyebrow">LES PROCHAINES RENCONTRES</span>
        <h2>Wishlist</h2>
        <p>Les cartes que {row.name} souhaite collectionner.</p>
        <ul className="wishlist-list">
          {wished.map((card) => (
            <li key={card.id}>
              <span>
                <Link href={`/cards/${card.id}`}>{card.name}</Link>
                <small>
                  {card.version} · {card.rarity}
                </small>
              </span>
              <span>{owned.has(card.id) ? 'Possédée' : 'Recherchée'}</span>
            </li>
          ))}
        </ul>
        {!wished.length && <p>Aucune carte recherchée pour le moment.</p>}
      </section>
    </main>
  );
}
