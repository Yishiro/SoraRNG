'use client';
import { useState } from 'react';
import { BookOpen, LockKeyhole, Sparkles } from 'lucide-react';
import type { Card, Player } from '../game/core';
import { collectionProgress, discoveryIds } from '../game/collection';
import GameCard from './game-card';
export default function Codex({
  cards,
  player,
}: {
  cards: Card[];
  player?: Player;
}) {
  const [catalogue, setCatalogue] = useState(false);
  const [holo, setHolo] = useState(false);
  const [search, setSearch] = useState('');
  const [rarity, setRarity] = useState('Toutes');
  const [origin, setOrigin] = useState('Tous');
  const [status, setStatus] = useState('Toutes');
  const preview = !player || catalogue;
  const ids = discoveryIds(player, holo);
  const progress = collectionProgress(cards, player, holo);
  const normal = collectionProgress(cards, player, false),
    foil = collectionProgress(cards, player, true);
  const filtered = cards.filter(
    (c) =>
      (rarity === 'Toutes' || c.rarity === rarity) &&
      (origin === 'Tous' || c.origin === origin) &&
      (status === 'Toutes' ||
        (status === 'Découvertes' ? ids.has(c.id) : !ids.has(c.id))) &&
      (!search ||
        ((preview || ids.has(c.id)) &&
          `${c.name} ${c.version} ${c.id}`
            .toLocaleLowerCase('fr')
            .includes(search.toLocaleLowerCase('fr')))),
  );
  return (
    <>
      <section className="panel codex-overview">
        <div className="section-title">
          <h2>
            <BookOpen size={20} /> Le livre de vos découvertes
          </h2>
          <span className="eyebrow">
            {preview ? 'CATALOGUE PUBLIC' : 'DÉCOUVERTES PERSONNELLES'}
          </span>
        </div>
        <p>
          Une découverte reste inscrite après un échange ou un recyclage. Le
          Codex global compte toutes les finitions ; le Codex holographique suit
          les découvertes holographiques uniquement.
        </p>
        <div className="codex-totals">
          <div>
            <small>Modèles découverts</small>
            <strong>
              {normal.discovered} <span>/ {normal.total}</span>
            </strong>
          </div>
          <div>
            <small>Codex holographique</small>
            <strong>
              {foil.discovered} <span>/ {foil.total}</span>
            </strong>
          </div>
          <div>
            <small>Exemplaires actuels</small>
            <strong>{player?.copies.length ?? 0}</strong>
          </div>
        </div>
        <div className="codex-controls">
          <div className="quest-tabs" role="group" aria-label="Finition">
            <button
              aria-pressed={!holo}
              className={!holo ? 'active' : ''}
              onClick={() => setHolo(false)}
            >
              Toutes finitions
            </button>
            <button
              aria-pressed={holo}
              className={holo ? 'active' : ''}
              onClick={() => setHolo(true)}
            >
              <Sparkles size={14} /> Holographiques
            </button>
          </div>
          {player && (
            <button
              className="workshop-chip"
              aria-pressed={catalogue}
              onClick={() => setCatalogue(!catalogue)}
            >
              {catalogue
                ? 'Revenir à mon Codex'
                : 'Afficher le catalogue complet'}
            </button>
          )}
        </div>
        {!player && (
          <p>
            Connectez-vous avec Discord pour suivre vos découvertes. Le
            catalogue public permet de consulter les cartes et les aperçus
            locaux.
          </p>
        )}
        <details className="codex-details">
          <summary>Progression par rareté et origine</summary>
          <div className="codex-breakdown">
            {[
              { title: 'Par rareté', groups: progress.byRarity },
              { title: 'Par origine', groups: progress.byOrigin },
            ].map(({ title, groups }) => (
              <div key={title}>
                <h3>{title}</h3>
                {groups.map((g) => (
                  <div className="codex-progress" key={g.name}>
                    <span>{g.name}</span>
                    <strong>
                      {g.discovered} / {g.total}
                    </strong>
                    <progress
                      aria-label={`${g.name} découvertes`}
                      value={g.discovered}
                      max={g.total}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </details>
      </section>
      <section className="panel">
        <div className="filter-row">
          <input
            aria-label="Rechercher dans le Codex"
            placeholder="Nom, version ou identifiant…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Rareté du Codex"
            value={rarity}
            onChange={(e) => setRarity(e.target.value)}
          >
            {['Toutes', ...progress.byRarity.map((g) => g.name)].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select
            aria-label="Origine du Codex"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
          >
            {['Tous', ...progress.byOrigin.map((g) => g.name)].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          {player && (
            <select
              aria-label="État de découverte"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {['Toutes', 'Découvertes', 'À découvrir'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
        </div>
        <p aria-live="polite">
          {filtered.length} carte{filtered.length > 1 ? 's' : ''} affichée
          {filtered.length > 1 ? 's' : ''}
        </p>
        <div className="cards-grid">
          {filtered.map((card) =>
            preview || ids.has(card.id) ? (
              <div key={card.id}>
                <GameCard card={card} holographic={holo} />
                {player && (
                  <small className="codex-discovery-label">
                    {ids.has(card.id)
                      ? '✦ Découverte enregistrée'
                      : 'Non découverte'}
                  </small>
                )}
              </div>
            ) : (
              <article
                className="game-card unknown-card"
                data-card-id={card.id}
                key={card.id}
              >
                <span className="card-top">
                  {card.rarity} · {card.id}
                </span>
                <LockKeyhole size={38} />
                <h3>Carte inconnue</h3>
                <p>{card.origin}</p>
                <small>
                  {holo
                    ? 'Finition holographique à découvrir'
                    : 'Invoquez pour révéler cette carte'}
                </small>
              </article>
            ),
          )}
        </div>
        {!filtered.length && (
          <div className="empty">
            <BookOpen />
            <h2>Aucune carte pour ces filtres</h2>
            <p>
              Modifiez vos critères pour retrouver les autres pages du Codex.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
