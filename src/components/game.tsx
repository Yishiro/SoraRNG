'use client';
import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { signIn, signOut } from 'next-auth/react';
import {
  Crown,
  Sparkles,
  LayoutGrid,
  BookOpen,
  WandSparkles,
  Gavel,
  Handshake,
  Map as MapIcon,
  ShoppingBag,
  ScrollText,
  Trophy,
  Settings,
  ChevronRight,
  Gem,
  Wrench,
  Star,
  X,
  Shield,
  Compass,
  Menu,
  Search,
  RotateCcw,
} from 'lucide-react';
import type { Card, Copy, Player } from '../game/core';
import {
  collectionCopies,
  revealBaseline,
  type RevealBaseline,
} from '../game/collection-tools';
import Reveal from './reveal';
import SummonLounge from './summon-lounge';
import FinancePanel from './finance-panel';
import Wishlist from './wishlist';
import WorldBook from './world-book';
import ShowcaseEditor from './showcase-editor';
import Trades from './trades';
import BoostShop from './boost-shop';
import { summonOdds } from '../game/boosts';
import AuctionMarket from './auction-market';
import AuctionListing from './auction-listing';
import CollectorDialog from './collector-dialog';
import GameCard from './game-card';
import Codex from './codex';
import Missions from './missions';
import Admin from './admin';
import GettingStarted from './getting-started';
import CopyActions from './copy-actions';
import { getCardLegend } from '../game/card-legends';
import ListedCards from './listed-cards';
import NotificationInbox from './notification-inbox';
import RecentDrops from './recent-drops';
import DashboardWelcome from './dashboard-welcome';
import DashboardNext from './dashboard-next';
import RecentCards from './recent-cards';
import SummonRates from './summon-rates';
import ShopCounter from './shop-counter';
import SettingsPanel from './settings-panel';
import AdventureLog, { type HistoryEntry } from './adventure-log';
import SessionKeeper from './session-keeper';
import {
  restoreAction,
  saveAction,
  clearAction,
  sameAction,
  type PendingAction,
} from '../game/reliable-action';
import type { MissionStatus } from '../game/missions';
import { authMessage } from '../game/auth-messages';

const pageDescriptions: Record<string, string> = {
  worlds:
    'Complétez les pages du Carnet et affichez vos insignes sur votre profil.',
  exchanges:
    'Proposez des exemplaires à un autre joueur et confirmez chacun votre accord.',
  summon:
    'Choisissez votre booster, ouvrez le sceau et découvrez vos cinq cartes.',
  collection:
    'Retrouvez vos exemplaires, vos favoris et vos cartes holographiques.',
  codex:
    'Explorez les 150 cartes et suivez vos découvertes à travers les mondes.',
  upgrade: 'Choisissez un exemplaire pour améliorer son niveau ou son éveil.',
  trade:
    'Vendez vos cartes et enchérissez sur celles des autres collectionneurs.',
  missions: 'Consultez vos objectifs et récupérez les récompenses disponibles.',
  shop: 'Échangez vos Munny contre des tickets et des fragments.',
  leaderboards: 'Cette rubrique est en construction.',
  events: 'Cette rubrique est en construction.',
  settings: 'Adaptez les animations et gérez votre connexion.',
};
const mobileDestinations = [
  ['dashboard', 'Accueil', LayoutGrid],
  ['summon', 'Boosters', Sparkles],
  ['collection', 'Cartes', BookOpen],
  ['missions', 'Objectifs', ScrollText],
] as const;
const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .trim();

