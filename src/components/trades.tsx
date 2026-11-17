'use client';
import { useEffect, useRef, useState } from 'react';
import type { Trade } from '../server/trades';
import type { Card, Copy } from '../game/core';
import TradeSelection from './trade-selection';
import { tradeStacks } from '../game/trade-stacks';
export default function Trades({
  userId,
  copies,
  cards,
  onChange,
}: {
  userId: string;
  copies: Copy[];
  cards: Card[];
  onChange: () => Promise<void>;
}) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [target, setTarget] = useState('');
  const [selection, setSelection] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const readVersion = useRef(0);
  const invitation = useRef<{ target: string; id: string } | null>(null);
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const available = new Set(copies.filter((c) => !c.locked).map((c) => c.id));
  const selected = selection.filter((id) => available.has(id));
  const statuses = {
    invited: 'Invitation',
    open: 'En cours',
    completed: 'Terminé',
    cancelled: 'Annulé',
  };
  async function load() {
    const version = ++readVersion.current;
    const r = await fetch('/api/trades');
    const data = await r.json();
    if (!r.ok)
      throw new Error(data.error ?? 'Impossible de charger les échanges');
    if (version === readVersion.current) setTrades(data);
  }
  useEffect(() => {
    const refresh = () => {
      void load().catch((e) =>
        setError(e instanceof Error ? e.message : 'Erreur réseau'),
      );
    };
    refresh();
    const timer = setInterval(() => {
      setNow(Date.now());
      refresh();
    }, 10000);
    return () => clearInterval(timer);
  }, []);
  async function searchPlayers() {
    try {
      const r = await fetch(
        `/api/players?q=${encodeURIComponent(target.trim())}`,
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Recherche impossible');
      setPlayers(data);
      setError(data.length ? '' : 'Aucun joueur trouvé');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau');
    }
  }
  async function action(action: string, trade?: Trade) {
    if (pending.current) return;
    pending.current = true;
    readVersion.current++;
    setBusy(true);
    setError('');
    const recipient = target.trim();
    if (action === 'invite' && invitation.current?.target !== recipient) {
      invitation.current = { target: recipient, id: crypto.randomUUID() };
    }
    try {
      const r = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ...(action === 'invite' ? { target: recipient } : {}),
          id: action === 'invite' ? invitation.current?.id : trade?.id,
          revision: trade?.state.revision,
          ...(action === 'offer' ? { copies: selected } : {}),
        }),
      });
      const value = await r.json();
      if (!r.ok) throw new Error(value.error);
      if (action === 'invite') invitation.current = null;
      if (action === 'offer') setSelection([]);
      try {
        await Promise.all([load(), onChange()]);
      } catch {
        setError('Action enregistrée. Actualisez pour revoir vos échanges.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Un pacte entre voyageurs</h2>
      <p>
        Votre identifiant : <code>{userId}</code>. Invitations valables 30
        minutes. Une modification annule tous les accords.
      </p>
      {error && (
        <p role="alert" className="warning">
          {error}
        </p>
      )}
      <div className="filter-row">
        <input
          aria-label="Nom ou identifiant Discord du joueur"
          placeholder="Nom ou identifiant Discord du joueur"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
        <button
          className="outline"
          disabled={busy || !/^\d{17,20}$/.test(target.trim())}
          onClick={() => void action('invite')}
        >
          Inviter
        </button>
        <button
          className="outline"
          disabled={target.trim().length < 2 || busy}
          onClick={() => void searchPlayers()}
        >
          Rechercher un joueur
        </button>
        <button
          className="outline"
          onClick={() =>
            void load().catch((e) =>
              setError(e instanceof Error ? e.message : 'Erreur réseau'),
            )
          }
        >
          Actualiser
        </button>
      </div>
      {!!players.length && (
        <div className="player-results">
          {players.map((p) => (
            <button
              key={p.id}
              className="outline"
              onClick={() => {
                setTarget(p.id);
                setPlayers([]);
              }}
            >
              {p.name} · {p.id}
            </button>
          ))}
        </div>
      )}
      <TradeSelection
        copies={copies}
        cards={cards}
        selection={selected}
        onChange={setSelection}
        busy={busy}
        onError={setError}
      />
      {trades.map((t) => (
        <div className="panel" key={t.id} style={{ marginTop: 20 }}>
          <h3>
            {t.a === userId ? (t.bName ?? t.b) : (t.aName ?? t.a)} ·{' '}
            {new Date(t.expiresAt).getTime() <= now &&
            ['open', 'invited'].includes(t.state.status)
              ? 'Expiré'
              : statuses[t.state.status]}
          </h3>
          <p>Échéance {new Date(t.expiresAt).toLocaleString('fr-FR')}</p>
          {Object.entries(t.state.offers).map(([owner, offered]) => (
            <p key={owner}>
              <strong>
                {owner === userId ? 'Votre offre' : 'Offre reçue'} :
              </strong>{' '}
              {tradeStacks(offered)
                .map((stack) => {
                  const card = cards.find((model) => model.id === stack.cardId);
                  return `${stack.copies.length} × ${card ? `${card.name} · ${card.version}` : stack.cardId} · Nv.${stack.level} · Éveil ${stack.awakening}${stack.holo ? ' · Holographique' : ''}`;
                })
                .join(', ') || 'Aucune carte'}{' '}
              {t.state.locked.includes(owner) ? ' · verrouillée' : ''}
              {t.state.confirmed.includes(owner) ? ' · confirmée' : ''}
            </p>
          ))}
          {!['completed', 'cancelled'].includes(t.state.status) &&
            new Date(t.expiresAt).getTime() > now && (
              <div className="action-row">
                {t.state.status === 'invited' && t.b === userId && (
                  <button
                    disabled={busy}
                    className="outline"
                    onClick={() => void action('accept', t)}
                  >
                    Accepter
                  </button>
                )}
                {t.state.status === 'open' && (
                  <>
                    <button
                      disabled={busy}
                      className="outline"
                      onClick={() => void action('offer', t)}
                    >
                      Proposer la sélection ({selected.length})
                    </button>
                    <button
                      disabled={
                        busy ||
                        t.state.locked.includes(userId) ||
                        !Object.values(t.state.offers).some(
                          (offer) => offer.length > 0,
                        )
                      }
                      className="outline"
                      onClick={() => void action('lock', t)}
                    >
                      Verrouiller l’offre
                    </button>
                    <button
                      disabled={
                        busy ||
                        t.state.locked.length !== 2 ||
                        t.state.confirmed.includes(userId)
                      }
                      className="primary"
                      onClick={() => void action('confirm', t)}
                    >
                      Confirmer le transfert
                    </button>
                  </>
                )}
                <button
                  disabled={busy}
                  className="outline"
                  onClick={() => void action('cancel', t)}
                >
                  Annuler
                </button>
              </div>
            )}
        </div>
      ))}
    </section>
  );
}
