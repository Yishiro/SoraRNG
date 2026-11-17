'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { WalletLogs, WalletAmounts } from '../server/wallet-logs';
const labels: Record<string, string> = {
  baseline: 'État initial du journal',
  'account.create': 'Création du compte',
  unattributed: 'Modification sans attribution',
  deposit: 'Dépôt en banque',
  withdraw: 'Retrait bancaire',
  bonus: 'Bonus Discord',
  donate: 'Don',
  double: 'Double ou rien',
  roulette: 'Roulette',
  summon: 'Ouverture de booster',
  shop: 'Boutique',
  mission: 'Récompense de quête',
  upgrade: 'Amélioration',
  awakening: 'Éveil',
  'admin.adjust': 'Ajustement staff',
  'resources.adjust': 'Ajustement staff',
  'auction.bid': 'Mise / remboursement aux enchères',
  'auction.settle': 'Fin d’enchère',
  'auction.create': 'Mise en vente',
  'challenge.answer': 'Défi remporté',
};
const sources: Record<string, string> = {
  all: 'Toutes les origines',
  site: 'Site',
  economy: 'Économie / Discord',
  market: 'Marché',
  admin: 'Staff',
  system: 'Système',
};
const money = (value: number | null | undefined) =>
  value == null ? 'Non enregistré' : value.toLocaleString('fr-FR');
