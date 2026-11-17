import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Player } from '../game/core';
import CollectionCover from './collection-cover';

export default function DashboardWelcome({
  player,
  name,
  discovered,
}: {
  player?: Player;
  name?: string;
  discovered: number;
}) {
  if (player)
    return (
      <section className="member-home" aria-label="Votre prochaine aventure">
        <div>
          <span className="eyebrow">Bon retour, {name}</span>
          <h1>Prêt pour la prochaine découverte ?</h1>
          <p>
            {discovered} modèles découverts sur 150 · {player.copies.length}{' '}
            exemplaires dans votre collection.
          </p>
        </div>
        <div className="member-home-actions">
          <Link href="/summon" className="primary">
            Ouvrir un booster <ChevronRight size={16} />
          </Link>
          <Link href="/collection" className="outline">
            Ma collection
          </Link>
          <Link href="/missions" className="text-link">
            Mes objectifs →
          </Link>
        </div>
      </section>
    );
  return (
    <section className="hero">
      <div className="hero-copy">
        <span className="collection-edition">01 / COLLECTION PERMANENTE</span>
        <h2>
          Kingdom
          <br />
          Hearts
        </h2>
        <p>
          150 cartes de personnages, de créatures et d’objets. Ouvrez des
          boosters, complétez le Codex et retrouvez vos doubles.
        </p>
        <div className="hero-actions">
          {player ? (
            <Link href="/summon" className="primary">
              Ouvrir un booster <ChevronRight size={16} />
            </Link>
          ) : (
            <Link href="/codex" className="primary">
              Découvrir les 150 cartes <ChevronRight size={16} />
            </Link>
          )}
          {player ? (
            <Link href="/codex" className="text-link">
              Voir les 150 cartes ↗
            </Link>
          ) : (
            <a href="#bien-demarrer" className="text-link">
              Comment commencer ↓
            </a>
          )}
        </div>
        <div className="hero-foot">
          <span>150 cartes</span>
          <span>6 raretés</span>
          <span>5 cartes / booster</span>
        </div>
      </div>
      <CollectionCover />
    </section>
  );
}
