'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { Gavel, Check } from 'lucide-react';
import type { Copy } from '../game/core';
import CardSales from './card-sales';

export default function AuctionListing({
  copy,
  onListed,
  onBusy,
}: {
  copy: Copy;
  onListed: () => Promise<void>;
  onBusy: (value: boolean) => void;
}) {
  const [open, setOpen] = useState(false),
    [price, setPrice] = useState('1000'),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [retryLocked, setRetryLocked] = useState(false),
    [done, setDone] = useState(false);
  const key = useRef<string | null>(null),
    pending = useRef(false);
  async function sell() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setRetryLocked(true);
    onBusy(true);
    setMessage('');
    key.current ??= crypto.randomUUID();
    try {
      const r = await fetch('/api/auctions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          key: key.current,
          copyId: copy.id,
          amount: Number(price),
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (r.status < 500) {
          key.current = null;
          setRetryLocked(false);
        }
        throw new Error(data.error ?? 'Mise en vente impossible.');
      }
      setDone(true);
      await onListed();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : 'Connexion interrompue. Réessayez avec le même prix.',
      );
    } finally {
      pending.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <section className="collection-sale" aria-label="Vente de cet exemplaire">
      {done ? (
        <p>
          <Check size={16} /> Carte mise aux enchères.{' '}
          <Link href="/trade">Voir mes ventes →</Link>
        </p>
      ) : !open ? (
        <>
          <button
            className="primary"
            disabled={copy.locked}
            onClick={() => setOpen(true)}
          >
            <Gavel size={16} /> Mettre aux enchères
          </button>
          {copy.locked && <p>Déverrouillez cet exemplaire pour le vendre.</p>}
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sell();
          }}
        >
          <h3>Mettre cet exemplaire aux enchères</h3>
          <p>24 heures · Aucune commission</p>
          <CardSales cardId={copy.cardId} holo={copy.holo} />
          <label>
            Prix de départ en Munny
            <input
              type="number"
              required
              min="1"
              max={Number.MAX_SAFE_INTEGER}
              step="1"
              value={price}
              disabled={busy || retryLocked}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <p className="sale-notice">
            Cet exemplaire quittera votre collection pendant la vente. Vous
            pourrez annuler avant la première offre. Sans offre, il vous sera
            rendu.
          </p>
          <div className="auction-dialog-actions">
            <button
              type="button"
              className="outline"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                key.current = null;
                setRetryLocked(false);
              }}
            >
              Retour
            </button>
            <button className="primary" disabled={busy || copy.locked}>
              {busy ? 'Mise en vente…' : 'Confirmer la mise aux enchères'}
            </button>
          </div>
        </form>
      )}
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