function bank(value: string | undefined) {
  return value === undefined
    ? 'Non enregistré'
    : (BigInt(value) / 1000000n).toLocaleString('fr-FR');
}
function Balances({ value }: { value: WalletAmounts | null }) {
  if (!value) return <span>Non enregistré</span>;
  return (
    <dl className="wallet-balances">
      <div>
        <dt>Disponible</dt>
        <dd>{money(value.wallet)}</dd>
      </div>
      <div>
        <dt>Épargne enregistrée</dt>
        <dd>{bank(value.bankMicros)}</dd>
      </div>
      <div>
        <dt>Mises réservées</dt>
        <dd>{money(value.reserved)}</dd>
      </div>
      <div>
        <dt>Gains possibles réservés</dt>
        <dd>{money(value.liability)}</dd>
      </div>
    </dl>
  );
}
export default function WalletLogPanel({
  initialSearch = '',
}: {
  initialSearch?: string;
}) {
  const [q, setQ] = useState(initialSearch),
    [source, setSource] = useState('all'),
    [direction, setDirection] = useState('all'),
    [mode, setMode] = useState('ledger'),
    [from, setFrom] = useState(''),
    [until, setUntil] = useState('');
  const [data, setData] = useState<WalletLogs | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [appliedMode, setAppliedMode] = useState('ledger');
  const active = useRef<Record<string, string>>({}),
    revision = useRef(0),
    controller = useRef<AbortController | null>(null);
  const load = useCallback(
    async (params: Record<string, string>, cursor = '') => {
      const version = ++revision.current;
      controller.current?.abort();
      controller.current = new AbortController();
      setBusy(true);
      setError('');
      try {
        const response = await fetch(
          `/api/admin/wallet-logs?${new URLSearchParams({ ...params, ...(cursor ? { cursor } : {}) })}`,
          { cache: 'no-store', signal: controller.current.signal },
        );
        const body = await response.json();
        if (version !== revision.current) return;
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) setData(null);
          throw new Error(body.error ?? 'Journal indisponible');
        }
        active.current = params;
        setAppliedMode(params.mode ?? 'ledger');
        setData(body);
      } catch (e) {
        if (
          version === revision.current &&
          !(e instanceof Error && e.name === 'AbortError')
        )
          setError(e instanceof Error ? e.message : 'Journal indisponible');
      } finally {
        if (version === revision.current) setBusy(false);
      }
    },
    [],
  );
  const cancel = useCallback(() => {
    revision.current++;
    controller.current?.abort();
  }, []);
  useEffect(() => {
    const timer = setTimeout(
      () =>
        void load({
          q: initialSearch,
          ...(/^\d{17,20}$/.test(initialSearch)
            ? { player: initialSearch }
            : {}),
          mode: 'ledger',
        }),
      0,
    );
    return () => {
      clearTimeout(timer);
      cancel();
    };
  }, [initialSearch, load, cancel]);
  return (
    <section className="panel wallet-log-panel">
      <h2>Logs Munny</h2>
      <p>
        Suivez séparément le portefeuille, l’épargne et les mises réservées. Un
        dépôt ou une mise peut réduire le disponible sans détruire l’argent.
      </p>
      <form
        className="wallet-log-filters"
        onSubmit={(e) => {
          e.preventDefault();
          void load({
            q,
            source,
            direction,
            mode,
            ...(/^\d{17,20}$/.test(q) ? { player: q } : {}),
            ...(from ? { from: new Date(from).toISOString() } : {}),
            ...(until ? { until: new Date(until).toISOString() } : {}),
          });
        }}
      >
        <label>
          Joueur
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pseudo ou identifiant Discord"
            maxLength={80}
          />
        </label>
        <label>
          Journal
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="ledger">Mouvements financiers vérifiés</option>
            <option value="legacy">Historique applicatif existant</option>
          </select>
        </label>
        <label>
          Origine
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            {Object.entries(sources).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mouvement du portefeuille
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
          >
            <option value="all">Tous</option>
            <option value="debit">Débits</option>
            <option value="credit">Crédits</option>
          </select>
        </label>
        <label>
          Depuis (heure locale)
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Avant (heure locale)
          <input
            type="datetime-local"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </label>
        <button className="primary" disabled={busy}>
          Rechercher
        </button>
        <button
          className="outline"
          type="button"
          disabled={busy}
          onClick={() => void load(active.current)}
        >
          Actualiser les logs
        </button>
      </form>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {busy && <p role="status">Chargement des mouvements…</p>}
      {data?.player && (
        <div className="wallet-current">
          <h3>{data.player.name} · Situation actuelle</h3>
          <Balances value={data.player.amounts} />
          <small>
            L’épargne affichée correspond au dernier montant enregistré ; les
            intérêts en cours sont calculés par la banque.
          </small>
        </div>
      )}
      {appliedMode === 'legacy' && (
        <p className="notice">
          Historique applicatif : les montants disponibles sont issus des
          opérations existantes. Les soldes avant sont parfois reconstitués par
          différence. Les mouvements anciens du marché et l’épargne ne sont pas
          tous enregistrés ici ; une absence de ligne ne prouve pas une perte.
        </p>
      )}
      <div className="wallet-entries" aria-busy={busy}>
        {data?.entries.map((entry) => {
          const delta =
            entry.before?.wallet != null && entry.after.wallet != null
              ? entry.after.wallet - entry.before.wallet
              : null;
          return (
            <details className="wallet-entry" key={entry.id}>
              <summary>
                <span>
                  <strong>{entry.playerName}</strong>
                  <small>
                    {new Intl.DateTimeFormat('fr-FR', {
                      timeZone: 'Europe/Paris',
                      dateStyle: 'short',
                      timeStyle: 'medium',
                    }).format(new Date(entry.createdAt))}{' '}
                    · Paris
                  </small>
                </span>
                <span>
                  {labels[entry.kind] ?? entry.kind}
                  <small>{sources[entry.source] ?? entry.source}</small>
                </span>
                <strong
                  className={
                    delta !== null && delta < 0
                      ? 'wallet-debit'
                      : 'wallet-credit'
                  }
                >
                  {delta == null
                    ? 'État enregistré'
                    : `${delta > 0 ? '+' : ''}${money(delta)} Munny`}
                </strong>
              </summary>
              <div className="wallet-comparison">
                <div>
                  <h4>Avant</h4>
                  <Balances value={entry.before} />
                </div>
                <div>
                  <h4>Après</h4>
                  <Balances value={entry.after} />
                </div>
              </div>
              <p className="admin-caption">
                Joueur : {entry.playerId} · Opération : {entry.id}
                {entry.actorId && ` · Auteur : ${entry.actorId}`}
                {entry.reference && ` · Référence : ${entry.reference}`}
              </p>
              {entry.detail && Object.keys(entry.detail).length > 0 && (
                <pre>{JSON.stringify(entry.detail, null, 2)}</pre>
              )}
            </details>
          );
        })}
        {data && !data.entries.length && (
          <p>
            Aucun mouvement pour ces filtres. Pour les opérations antérieures à
            l’installation du journal, choisissez « Historique applicatif
            existant ».
          </p>
        )}
      </div>
      {data?.nextCursor && (
        <button
          className="outline"
          disabled={busy}
          onClick={() => void load(active.current, data.nextCursor!)}
        >
          Mouvements plus anciens
        </button>
      )}
    </section>
  );
}
