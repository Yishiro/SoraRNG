'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import type { Card } from '../game/core';
import type { AuctionNotice } from '../server/auction-notifications';
import CollectorDialog from './collector-dialog';
type Feed = {
  unread: number;
  items: {
    id: string;
    kind: string;
    payload: AuctionNotice;
    auctionId: string;
    createdAt: string;
    readAt: string | null;
  }[];
};
const titles: Record<string, string> = {
  outbid: 'Votre offre a été dépassée',
  won: 'Vous avez remporté une carte',
  sold: 'Votre carte a été vendue',
  unsold: 'Votre carte est revenue dans votre collection',
  wishlist: 'Une carte de votre liste est en vente',
};
export default function NotificationInbox({ cards }: { cards: Card[] }) {
  const [feed, setFeed] = useState<Feed>({ unread: 0, items: [] }),
    [open, setOpen] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const reading = useRef(false),
    revision = useRef(0);
  const load = useCallback(async () => {
    if (reading.current) return;
    const version = ++revision.current;
    const r = await fetch('/api/notifications', { cache: 'no-store' }),
      data = await r.json();
    if (!r.ok) throw new Error(data.error ?? 'Notifications indisponibles.');
    if (version === revision.current) {
      setFeed(data);
      setError('');
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden)
        void load().catch(() => {
          setError('Notifications temporairement indisponibles.');
          setLoading(false);
        });
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [load]);
  async function read(id?: string) {
    if (reading.current) return;
    reading.current = true;
    revision.current++;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(id ? { id } : { all: true }),
        }),
        data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setFeed(data);
    } catch {
      setError('Impossible de marquer les notifications comme lues.');
    } finally {
      reading.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="inbox-trigger icon-button"
        aria-label={`Notifications${feed.unread ? ` · ${feed.unread} non lues` : ''}`}
        onClick={() => {
          setOpen(true);
          void load().catch(() =>
            setError('Notifications temporairement indisponibles.'),
          );
        }}
      >
        <Bell size={19} />
        {feed.unread > 0 && (
          <span>{feed.unread > 99 ? '99+' : feed.unread}</span>
        )}
      </button>
      {open && (
        <CollectorDialog
          title="Vos notifications"
          onClose={() => setOpen(false)}
          busy={busy}
        >
          <section className="notification-inbox">
            <h2>Vos notifications</h2>
            <p>
              Vos achats, ventes et remboursements restent ici même si vous
              bloquez les MP du bot.
            </p>
            <div className="inbox-toolbar">
              <span>{feed.unread} non lue(s)</span>
              <button
                className="outline"
                disabled={busy || !feed.unread}
                onClick={() => void read()}
              >
                Tout marquer comme lu
              </button>
            </div>
            {error && <p role="alert">{error}</p>}
            {loading ? (
              <p>Chargement…</p>
            ) : !feed.items.length ? (
              <div className="empty-inbox">
                <Bell size={28} />
                <h3>Vous êtes à jour</h3>
                <p>Vos prochains événements du marché apparaîtront ici.</p>
              </div>
            ) : (
              <ol>
                {feed.items.map((item) => {
                  const card = cards.find(
                      (c) => c.id === item.payload.copy.cardId,
                    ),
                    amount = item.payload.amount.toLocaleString('fr-FR');
                  return (
                    <li
                      key={item.id}
                      className={item.readAt ? 'read' : 'unread'}
                    >
                      <div>
                        <h3>{titles[item.kind] ?? 'Mise à jour du marché'}</h3>
                        <p>
                          {card?.name ?? item.payload.copy.cardId} ·{' '}
                          {card?.version} ·{' '}
                          {item.payload.copy.holo
                            ? 'Holographique'
                            : 'Standard'}
                        </p>
                        <p>
                          {item.kind === 'outbid'
                            ? `${amount} Munny remboursés.`
                            : item.kind === 'sold'
                              ? `${amount} Munny reçus.`
                              : item.kind === 'won'
                                ? `Carte ajoutée à votre collection pour ${amount} Munny.`
                                : item.kind === 'wishlist'
                                  ? `Mise de départ : ${amount} Munny.`
                                  : 'Aucune offre reçue ; votre exemplaire est de nouveau disponible.'}
                        </p>
                        <time dateTime={item.createdAt}>
                          {new Date(item.createdAt).toLocaleString('fr-FR')}
                        </time>
                        {item.auctionId && (
                          <Link
                            className="text-link"
                            href={`/trade?auction=${encodeURIComponent(item.auctionId)}`}
                            onClick={() => setOpen(false)}
                          >
                            Voir l’enchère
                          </Link>
                        )}
                      </div>
                      {!item.readAt && (
                        <button
                          className="text-link"
                          disabled={busy}
                          onClick={() => void read(item.id)}
                        >
                          Marquer comme lu
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            <div className="auction-dialog-actions">
              <Link href="/trade" className="outline">
                Ouvrir le marché
              </Link>
              <Link href="/settings" className="text-link">
                Gérer les MP Discord →
              </Link>
            </div>
            <p className="sale-notice">
              Les 50 dernières notifications sont affichées.
            </p>
          </section>
        </CollectorDialog>
      )}
    </>
  );
}
