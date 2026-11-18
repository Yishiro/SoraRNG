'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Gem, Star } from 'lucide-react';
import type { Card, Copy } from '../game/core';
import { rarities } from '../game/config';
import { getCardAsset } from '../game/assets';
import { getCardLegend } from '../game/card-legends';
import { useLocalCardAsset } from './use-local-card-assets';
import CopyProgress from './copy-progress';

export default function GameCard({
  card,
  copy,
  quantity = 1,
  onManage,
  showDetails = true,
  fullImage = false,
  holographic,
  children,
}: {
  card: Card;
  copy?: Copy;
  quantity?: number;
  onManage?: (id: string) => void;
  showDetails?: boolean;
  fullImage?: boolean;
  holographic?: boolean;
  children?: ReactNode;
}) {
  const asset = getCardAsset(card.id);
  const legend = getCardLegend(card.id);
  const isHolo = holographic ?? copy?.holo ?? false;
  const local = useLocalCardAsset(card.id);
  const imagePath = asset
    ? fullImage
      ? asset.localPath
      : asset.thumbnailPath
    : local
      ? fullImage
        ? local.image
        : local.thumbnail
      : null;
  const [failed, setFailed] = useState(false);
  return (
    <article
      className={`game-card illustrated-card rarity-${rarities.indexOf(card.rarity)} ${isHolo ? 'holo' : ''}`}
      data-card-id={card.id}
    >
      <div
        className="card-face"
        role={copy && onManage ? 'button' : undefined}
        tabIndex={copy && onManage ? 0 : undefined}
        aria-label={
          copy && onManage ? `Ouvrir ${card.name} · ${card.version}` : undefined
        }
        onClick={copy && onManage ? () => onManage(copy.id) : undefined}
        onKeyDown={
          copy && onManage
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onManage(copy.id);
                }
              }
            : undefined
        }
      >
        <span className="card-top">
          {card.rarity}
          <Star size={12} />
        </span>
        <div className="game-card-art">
          {imagePath && !failed ? (
            <Image
              src={imagePath}
              unoptimized
              alt={`${card.name} — ${card.version}`}
              fill
              sizes="(max-width: 700px) 45vw, (max-width: 1200px) 24vw, 220px"
              style={{ objectFit: 'contain', objectPosition: '50% 50%' }}
              onError={() => setFailed(true)}
            />
          ) : (
            <div
              className="neutral-card-frame"
              aria-label={`Illustration indisponible : ${card.name} — ${card.version}`}
            >
              <Gem size={42} strokeWidth={0.7} />
              <span>{card.name}</span>
              <small>{card.version}</small>
              <small className="missing-illustration">
                Illustration indisponible
              </small>
            </div>
          )}
          <span className="affinity-badge">{card.affinity}</span>
          {local && !asset && (
            <span
              className="local-preview-badge"
              title="Aperçu local : droits et version exacte à valider avant publication"
            >
              LOCAL
            </span>
          )}
        </div>
        <div className="card-bottom">
          <small>
            {card.type} · {card.version}
          </small>
          <h3>{card.name}</h3>
          <span>
            {isHolo ? '✦ Holographique' : 'Finition standard'} · Nv.{' '}
            {copy?.level ?? 1}
          </span>
        </div>
      </div>
      {copy && <CopyProgress card={card} copy={copy} />}
      {showDetails && legend && (
        <p className="card-legend-preview">
          <span>Légende · SoraRNG</span>
          {legend}
        </p>
      )}
      <div className="card-actions">
        {copy && (
          <small className="copy-details">
            {[
              quantity > 1 ? `×${quantity} exemplaires` : '',
              copy.locked ? 'Verrouillée' : '',
              copy.favorite ? 'Favori' : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </small>
        )}
        {copy && onManage && (
          <button className="outline" onClick={() => onManage(copy.id)}>
            Gérer un exemplaire
          </button>
        )}
        {showDetails && (
          <Link
            className="text-link card-details-link"
            href={`/cards/${encodeURIComponent(card.id)}`}
          >
            Consulter la fiche ↗
          </Link>
        )}
        {children}
      </div>
    </article>
  );
}
