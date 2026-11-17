'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { marketQuery, type MarketQuery } from '../game/market-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Gavel,
  Search,
  Clock3,
  ArrowUpRight,
  RotateCw,
  SlidersHorizontal,
} from 'lucide-react';
import type { Auction, AuctionInput } from '../server/auctions';
import type { Card } from '../game/core';
import { rarities } from '../game/config';
import GameCard from './game-card';
import CollectorDialog from './collector-dialog';
import CardSales from './card-sales';
const money = (n: number) => n.toLocaleString('fr-FR');
function remaining(a: Auction, now: number) {
  const seconds = Math.ceil((new Date(a.endsAt).getTime() - now) / 1000);
  if (a.status !== 'open')
    return a.status === 'sold'
      ? 'Vendue'
      : a.status === 'cancelled'
        ? 'Annulée'
        : 'Sans offre';
  if (seconds <= 0) return 'Clôture en cours';
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} min`;
  return `${Math.floor(seconds / 3600)} h ${Math.floor((seconds % 3600) / 60)} min`;
}
function standing(a: Auction, userId: string) {
  if (a.status === 'sold')
    return a.bidderId === userId ? 'Remportée' : 'Vendue';
  if (a.status !== 'open')
    return a.status === 'cancelled' ? 'Annulée' : 'Sans offre';
  if (a.sellerId === userId) return 'Votre vente';
  if (a.bidderId === userId) return 'Vous êtes en tête';
  if (a.hasBid) return 'Vous avez été surenchéri';
  return a.bidderId ? 'Enchère en cours' : 'Première offre';
}
export default function AuctionMarket({
  userId,
  cards,
  wallet,
  onChange,
}: {
  userId: string;
  cards: Card[];
  wallet: number;
  onChange: () => Promise<void>;
}) {
  const [auctions, setAuctions] = useState<Auction[]>([]),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [loadedParams, setLoadedParams] = useState<string | null>(null),
    [detail, setDetail] = useState<Auction | null>(null),
    [hasNext, setHasNext] = useState(false),
    [bid, setBid] = useState(''),
    [confirm, setConfirm] = useState(false),
    [now, setNow] = useState(() => Date.now());
  const params = useSearchParams().toString();
  const query = marketQuery.parse(
    Object.fromEntries(new URLSearchParams(params)),
  );
  const {
    view,
    search,
    rarity,
    finish,
    sort,
    card,
    page,
    auction: selectedId,
  } = query;
  const pending = useRef(false);
  const bidKey = useRef<string | null>(null);
  const initialized = useRef('');
  const activeRead = useRef<AbortController | null>(null);

  function update(
    values: Partial<Record<keyof MarketQuery, string>>,
    resetPage = true,
  ) {
    const url = new URL(window.location.href);
    if (resetPage) {
      url.searchParams.delete('page');
      url.searchParams.delete('auction');
    }
    for (const [key, value] of Object.entries(values)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history.replaceState(null, '', url);
  }

  const load = useCallback(
    async (sync = false) => {
      activeRead.current?.abort();
      const controller = new AbortController();
      activeRead.current = controller;
      const signal = controller.signal;
      try {
        if (sync) {
          const response = await fetch('/api/auctions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'sync', key: crypto.randomUUID() }),
            signal,
          });
          if (!response.ok) throw new Error((await response.json()).error);
        }
        const requestParams = new URLSearchParams(params);
        if (!requestParams.has('page')) requestParams.set('page', '1');
        const response = await fetch(`/api/auctions?${requestParams}`, {
          signal,
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (signal.aborted) return;
        setAuctions(body.auctions);
        setLoadedParams(params);
        setHasNext(body.hasNext);
        setDetail(body.detail);
        const target = requestParams.get('auction');
        if (target && !body.detail)
          setMessage('Cette enchère est indisponible.');
        if (body.detail && initialized.current !== body.detail.id) {
          initialized.current = body.detail.id;
          setBid(
            String(
              body.detail.bidderId
                ? body.detail.bid + 1
                : body.detail.startPrice,
            ),
          );
          setConfirm(false);
          bidKey.current = null;
        }
        setLoading(false);
        setNow(Date.now());
      } catch (error) {
        if (!signal.aborted) throw error;
      }
    },
    [params],
  );

  useEffect(() => {
    const refresh = (sync = false) => {
      if (!document.hidden && !pending.current)
        void load(sync).catch((e) => {
          setMessage(e.message);
          setLoading(false);
        });
    };
    const initial = setTimeout(refresh, 180);
    const timer = setInterval(() => refresh(true), 15000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      clearInterval(clock);
      activeRead.current?.abort();
    };
  }, [load]);
  async function action(input: Omit<AuctionInput, 'key'>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage('');
    bidKey.current ??= crypto.randomUUID();
    try {
      const r = await fetch('/api/auctions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...input, key: bidKey.current }),
        }),
        body = await r.json();
      if (!r.ok) {
        if (r.status < 500) bidKey.current = null;
        setConfirm(false);
        throw new Error(body.error);
      }
      bidKey.current = null;
      setMessage(
        input.action === 'bid'
          ? 'Votre mise a été enregistrée.'
          : 'La carte a été rendue à votre collection.',
      );
      setConfirm(false);
      update({ auction: '' }, false);
      await load();
      await onChange();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : 'Connexion interrompue. Vous pouvez réessayer.',
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const selected =
    detail?.id === selectedId
      ? detail
      : auctions.find((a) => a.id === selectedId);
  const selectedCard = cards.find((c) => c.id === selected?.copy.cardId);
  // Opening an existing row changes the detail query, not the list filters.
  function listParams(value: string | null) {
    if (value === null) return null;
    const filters = new URLSearchParams(value);
    filters.delete('auction');
    return filters.toString();
  }
  const changingPage = listParams(loadedParams) !== listParams(params);
  const visible = changingPage ? [] : auctions;
  function open(a: Auction) {
    initialized.current = a.id;
    update({ auction: a.id }, false);
    setBid(String(a.bidderId ? a.bid + 1 : a.startPrice));
    setConfirm(false);
    bidKey.current = null;
    setMessage('');
  }
  const minimum = selected
    ? selected.bidderId
      ? selected.bid + 1
      : selected.startPrice
    : 1;
  const available = wallet + (selected?.bidderId === userId ? selected.bid : 0);
  const canBid =
    selected?.status === 'open' &&
    new Date(selected.endsAt).getTime() > now &&
    selected.sellerId !== userId;
  return (
    <div className="auction-market collector-market">
      <header className="market-intro">
        <div>
          <span className="eyebrow">ENTRE COLLECTIONNEURS</span>
          <h2>Marché aux enchères</h2>
          <p>La pièce qui manque à votre collection se trouve peut-être ici.</p>
          <div className="market-rules">
            <span>
              <Clock3 size={14} /> Ventes de 24 h
            </span>
            <span>
              <Gavel size={14} /> Sans commission
            </span>
          </div>
        </div>
        <Link href="/collection" className="primary">
          <Gavel size={16} /> Vendre depuis ma collection{' '}
          <ArrowUpRight size={16} />
        </Link>
      </header>
      <nav className="market-tabs" aria-label="Sections du marché">
        {[
          ['open', 'Toutes les enchères'],
          ['offers', 'Mes offres'],
          ['sales', 'Mes ventes'],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={view === id}
            className={view === id ? 'active' : ''}
            onClick={() => update({ view: id })}
          >
            {label}
          </button>
        ))}
      </nav>
      <section className="market-toolbar" aria-label="Filtres des enchères">
        <label className="market-search">
          <Search size={17} />
          <span className="sr-only">Rechercher une carte ou un vendeur</span>
          <input
            placeholder="Nom, version, identifiant…"
            maxLength={100}
            value={new URLSearchParams(params).get('search') ?? search}
            onChange={(e) => update({ search: e.target.value })}
          />
        </label>
        <label>
          <span>Rareté</span>
          <select
            value={rarity}
            onChange={(e) => update({ rarity: e.target.value })}
          >
            <option>Toutes</option>
            {rarities.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Finition</span>
          <select
            value={finish}
            onChange={(e) => update({ finish: e.target.value })}
          >
            <option value="all">Toutes</option>
            <option value="holo">Holographique</option>
            <option value="standard">Standard</option>
          </select>
        </label>
        <label>
          <span>Trier par</span>
          <select
            value={sort}
            onChange={(e) => update({ sort: e.target.value })}
          >
            <option value="ending">Fin imminente</option>
            <option value="newest">Nouveautés</option>
            <option value="price-low">Prix croissant</option>
            <option value="price-high">Prix décroissant</option>
          </select>
        </label>
      </section>
      {card && (
        <div className="market-results">
          <span>
            Carte recherchée ·{' '}
            {cards.find((model) => model.id === card)?.name ?? card} ·{' '}
            {cards.find((model) => model.id === card)?.version}
          </span>
          <button className="text-link" onClick={() => update({ card: '' })}>
            Retirer le filtre carte
          </button>
        </div>
      )}
      <div className="market-results">
        <span>
          {loading || changingPage
            ? 'Chargement des ventes…'
            : `${visible.length} ${visible.length > 1 ? 'enchères' : 'enchère'}`}
        </span>
        <button
          className="text-link"
          disabled={busy}
          onClick={() =>
            void load(true)
              .then(onChange)
              .catch((e) => setMessage(e.message))
          }
        >
          <RotateCw size={14} /> Actualiser
        </button>
      </div>
      <p className="market-message" role="status" aria-live="polite">
        {message}
      </p>
      <div className="market-grid">
        {visible.map((a) => {
          const card = cards.find((c) => c.id === a.copy.cardId),
            leading = a.bidderId === userId,
            urgent =
              a.status === 'open' &&
              new Date(a.endsAt).getTime() - now < 3600000;
          return (
            <article
              className={`market-lot ${leading ? 'is-leading' : ''}`}
              key={a.id}
            >
              <div className="market-lot-top">
                <span className={leading ? 'lot-status leading' : 'lot-status'}>
                  {standing(a, userId)}
                </span>
                <span className={urgent ? 'lot-time urgent' : 'lot-time'}>
                  <Clock3 size={12} />
                  {remaining(a, now)}
                </span>
              </div>
              <div
                className="market-card-button"
                role="button"
                tabIndex={0}
                aria-label={`Voir l’enchère ${card?.name ?? a.copy.cardId} · ${card?.version ?? ''}`}
                onClick={() => open(a)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    open(a);
                  }
                }}
              >
                {card && (
                  <GameCard card={card} copy={a.copy} showDetails={false} />
                )}
              </div>
              <div className="market-lot-info">
                <h3>{card?.name ?? a.copy.cardId}</h3>
                <p>
                  {card?.version} <span>· {card?.rarity}</span>
                </p>
                <div className="lot-price">
                  <div>
                    <small>
                      {a.bidderId ? 'MEILLEURE OFFRE' : 'PRIX DE DÉPART'}
                    </small>
                    <strong>
                      {money(a.bid || a.startPrice)} <span>Munny</span>
                    </strong>
                  </div>
                  <span className="lot-finish">
                    {a.copy.holo ? '✦ Holo' : 'Standard'}
                  </span>
                </div>
                <div className="lot-seller">
                  <span>{a.sellerName}</span>
                  <button onClick={() => open(a)} className="text-link">
                    Voir l’enchère <ArrowUpRight size={14} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!loading && !changingPage && !visible.length && (
        <section className="market-empty">
          <SlidersHorizontal size={28} />
          <h3>
            {auctions.length
              ? 'Aucune carte ne correspond'
              : 'La salle des ventes vous attend'}
          </h3>
          <p>
            {auctions.length
              ? 'Essayez une autre recherche ou consultez les autres onglets.'
              : 'Choisissez un exemplaire dans votre collection pour proposer la première enchère.'}
          </p>
          <Link href="/collection" className="outline">
            Ouvrir ma collection
          </Link>
        </section>
      )}
      {(page > 1 || hasNext) && (
        <nav className="market-results" aria-label="Pages du marché">
          <button
            className="outline"
            disabled={page <= 1 || busy || changingPage}
            onClick={() =>
              update({ page: String(page - 1), auction: '' }, false)
            }
          >
            Précédente
          </button>
          <span>Page {page}</span>
          <button
            className="outline"
            disabled={!hasNext || busy || changingPage}
            onClick={() =>
              update({ page: String(page + 1), auction: '' }, false)
            }
          >
            Suivante
          </button>
        </nav>
      )}
      <p className="market-footnote">
        Les mises sont réservées et remboursées automatiquement en cas de
        surenchère. Les ventes se clôturent à leur échéance, même hors ligne.
      </p>
      {selected && selectedCard && (
        <CollectorDialog
          title={`Enchère · ${selectedCard.name}`}
          busy={busy}
          onClose={() => {
            initialized.current = '';
            update({ auction: '' }, false);
            setConfirm(false);
          }}
        >
          <div className="auction-detail">
            <div className="auction-detail-card">
              <GameCard
                card={selectedCard}
                copy={selected.copy}
                showDetails={false}
              />
            </div>
            <div className="auction-detail-info">
              <span className="eyebrow">
                {selectedCard.rarity} ·{' '}
                {selected.copy.holo ? 'HOLOGRAPHIQUE' : 'STANDARD'}
              </span>
              <h2>{selectedCard.name}</h2>
              <p>{selectedCard.version}</p>
              <div className="auction-copy-stats">
                <span>
                  Niveau <b>{selected.copy.level}</b>
                </span>
                <span>
                  Éveil <b>{selected.copy.awakening}/5</b>
                </span>
                <span>{selectedCard.affinity}</span>
              </div>
              <dl className="auction-facts">
                <div>
                  <dt>Vendeur</dt>
                  <dd>{selected.sellerName}</dd>
                </div>
                <div>
                  <dt>
                    {selected.bidderId ? 'Meilleur enchérisseur' : 'Offres'}
                  </dt>
                  <dd>{selected.bidderName ?? 'Aucune pour le moment'}</dd>
                </div>
                <div>
                  <dt>Clôture</dt>
                  <dd>{new Date(selected.endsAt).toLocaleString('fr-FR')}</dd>
                </div>
              </dl>
              <p className="auction-standing">
                {standing(selected, userId)} · {remaining(selected, now)}
              </p>
              <div className="detail-price">
                <small>
                  {selected.bidderId ? 'MEILLEURE OFFRE' : 'PRIX DE DÉPART'}
                </small>
                <strong>
                  {money(selected.bid || selected.startPrice)}{' '}
                  <span>Munny</span>
                </strong>
              </div>
              <CardSales
                cardId={selected.copy.cardId}
                holo={selected.copy.holo}
              />
              {canBid && (
                <form
                  className="auction-bid-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!confirm) {
                      setConfirm(true);
                      bidKey.current = null;
                    } else
                      void action({
                        action: 'bid',
                        id: selected.id,
                        amount: Number(bid),
                      });
                  }}
                >
                  <label>
                    Votre mise en Munny
                    <input
                      required
                      type="number"
                      min={minimum}
                      max={Math.min(available, Number.MAX_SAFE_INTEGER)}
                      step="1"
                      value={bid}
                      disabled={confirm || busy}
                      onChange={(e) => setBid(e.target.value)}
                    />
                  </label>
                  <small>
                    Minimum : {money(minimum)} · Disponible pour cette offre :{' '}
                    {money(available)}
                  </small>
                  {confirm && (
                    <p className="bid-confirmation">
                      Confirmer une mise de{' '}
                      <strong>{money(Number(bid))} Munny</strong> ? Cette somme
                      sera réservée jusqu’à une surenchère ou à la clôture.
                    </p>
                  )}
                  <div className="auction-dialog-actions">
                    {confirm && (
                      <button
                        type="button"
                        className="outline"
                        disabled={busy}
                        onClick={() => {
                          setConfirm(false);
                          bidKey.current = null;
                        }}
                      >
                        Modifier
                      </button>
                    )}
                    <button
                      className="primary"
                      disabled={busy || available < minimum}
                    >
                      {busy
                        ? 'Enregistrement…'
                        : confirm
                          ? 'Confirmer mon enchère'
                          : 'Enchérir'}
                    </button>
                  </div>
                </form>
              )}
              {selected.status === 'open' &&
                selected.sellerId === userId &&
                !selected.bidderId && (
                  <button
                    className="outline"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          'Annuler cette vente et récupérer votre carte ?',
                        )
                      )
                        void action({ action: 'cancel', id: selected.id });
                    }}
                  >
                    Annuler la vente
                  </button>
                )}
              <p className="sale-notice">
                Aucune commission. La carte est livrée automatiquement au
                gagnant.
              </p>
              {message && <p role="alert">{message}</p>}
            </div>
          </div>
        </CollectorDialog>
      )}
    </div>
  );
}
