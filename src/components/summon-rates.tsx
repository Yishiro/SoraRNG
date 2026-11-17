import type { Card } from '../game/core';
import type { summonOdds } from '../game/boosts';
import { rarities } from '../game/config';

export default function SummonRates({
  cards,
  odds,
}: {
  cards: Card[];
  odds: ReturnType<typeof summonOdds>;
}) {
  return (
    <section className="panel">
      <h2>Probabilités d’obtention</h2>
      <p>
        Les résultats sont enregistrés avant leur révélation. Aucune rareté
        garantie, quel que soit le nombre de boosters.
      </p>
      {cards.length !== 150 && (
        <p className="warning">
          Invocations indisponibles : le catalogue de référence n’a pas encore
          été fourni.
        </p>
      )}
      <h3>
        {odds.active
          ? 'Probabilités avec le boost actif'
          : 'Probabilités · Standard v2'}
      </h3>
      <div className="rates">
        {rarities.map((r, i) => (
          <span key={r}>
            {r}
            <b>{(odds.rates[i] / 100).toLocaleString('fr-FR')} %</b>
            <small>
              {cards.filter((c) => c.rarity === r).length} cartes éligibles
            </small>
          </span>
        ))}
      </div>
    </section>
  );
}
