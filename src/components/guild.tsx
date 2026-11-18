'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Crown, Users } from 'lucide-react';
import type { Player } from '../game/core';
import { guildClaimKey, guildRules } from '../game/community';

type Overview = {
  guilds: { id: string; name: string; ownerName: string; members: number }[];
  mine: {
    id: string;
    name: string;
    ownerId: string;
    joinedAt: string;
    members: { id: string; name: string; joinedAt: string }[];
    week: { key: string; endsAt: string; boosters: number };
    previous: { key: string; boosters: number };
  } | null;
};
const fmt = (n: number) => n.toLocaleString('fr-FR');

export default function Guild({
  player,
  playerId,
  busy,
  onAction,
}: {
  player: Player;
  playerId: string;
  busy: boolean;
  onAction: (
    kind: string,
    payload: Record<string, unknown>,
  ) => Promise<unknown> | void;
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [armed, setArmed] = useState('');
  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/guilds', { cache: 'no-store' });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error ?? 'Guildes indisponibles.');
      setData(body);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Guildes indisponibles.');
    }
  }, []);
  useEffect(() => {
    // Chargement initial depuis l'API : l'état est mis à jour après la réponse.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  const run = async (kind: string, payload: Record<string, unknown> = {}) => {
    setArmed('');
    await onAction(kind, payload);
    await load();
  };
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Chargement des guildes…</p>;

  if (data.mine) {
    const g = data.mine;
    const owner = g.ownerId === playerId;
    const pct = Math.min(
      100,
      (g.week.boosters / guildRules.weeklyBoosters) * 100,
    );
    const prevDone = g.previous.boosters >= guildRules.weeklyBoosters;
    const claimed = player.claimed.includes(guildClaimKey(g.previous.key));
    return (
      <>
        <section className="panel guild-hero" aria-labelledby="guild-name">
          <span className="eyebrow">Votre guilde</span>
          <h2 id="guild-name">{g.name}</h2>
          <p>
            {g.members.length} / {guildRules.maxMembers} membres · objectif de
            la semaine : {guildRules.weeklyBoosters} boosters ouverts ensemble
            pour {fmt(guildRules.weeklyReward)} Munny chacun.
          </p>
          <div className="guild-progress">
            <div>
              <strong>{fmt(g.week.boosters)}</strong>
              <span> / {guildRules.weeklyBoosters} boosters cette semaine</span>
            </div>
            <span className="meter-track" aria-hidden="true">
              <i style={{ width: `${pct}%` }} />
            </span>
            <small>
              Fin de semaine le{' '}
              {new Date(g.week.endsAt).toLocaleString('fr-FR', {
                weekday: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </small>
          </div>
          {prevDone && (
            <div className="guild-reward">
              <span>
                Semaine précédente réussie ({fmt(g.previous.boosters)}{' '}
                boosters).
              </span>
              <button
                className={claimed ? 'outline' : 'primary'}
                disabled={busy || claimed}
                onClick={() => void run('guild-reward')}
              >
                {claimed
                  ? 'Récompense reçue'
                  : `Réclamer ${fmt(guildRules.weeklyReward)} Munny`}
              </button>
            </div>
          )}
          <p className="workshop-note">
            Seules les ouvertures faites après votre arrivée comptent. Pour
            toucher la récompense, il faut avoir rejoint la guilde au moins 72 h
            avant la fin de la semaine.
          </p>
        </section>
        <section className="panel" aria-labelledby="guild-members">
          <h2 id="guild-members">Membres</h2>
          <ul className="guild-members">
            {g.members.map((m) => (
              <li key={m.id}>
                <Link href={`/profile/${m.id}`}>{m.name}</Link>
                {m.id === g.ownerId && (
                  <span className="guild-owner">
                    <Crown size={13} aria-hidden="true" /> Chef
                  </span>
                )}
                <small>
                  depuis le {new Date(m.joinedAt).toLocaleDateString('fr-FR')}
                </small>
                {owner && m.id !== playerId && (
                  <button
                    className={armed === m.id ? 'danger' : 'outline'}
                    disabled={busy}
                    onClick={() =>
                      armed === m.id
                        ? void run('guild-kick', { playerId: m.id })
                        : setArmed(m.id)
                    }
                  >
                    {armed === m.id ? 'Confirmer' : 'Exclure'}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button
            className={armed === 'leave' ? 'danger' : 'outline'}
            disabled={busy}
            onClick={() =>
              armed === 'leave' ? void run('guild-leave') : setArmed('leave')
            }
          >
            {armed === 'leave'
              ? owner && g.members.length === 1
                ? 'Confirmer : la guilde sera dissoute'
                : 'Confirmer le départ'
              : 'Quitter la guilde'}
          </button>
          {owner && g.members.length > 1 && (
            <p className="workshop-note">
              Si vous partez, le membre le plus ancien devient chef.
            </p>
          )}
        </section>
      </>
    );
  }

  return (
    <>
      <section className="panel" aria-labelledby="guild-create">
        <h2 id="guild-create">Fonder une guilde</h2>
        <p>
          Une guilde réunit jusqu’à {guildRules.maxMembers} joueurs. Chaque
          semaine, si ses membres ouvrent {guildRules.weeklyBoosters} boosters
          ensemble, chacun reçoit {fmt(guildRules.weeklyReward)} Munny.
        </p>
        <div className="guild-form">
          <input
            aria-label="Nom de la guilde"
            placeholder="Nom de la guilde (3 à 24 caractères)"
            maxLength={24}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="primary"
            disabled={
              busy ||
              name.trim().length < 3 ||
              player.munny < guildRules.createCost
            }
            onClick={() => void run('guild-create', { name })}
          >
            Fonder pour {fmt(guildRules.createCost)} Munny
          </button>
        </div>
      </section>
      <section className="panel" aria-labelledby="guild-list">
        <h2 id="guild-list">
          <Users size={18} aria-hidden="true" /> Guildes ouvertes
        </h2>
        {data.guilds.length ? (
          <ul className="guild-list">
            {data.guilds.map((g) => (
              <li key={g.id}>
                <div>
                  <strong>{g.name}</strong>
                  <small>Chef : {g.ownerName}</small>
                </div>
                <span className="quest-summary">
                  {g.members} / {guildRules.maxMembers}
                </span>
                <button
                  className="outline"
                  disabled={busy || g.members >= guildRules.maxMembers}
                  onClick={() => void run('guild-join', { guildId: g.id })}
                >
                  {g.members >= guildRules.maxMembers
                    ? 'Complète'
                    : 'Rejoindre'}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>Aucune guilde pour l’instant. Fondez la première !</p>
        )}
      </section>
    </>
  );
}
