'use client';
import { useState } from 'react';
import type { Player } from '../game/core';
export default function PrivacySettings({
  player,
  busy,
  onSaved,
}: {
  player?: Player;
  busy: boolean;
  onSaved: () => Promise<void>;
}) {
  const [optimistic, setOptimistic] = useState<boolean | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState('');
  async function update(blocked: boolean) {
    setOptimistic(blocked);
    setPending(true);
    setError('');
    try {
      const r = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'settings',
          key: crypto.randomUUID(),
          payload: { auctionNotifications: !blocked },
        }),
      });
      const body = await r.json();
      if (!r.ok)
        throw new Error(body.error ?? 'Impossible de modifier ce réglage.');
      await onSaved();
    } catch {
      setError('Le réglage n’a pas pu être enregistré. Réessayez.');
    } finally {
      setPending(false);
      setOptimistic(null);
    }
  }
  return (
    <>
      <div className="setting-row">
        <div>
          <h3>Bloquer les messages privés du bot</h3>
          <p>
            Les notifications sur le site restent disponibles, même si les MP
            sont bloqués.
          </p>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={optimistic ?? player?.auctionNotifications === false}
            disabled={!player || busy || pending}
            onChange={(e) => void update(e.target.checked)}
          />
          <span aria-hidden="true" />
          <span className="sr-only">Bloquer les messages privés Discord</span>
        </label>
      </div>
      {pending && <p role="status">Enregistrement du réglage…</p>}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
