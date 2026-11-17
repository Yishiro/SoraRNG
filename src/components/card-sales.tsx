'use client';
import { useEffect, useState } from 'react';
import type { SaleHistory } from '../server/auction-history';
const price = (n: number) =>
  n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
export default function CardSales({
  cardId,
  holo = false,
}: {
  cardId: string;
  holo?: boolean;
}) {
  const [finish, setFinish] = useState(holo ? 'holo' : 'standard'),
    [data, setData] = useState<SaleHistory | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch(
      `/api/card-sales?cardId=${encodeURIComponent(cardId)}&finish=${finish}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        return body;
      })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [cardId, finish]);
  return (
    <section
      className="card-sales"
      aria-label="Historique des ventes de cette carte"
    >
      <h3>Prix de revente</h3>
      <div className="sale-averages">
        {[false, true].map((isHolo) => {
          const stat = data?.stats.find((s) => s.holo === isHolo);
          return (
            <div key={String(isHolo)}>
              <span>{isHolo ? '✦ Holographique' : 'Standard'}</span>
              <strong>
                {stat
                  ? `${price(stat.average)} Munny`
                  : data
                    ? 'Aucune vente'
                    : '—'}
              </strong>
              <small>
                {stat
                  ? `Moyenne · ${stat.count} vente${stat.count > 1 ? 's' : ''} finalisée${stat.count > 1 ? 's' : ''}`
                  : 'Pas encore de prix moyen'}
              </small>
              {stat && (
                <>
                  <span
                    className={`price-reference ${stat.count < 5 ? 'limited' : ''}`}
                  >
                    {stat.count === 1
                      ? 'Référence unique'
                      : stat.count < 5
                        ? 'Peu de références'
                        : stat.count < 20
                          ? 'Plusieurs références'
                          : 'Historique étoffé'}
                  </span>
                  <small>
                    Prix constatés : {price(stat.minimum)} à{' '}
                    {price(stat.maximum)} Munny
                  </small>
                  {stat.count < 5 && (
                    <small>
                      Échantillon limité : cette moyenne ne suffit pas à établir
                      un prix représentatif.
                    </small>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <p className="sale-notice">
        Le nombre de ventes aide à situer la moyenne, sans garantir le prix
        d’une future vente.
      </p>
      <details className="sale-history-details">
        <summary>Historique des ventes et calcul du prix moyen</summary>
        <label>
          Historique par finition
          <select
            value={finish}
            onChange={(e) => {
              setFinish(e.target.value);
              setData(null);
              setError('');
            }}
          >
            <option value="standard">Standard</option>
            <option value="holo">Holographique</option>
            <option value="all">Toutes les finitions</option>
          </select>
        </label>
        {error ? (
          <p role="alert">{error}</p>
        ) : !data ? (
          <p>Chargement des ventes…</p>
        ) : !data.sales.length ? (
          <p>Aucune vente finalisée pour cette finition.</p>
        ) : (
          <div className="sale-history-scroll">
            <table>
              <caption>20 dernières ventes finalisées au maximum</caption>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Exemplaire</th>
                  <th>Prix payé</th>
                </tr>
              </thead>
              <tbody>
                {data.sales.map((s) => (
                  <tr key={s.id}>
                    <td>{new Date(s.endedAt).toLocaleDateString('fr-FR')}</td>
                    <td>
                      {s.holo ? 'Holo' : 'Standard'} · Niv. {s.level} · Éveil{' '}
                      {s.awakening}
                    </td>
                    <td>{price(s.price)} Munny</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="sale-notice">
          Moyennes calculées sur toutes les ventes finalisées de ce modèle,
          niveaux et éveils confondus. Les offres en cours, annulations et
          ventes sans acheteur sont exclues. Ces prix sont indicatifs.
        </p>
      </details>
    </section>
  );
}
