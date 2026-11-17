import Link from 'next/link';
import { notFound } from 'next/navigation';
import { catalog } from '../../../src/server/game';
import { rates, rarities, holoRate } from '../../../src/game/config';
import GameCard from '../../../src/components/game-card';
import CardSales from '../../../src/components/card-sales';
import { getCardLegend } from '../../../src/game/card-legends';
export const dynamic = 'force-dynamic';
export default async function CardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cards = await catalog();
  const card = cards.find((c) => c.id === id);
  if (!card) notFound();
  const probability =
    rates[rarities.indexOf(card.rarity)] /
    100 /
    cards.filter((c) => c.rarity === card.rarity).length;
  return (
    <main style={{ maxWidth: 850, padding: '60px 25px' }}>
      <Link className="text-link" href="/collection">
        ← Retour à la collection
      </Link>
      <section className="panel" style={{ marginTop: 25 }}>
        <span className="eyebrow">
          {card.rarity} · {card.version}
        </span>
        <h1>{card.name}</h1>
        <div style={{ maxWidth: 340, margin: '25px auto' }}>
          <GameCard card={card} showDetails={false} fullImage />
        </div>
        {getCardLegend(card.id) && (
          <section
            className="card-legend-detail"
            aria-labelledby="card-legend-title"
          >
            <span className="eyebrow">CHRONICLES OF LIGHT</span>
            <h2 id="card-legend-title">La légende de cette carte</h2>
            <blockquote>{getCardLegend(card.id)}</blockquote>
            <small>Texte d’ambiance original · SoraRNG</small>
          </section>
        )}
        <p>
          {card.type} · {card.origin} · Affinité : {card.affinity}
        </p>
        <p>Niveau maximum : {card.maxLevel} · Cinq éveils maximum.</p>
        <p>
          Probabilité individuelle standard :{' '}
          {probability.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} %
          par invocation. Finition holographique :{' '}
          {(holoRate / 100).toLocaleString('fr-FR')} % indépendamment.
        </p>
        <p>
          La finition est permanente. Les objets sont des cartes de collection ;
          aucun rôle de combattant n’est attribué sans données de référence.
        </p>
        <Link className="primary" href="/upgrade">
          Gérer mes exemplaires
        </Link>
        <CardSales cardId={card.id} />
      </section>
    </main>
  );
}