const rarityNames = [
  'Commun',
  'Rare',
  'Épique',
  'Légendaire',
  'Mythique',
  'Secret',
];
const nav = [
  ['dashboard', 'Accueil', LayoutGrid],
  ['summon', 'Boosters', Sparkles],
  ['collection', 'Ma collection', BookOpen],
  ['codex', 'Codex', Compass],
  ['upgrade', 'Progression', WandSparkles],
  ['trade', 'Marché', Gavel],
  ['exchanges', 'Échanges directs', Handshake],
  ['worlds', 'Carnet des mondes', MapIcon],
  ['shop', 'Boutique', ShoppingBag],
  ['missions', 'Missions', ScrollText],
  ['leaderboards', 'Classements', Trophy],
  ['events', 'Événements', Star],
  ['settings', 'Paramètres', Settings],
] as const;
type Snapshot = {
  id: string;
  name: string;
  state: Player;
  cards: Card[];
  missions?: MissionStatus[];
  staffRole?: 'admin' | 'moderator' | 'player';
  history: HistoryEntry[];
};
export default function Game({ section }: { section: string }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [publicCards, setPublicCards] = useState<Card[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const busy =
    sending || Boolean(pendingAction && pendingAction.playerId === data?.id);
  const submitting = useRef(false);
  const snapshotVersion = useRef(0);
  const [search, setSearch] = useState('');
  const [rarity, setRarity] = useState('Toutes');
  const [holo, setHolo] = useState(false);
  const [favorites, setFavorites] = useState(false);
  const [sort, setSort] = useState('name');
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [moreFilters, setMoreFilters] = useState(false);
  const [minLevel, setMinLevel] = useState(1);
  const [minAwakening, setMinAwakening] = useState(0);
  const [groupCharacters, setGroupCharacters] = useState(false);
  const [collectionDetails, setCollectionDetails] = useState(false);
  const [openingBaseline, setOpeningBaseline] = useState<RevealBaseline>({
    discoveries: [],
    owned: {},
  });
  const [mobile, setMobile] = useState(false);
  const [reveal, setReveal] = useState<Copy[]>([]);
  const [demoReveal, setDemoReveal] = useState(false);
  const [revealTone, setRevealTone] = useState<'gold' | 'violet' | 'silver'>(
    'gold',
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [providers, setProviders] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const menu = document.getElementById('game-navigation');
    const focusTimer = setTimeout(
      () => menu?.querySelector<HTMLElement>('a,button')?.focus(),
      0,
    );
    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobile(false);
      }
      if (event.key !== 'Tab') return;
      const items = Array.from(
        menu?.querySelectorAll<HTMLElement>(
          'a[href],button:not(:disabled),summary',
        ) ?? [],
      ).filter((item) => item.getClientRects().length > 0);
      if (!items?.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !menu?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !menu?.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    }
    function resize() {
      if (window.innerWidth > 700) setMobile(false);
    }
    document.addEventListener('keydown', keyboard);
    window.addEventListener('resize', resize);
    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keyboard);
      window.removeEventListener('resize', resize);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [mobile]);
  async function refresh(force = false, quiet = false) {
    const version = ++snapshotVersion.current;
    const res = await fetch('/api/game');
    const body = await res.json();
    if (version !== snapshotVersion.current || (submitting.current && !force))
      return;
    if (res.ok) setData(body);
    else if (res.status === 401 || res.status === 403) {
      setData(null);
      setSelected(null);
      setReveal([]);
      if (!quiet)
        setMessage(
          res.status === 401 ? authMessage('SessionRequired') : body.error,
        );
    }
  }
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const initialSync = setTimeout(() => {
      setNow(Date.now());
      try {
        setCollectionDetails(
          localStorage.getItem('sorarng.collection-details') === 'true',
        );
      } catch {}
      void refresh(false, true).catch(() => {});
    }, 0);
    void fetch('/api/auth/providers')
      .then((r) => r.json())
      .then((p) => setProviders(Boolean(p.discord)))
      .catch(() => {});
    void fetch('/api/catalog')
      .then(async (r) => {
        if (r.ok) setPublicCards((await r.json()).cards);
      })
      .catch(() => {});
    const sync = () => {
      if (document.visibilityState === 'visible' && !submitting.current)
        void refresh(false, true).catch(() => {});
    };
    const syncTimer = setInterval(sync, 15000);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      clearInterval(timer);
      clearTimeout(initialSync);
      clearInterval(syncTimer);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);
  useEffect(() => {
    const timer = setTimeout(
      () => setPendingAction(data?.id ? restoreAction(data.id) : null),
      0,
    );
    return () => clearTimeout(timer);
  }, [data?.id]);
  async function perform(request: PendingAction) {
    if (submitting.current || request.playerId !== data?.id) return;
    submitting.current = true;
    snapshotVersion.current++;
    setBusy(true);
    setMessage('');
    saveAction(request);
    setPendingAction(request);
    let uncertain = true;
    try {
      const response = await fetch(request.path, {
        signal: AbortSignal.timeout(15000),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: request.key,
          kind: request.kind,
          payload: request.payload,
        }),
      });
      if (
        response.status >= 400 &&
        response.status < 500 &&
        ![401, 403].includes(response.status)
      ) {
        uncertain = false;
        clearAction(request);
        setPendingAction(null);
      }
      const result = await response.json();
      if ([401, 403].includes(response.status)) {
        uncertain = false;
        setData(null);
        setSelected(null);
        setReveal([]);
        throw new Error(
          response.status === 401
            ? authMessage('SessionRequired')
            : result.error,
        );
      }
      if (!response.ok)
        throw new Error(result.error ?? 'Réponse serveur indisponible.');
      uncertain = false;
      clearAction(request);
      setPendingAction(null);
      if (result.copies) {
        setOpeningBaseline(request.baseline ?? { discoveries: [], owned: {} });
        setDemoReveal(false);
        setRevealTone(request.payload.mode === 'multi' ? 'violet' : 'gold');
        setReveal(result.copies);
      } else if (request.path === '/api/economy') {
        setMessage(
          request.kind === 'bonus'
            ? `${result.amount.toLocaleString('fr-FR')} Munny récupérés.`
            : `${result.amount.toLocaleString('fr-FR')} Munny ${request.kind === 'deposit' ? 'déposés à la banque' : 'retirés de la banque'}. Disponible : ${result.wallet.toLocaleString('fr-FR')} Munny · Épargne : ${BigInt(result.bank).toLocaleString('fr-FR')} Munny.`,
        );
      } else setMessage('Votre progression a été enregistrée.');
      try {
        await refresh(true);
      } catch {
        setMessage(
          'Opération enregistrée. L’affichage n’a pas pu être actualisé ; actualisez la page pour retrouver votre solde.',
        );
      }
    } catch (error) {
      setMessage(
        uncertain
          ? 'La réponse n’a pas pu être confirmée. Utilisez « Reprendre l’opération » pour retrouver son résultat.'
          : error instanceof Error
            ? error.message
            : 'Connexion interrompue. Reprenez l’opération en attente pour vérifier son résultat.',
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  async function requestAction(
    path: PendingAction['path'],
    kind: string,
    payload: Record<string, unknown>,
  ) {
    if (!data || submitting.current) return;
    const existing =
      restoreAction(data.id) ??
      (pendingAction?.playerId === data.id ? pendingAction : null);
    if (existing) {
      setPendingAction(existing);
      if (sameAction(existing, { path, kind, payload }))
        await perform(existing);
      else
        setMessage(
          'Reprenez d’abord l’opération en attente pour confirmer son résultat.',
        );
      return;
    }
    await perform({
      playerId: data.id,
      key: crypto.randomUUID(),
      path,
      kind,
      payload,
      ...(kind === 'summon'
        ? {
            baseline: revealBaseline(
              data.state.copies,
              data.state.discoveries ?? data.state.copies.map((c) => c.cardId),
            ),
          }
        : {}),
    });
  }
  async function act(kind: string, payload: Record<string, unknown> = {}) {
    await requestAction('/api/game', kind, payload);
  }
  const player = data?.state;
  const openingOdds = summonOdds(player?.boost, now);
  async function financeAction(kind: string, payload: Record<string, unknown>) {
    await requestAction('/api/economy', kind, payload);
  }
  const cards = data?.cards ?? publicCards;
  const discovered = new Set(
    player?.discoveries ?? player?.copies.map((c) => c.cardId),
  ).size;
  const active = nav.find((n) => n[0] === section);
  const eligibleCopies = collectionCopies(player?.copies ?? [], {
    holo,
    favorites,
    duplicates: duplicatesOnly,
    minLevel,
    minAwakening,
  });
  const filtered = cards
    .filter(
      (c) =>
        normalizeSearch(`${c.name} ${c.version} ${c.id}`).includes(
          normalizeSearch(search),
        ) &&
        (rarity === 'Toutes' || c.rarity === rarity) &&
        eligibleCopies.some((copy) => copy.cardId === c.id),
    )
    .sort((a, b) =>
      sort === 'rarity'
        ? rarityNames.indexOf(b.rarity) - rarityNames.indexOf(a.rarity)
        : a.name.localeCompare(b.name, 'fr'),
    );
  const hasFilters = Boolean(
    search ||
    rarity !== 'Toutes' ||
    holo ||
    favorites ||
    duplicatesOnly ||
    minLevel !== 1 ||
    minAwakening !== 0 ||
    groupCharacters,
  );
  const visibleCopies = eligibleCopies.filter((copy) =>
    filtered.some((card) => card.id === copy.cardId),
  ).length;
  function resetFilters() {
    setSearch('');
    setRarity('Toutes');
    setHolo(false);
    setFavorites(false);
    setSort('name');
    setDuplicatesOnly(false);
    setMinLevel(1);
    setMinAwakening(0);
    setGroupCharacters(false);
  }
  const selectedCopy = player?.copies.find((c) => c.id === selected);
  function cardView(card: Card, copy?: Copy, quantity = 1) {
    return (
      <GameCard
        key={copy?.id ?? card.id}
        card={card}
        copy={copy}
        quantity={quantity}
        onManage={setSelected}
        showDetails={section !== 'collection' || collectionDetails}
      />
    );
  }
  function collectionTiles(models: Card[]) {
    return models.flatMap((card) => {
      const groups = new Map<string, Copy[]>();
      for (const copy of eligibleCopies.filter((c) => c.cardId === card.id)) {
        const key = [
          copy.holo,
          copy.level,
          copy.awakening,
          copy.locked,
          copy.favorite,
        ].join(':');
        groups.set(key, [...(groups.get(key) ?? []), copy]);
      }
      return [...groups.values()].map((group) =>
        cardView(card, group[0], group.length),
      );
    });
  }
  useEffect(() => {
    if (section !== 'collection') return;
    const id = new URLSearchParams(window.location.search).get('copy');
    if (!id || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return;
    const timer = setTimeout(() => setSelected(id), 0);
    return () => clearTimeout(timer);
  }, [section]);
  return (
    <div
      className={`app-shell card-club ${player ? 'is-connected' : ''}`}
      data-reduced={player?.reducedMotion}
    >
      <a href="#main-content" className="skip-to-content">
        Aller au contenu
      </a>
      <aside
        id="game-navigation"
        className={mobile ? 'sidebar open' : 'sidebar'}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setMobile(false);
        }}
      >
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            SR
          </span>
          <span>
            SORA<span className="brand-light">RNG</span>
            <small>COLLECTION DE CARTES</small>
          </span>
        </Link>
        <div className="nav-label">NAVIGATION</div>
        <nav>
          {nav
            .filter(([url]) => !['leaderboards', 'events'].includes(url))
            .map(([url, label, Icon]) => (
              <Link
                onClick={() => setMobile(false)}
                className={section === url ? 'active' : ''}
                href={`/${url}`}
                aria-current={section === url ? 'page' : undefined}
                key={url}
              >
                <Icon size={19} aria-hidden="true" />
                {label}
                {section === url && (
                  <span className="active-dot" aria-hidden="true" />
                )}
              </Link>
            ))}
          <details
            className="upcoming-nav"
            open={['leaderboards', 'events'].includes(section)}
          >
            <summary>Prochainement</summary>
            {nav
              .filter(([url]) => ['leaderboards', 'events'].includes(url))
              .map(([url, label, Icon]) => (
                <Link
                  key={url}
                  href={`/${url}`}
                  onClick={() => setMobile(false)}
                  aria-current={section === url ? 'page' : undefined}
                >
                  <Icon size={17} />
                  {label}
                  <small>En construction</small>
                </Link>
              ))}
          </details>
          {data?.staffRole && data.staffRole !== 'player' && (
            <Link
              onClick={() => setMobile(false)}
              className={section === 'admin' ? 'active' : ''}
              href="/admin"
            >
              <Shield size={19} /> Administration
            </Link>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="world-status">
            SoraRNG <span>Édition 01</span>
          </div>
          <p>
            Un projet de fans indépendant.
            <br />
            Collectionnez, découvrez, échangez.
          </p>
        </div>
      </aside>
      {mobile && (
        <button
          className="navigation-backdrop"
          aria-label="Fermer la navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell">
        <SessionKeeper />
        <header>
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              onClick={() => setMobile(!mobile)}
              aria-label="Navigation"
              aria-controls="game-navigation"
              aria-expanded={mobile}
            >
              <Menu />
            </button>
            <span>SoraRNG</span>
            <ChevronRight size={14} />
            <strong>{active?.[1] ?? 'Administration'}</strong>
          </div>
          <div className="header-right">
            {data && <NotificationInbox key={data.id} cards={data.cards} />}
            <span className="currency">
              <Gem size={16} />
              {player ? player.munny.toLocaleString('fr-FR') : '—'}{' '}
              <small>Munny</small>
            </span>
            <button
              className="avatar"
              onClick={() =>
                data
                  ? void signOut()
                  : providers
                    ? void signIn('discord')
                    : setMessage(
                        'La connexion Discord est momentanément indisponible. Réessayez plus tard.',
                      )
              }
              aria-label={data ? 'Déconnexion' : 'Connexion Discord'}
            >
              {data ? data.name.slice(0, 2).toUpperCase() : '✦'}
            </button>
          </div>
        </header>
        <RecentDrops
          hidden={reveal.length > 0}
          reducedMotion={player?.reducedMotion}
        />
        <main id="main-content" tabIndex={-1}>
          {!(section === 'dashboard' && player) && section !== 'summon' && (
            <div className="page-heading">
              <div>
                <h1>
                  {section === 'dashboard'
                    ? 'Collection Kingdom Hearts'
                    : (active?.[1] ?? 'Administration')}
                </h1>
                <p>
                  {section === 'dashboard'
                    ? 'Découvrez les cartes et commencez votre collection avec Discord.'
                    : (pageDescriptions[section] ??
                      'Gérez votre aventure dans le royaume.')}
                </p>
              </div>
            </div>
          )}
          {pendingAction &&
            pendingAction.playerId === data?.id &&
            !sending &&
            !selectedCopy && (
              <div className="notice pending-action" role="alert">
                <div>
                  <strong>Une opération attend confirmation</strong>
                  <p>
                    La réponse a été interrompue. Reprenez la même opération :
                    si elle a déjà abouti, son résultat sera retrouvé sans
                    nouveau débit.
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => void perform(pendingAction)}
                >
                  Reprendre l’opération
                </button>
              </div>
            )}
          {message && (
            <div className="notice" role="status">
              {message}
              <button
                className="icon-button"
                onClick={() => setMessage('')}
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!data && section !== 'dashboard' && (
            <div className="connect-banner">
              <span>
                <Shield size={17} /> Votre aventure est sauvegardée avec votre
                compte Discord.
              </span>
              <button
                disabled={!providers}
                onClick={() => void signIn('discord')}
              >
                {providers ? 'Connecter Discord' : 'Connexion indisponible'}{' '}
                <ChevronRight size={14} />
              </button>
            </div>
          )}
          {section === 'dashboard' && (
            <>
              <DashboardWelcome
                player={player}
                name={data?.name}
                discovered={discovered}
              />
              <GettingStarted
                player={player}
                now={now}
                busy={busy}
                canConnect={providers}
                onConnect={() => void signIn('discord')}
                onClaim={() => void act('daily')}
              />
            </>
          )}
          {section === 'dashboard' && player && (
            <RecentCards player={player} cards={cards} />
          )}
          {section === 'dashboard' && player && (
            <div id="wallet">
              <FinancePanel
                player={player}
                now={now}
                busy={busy}
                onAction={(kind, payload) => void financeAction(kind, payload)}
              />
            </div>
          )}
          {section === 'summon' && (
            <SummonLounge
              player={player}
              odds={openingOdds}
              now={now}
              busy={sending}
              pending={Boolean(
                pendingAction && pendingAction.playerId === data?.id,
              )}
              ready={cards.length === 150}
              onSummon={(mode) => void act('summon', { mode })}
            />
          )}
          {section === 'summon' && (
            <SummonRates cards={cards} odds={openingOdds} />
          )}
          {section === 'dashboard' && player && (
            <DashboardNext
              player={player}
              busy={busy}
              now={now}
              onDaily={() => void act('daily')}
            />
          )}
          {section === 'codex' && (
            <>
              {player && (
                <>
                  <Link className="text-link" href={`/profile/${data?.id}`}>
                    Voir mon profil collectionneur ↗
                  </Link>
                  <Wishlist
                    cards={cards}
                    player={player}
                    busy={busy}
                    onChange={(cardId, wanted) =>
                      void act('wishlist', { cardId, wanted })
                    }
                  />
                </>
              )}
              <Codex cards={cards} player={player} />
            </>
          )}
          {section === 'worlds' && <WorldBook cards={cards} player={player} />}
          {section === 'exchanges' &&
            (data ? (
              <Trades
                userId={data.id}
                copies={data.state.copies}
                cards={cards}
                onChange={() => refresh(true)}
              />
            ) : (
              <p>Connectez-vous avec Discord pour proposer un échange.</p>
            ))}
          {section === 'collection' && player && (
            <ShowcaseEditor
              key={JSON.stringify(player.showcase ?? null)}
              player={player}
              cards={cards}
              busy={busy}
              onSave={(copies) => void act('showcase', { copies })}
            />
          )}
          {section === 'collection' && data && (
            <ListedCards
              key={data.id}
              cards={cards}
              copyCount={data.state.copies.length}
            />
          )}
          {(section === 'collection' || section === 'upgrade') && (
            <section className="panel">
              {player && (
                <div
                  className="collection-overview"
                  aria-label="Résumé de la collection"
                >
                  <div>
                    <span>Modèles possédés</span>
                    <strong>
                      {new Set(player.copies.map((copy) => copy.cardId)).size}
                      <small> / 150</small>
                    </strong>
                  </div>
                  <div>
                    <span>Holographiques</span>
                    <strong>
                      {player.copies.filter((copy) => copy.holo).length}
                    </strong>
                  </div>
                  <div>
                    <span>Doublons</span>
                    <strong>
                      {player.copies.length -
                        new Set(player.copies.map((copy) => copy.cardId)).size}
                    </strong>
                  </div>
                  <div>
                    <span>Favoris</span>
                    <strong>
                      {player.copies.filter((copy) => copy.favorite).length}
                    </strong>
                  </div>
                </div>
              )}
              <div className="filter-row">
                <div className="collection-search">
                  <Search size={17} aria-hidden="true" />
                  <input
                    aria-label="Rechercher une carte"
                    placeholder="Nom, version ou identifiant…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      className="icon-button"
                      aria-label="Effacer la recherche"
                      onClick={() => setSearch('')}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
                <select
                  aria-label="Rareté"
                  value={rarity}
                  onChange={(e) => setRarity(e.target.value)}
                >
                  {['Toutes', ...rarityNames].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
                <label>
                  <input
                    type="checkbox"
                    checked={holo}
                    onChange={(e) => setHolo(e.target.checked)}
                  />{' '}
                  Holographiques
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={favorites}
                    onChange={(e) => setFavorites(e.target.checked)}
                  />{' '}
                  Favoris
                </label>
                <select
                  aria-label="Trier les cartes"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="name">Nom</option>
                  <option value="rarity">Rareté</option>
                </select>
              </div>
              <details
                className="collection-more"
                open={moreFilters}
                onToggle={(event) => setMoreFilters(event.currentTarget.open)}
              >
                <summary>Plus de filtres et d’options</summary>
                <label className="collection-density">
                  <input
                    type="checkbox"
                    checked={collectionDetails}
                    onChange={(event) => {
                      setCollectionDetails(event.target.checked);
                      try {
                        localStorage.setItem(
                          'sorarng.collection-details',
                          String(event.target.checked),
                        );
                      } catch {}
                    }}
                  />{' '}
                  Afficher les légendes dans la grille
                </label>
                <div className="advanced-collection-filters">
                  <label>
                    <input
                      type="checkbox"
                      checked={duplicatesOnly}
                      onChange={(e) => setDuplicatesOnly(e.target.checked)}
                    />{' '}
                    Doublons uniquement
                  </label>
                  <label>
                    Niveau minimum
                    <input
                      type="number"
                      min="1"
                      max="70"
                      value={minLevel}
                      onChange={(e) =>
                        setMinLevel(
                          Math.max(
                            1,
                            Math.min(70, Number(e.target.value) || 1),
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Éveil minimum
                    <select
                      value={minAwakening}
                      onChange={(e) => setMinAwakening(Number(e.target.value))}
                    >
                      {[0, 1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n === 0 ? 'Tous les éveils' : `Éveil ${n} et plus`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Affichage
                    <select
                      value={groupCharacters ? 'character' : 'grid'}
                      onChange={(e) =>
                        setGroupCharacters(e.target.value === 'character')
                      }
                    >
                      <option value="grid">Grille de cartes</option>
                      <option value="character">Par personnage ou nom</option>
                    </select>
                  </label>
                </div>
                <p className="collection-filter-help">
                  Les doublons sont les modèles possédés plusieurs fois dans
                  l’inventaire disponible, toutes finitions confondues. Les
                  filtres s’appliquent aux exemplaires.
                </p>
              </details>
              <div className="collection-results">
                <p role="status">
                  {filtered.length} modèle{filtered.length > 1 ? 's' : ''} ·{' '}
                  {visibleCopies} exemplaire{visibleCopies > 1 ? 's' : ''}{' '}
                  affiché{visibleCopies > 1 ? 's' : ''}
                </p>
                {hasFilters && (
                  <button className="text-link" onClick={resetFilters}>
                    <RotateCcw size={13} /> Réinitialiser les filtres
                  </button>
                )}
              </div>
              {groupCharacters ? (
                <div className="character-groups">
                  {[...new Set(filtered.map((c) => c.name))].map((name) => (
                    <section key={name}>
                      <h3>
                        {name}{' '}
                        <small>
                          {filtered.filter((c) => c.name === name).length}{' '}
                          modèle(s)
                        </small>
                      </h3>
                      <div className="cards-grid">
                        {collectionTiles(
                          filtered.filter((c) => c.name === name),
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="cards-grid">{collectionTiles(filtered)}</div>
              )}
              {!filtered.length && (
                <div className="empty">
                  <BookOpen size={48} strokeWidth={1} />
                  <h2>
                    {hasFilters
                      ? 'Aucune carte ne correspond'
                      : cards.length
                        ? player
                          ? 'Aucun exemplaire disponible'
                          : 'Retrouvez votre collection'
                        : 'Le Codex attend ses premières pages'}
                  </h2>
                  <p>
                    {hasFilters
                      ? 'Essayez un autre nom ou retirez un filtre pour retrouver vos cartes.'
                      : cards.length
                        ? player
                          ? 'Vos cartes aux enchères sont présentées au-dessus. Ouvrez un booster pour enrichir votre collection.'
                          : 'Connectez votre compte Discord pour retrouver vos cartes et vos ventes.'
                        : 'Le fichier catalogue de 150 cartes est nécessaire pour ouvrir les invocations et explorer les modèles.'}
                  </p>
                  {hasFilters && (
                    <button className="outline" onClick={resetFilters}>
                      <RotateCcw size={15} /> Effacer les filtres
                    </button>
                  )}
                  <Link className="outline" href="/summon">
                    Voir les invocations <ChevronRight size={15} />
                  </Link>
                </div>
              )}
            </section>
          )}
          {section === 'shop' && (
            <ShopCounter
              player={player}
              busy={busy}
              onBuy={(item) => void act('shop', { item })}
            />
          )}
          {section === 'shop' && (
            <BoostShop
              player={player}
              busy={busy}
              now={now}
              onBuy={(kind) => void act('shop', { item: `boost-${kind}` })}
            />
          )}
          {section === 'missions' && (
            <Missions
              player={player}
              missions={data?.missions ?? []}
              busy={busy}
              onDaily={() => void act('daily')}
              dayKey={new Date(now).toISOString().slice(0, 10)}
              now={now}
              onClaim={(id) => void act('mission', { mission: id })}
            />
          )}
          {section === 'settings' && (
            <SettingsPanel
              player={player}
              busy={busy}
              signedIn={Boolean(data)}
              onSaved={() => refresh(true)}
              onToggleMotion={() =>
                void act('settings', { reducedMotion: !player?.reducedMotion })
              }
            />
          )}
          {section === 'trade' &&
            (player && data ? (
              <Suspense fallback={<p>Chargement du marché…</p>}>
                <AuctionMarket
                  userId={data.id}
                  wallet={player.munny}
                  cards={cards}
                  onChange={() => refresh(true)}
                />
              </Suspense>
            ) : (
              <section className="panel">
                <h2>Marché aux enchères</h2>
                <p>
                  Connectez-vous avec Discord pour vendre vos cartes ou
                  enchérir.
                </p>
                <button
                  className="primary"
                  onClick={() => void signIn('discord')}
                >
                  Se connecter avec Discord
                </button>
              </section>
            ))}
          {['leaderboards', 'events'].includes(section) && (
            <section
              className="panel feature-in-progress"
              aria-labelledby="construction-title"
            >
              <Wrench size={30} strokeWidth={1.2} aria-hidden="true" />
              <h2 id="construction-title">En construction</h2>
              <p>
                La rubrique {active?.[1]?.toLocaleLowerCase('fr')} sera
                disponible prochainement.
              </p>
              <Link href="/dashboard" className="outline">
                Retour à l’Accueil <ChevronRight size={15} />
              </Link>
            </section>
          )}
          {section === 'admin' && <Admin />}
          {data && section === 'dashboard' && (
            <AdventureLog
              history={data.history}
              onReplay={(copies) => {
                setRevealTone(copies.length > 1 ? 'violet' : 'gold');
                setDemoReveal(false);
                setReveal(copies);
              }}
            />
          )}
          <footer>
            <span>
              <Crown size={14} /> SORARNG <small>· Collection de cartes.</small>
            </span>
            <span>Collection indépendante · Aucun achat réel</span>
          </footer>
        </main>
      </div>
      <nav className="mobile-dock" aria-label="Navigation rapide">
        {mobileDestinations.map(([url, label, Icon]) => (
          <Link
            key={url}
            href={`/${url}`}
            aria-current={section === url ? 'page' : undefined}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
        <button
          onClick={() => setMobile(true)}
          aria-label="Tous les menus"
          aria-controls="game-navigation"
          aria-expanded={mobile}
        >
          <Menu size={20} />
          <span>Plus</span>
        </button>
      </nav>
      {selectedCopy && (
        <CollectorDialog
          title={`Exemplaire · ${cards.find((c) => c.id === selectedCopy.cardId)?.name}`}
          busy={sending}
          onClose={() => setSelected(null)}
        >
          {pendingAction && pendingAction.playerId === data?.id && !sending && (
            <div className="notice pending-action" role="alert">
              <p>
                La réponse de cette opération est incertaine. Retrouvez son
                résultat avant de modifier cet exemplaire.
              </p>
              <button
                className="primary"
                onClick={() => void perform(pendingAction)}
              >
                Reprendre l’opération
              </button>
            </div>
          )}
          <div className="collection-detail">
            <div className="collection-detail-card">
              {cards.find((c) => c.id === selectedCopy.cardId) && (
                <GameCard
                  card={cards.find((c) => c.id === selectedCopy.cardId)!}
                  copy={selectedCopy}
                  showDetails={false}
                />
              )}
            </div>
            <section className="collection-detail-info">
              <h2>{cards.find((c) => c.id === selectedCopy.cardId)?.name}</h2>
              <p>
                Niveau {selectedCopy.level} · Éveil {selectedCopy.awakening}/5 ·{' '}
                {selectedCopy.holo ? 'Holographique' : 'Standard'}
              </p>
              <small>Exemplaire {selectedCopy.id}</small>
              {getCardLegend(selectedCopy.cardId) && (
                <p className="detail-legend">
                  {getCardLegend(selectedCopy.cardId)}
                </p>
              )}
              <CopyActions
                copy={selectedCopy}
                maxLevel={
                  cards.find((c) => c.id === selectedCopy.cardId)?.maxLevel ??
                  selectedCopy.level
                }
                busy={busy}
                onAction={(kind, payload) => void act(kind, payload)}
              />
              {section === 'collection' && !pendingAction && (
                <AuctionListing
                  key={selectedCopy.id}
                  copy={selectedCopy}
                  onBusy={setBusy}
                  onListed={async () => {
                    setMessage(
                      'Votre carte est mise aux enchères pour 24 heures.',
                    );
                    await refresh(true);
                    setSelected(null);
                  }}
                />
              )}
            </section>
          </div>
        </CollectorDialog>
      )}
      {reveal.length > 0 && (
        <Reveal
          copies={reveal}
          baseline={openingBaseline}
          cards={cards}
          reduced={player?.reducedMotion ?? false}
          tone={revealTone}
          demo={demoReveal}
          onClose={() => setReveal([])}
        />
      )}
    </div>
  );
}
