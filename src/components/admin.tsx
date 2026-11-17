'use client';
import { useEffect, useRef, useState } from 'react';
import { Shield, Search, ScrollText, CalendarDays, Users } from 'lucide-react';
import CollectorDialog from './collector-dialog';
import WalletLogPanel from './wallet-log-panel';
import type { GameEvent } from '../game/events';
type Row = {
  id: string;
  name: string;
  munny: string;
  tickets: string;
  fragments: string;
  copies: number;
  moderation: { suspended: boolean; reason: string } | null;
};
type Data = {
  role: 'admin' | 'moderator';
  totals: { players: number; copies: number };
  players: Row[];
  nextCursor: string | null;
  events: GameEvent[];
  audit: {
    id: string;
    actorId: string;
    action: string;
    targetId: string;
    reason: string;
    result: unknown;
    createdAt: string;
  }[];
};
const blankEvent = {
  id: '',
  revision: 0,
  title: '',
  description: '',
  startsAt: '',
  endsAt: '',
  published: false,
};
function localDateTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : '';
}
const auditLabels: Record<string, string> = {
  'resources.adjust': 'Ajustement de ressources',
  'player.suspend': 'Suspension de compte',
  'event.save': 'Événement',
};
export default function Admin() {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(''),
    [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [q, setQ] = useState(''),
    [tab, setTab] = useState('players');
  const [selected, setSelected] = useState<Row | null>(null),
    [reason, setReason] = useState(''),
    [resource, setResource] = useState('munny'),
    [delta, setDelta] = useState('');
  const [event, setEvent] = useState(blankEvent);
  const [eventReason, setEventReason] = useState('');
  const [auditFilter, setAuditFilter] = useState('all');
  const [walletSearch, setWalletSearch] = useState('');
  const [currentCursor, setCurrentCursor] = useState('');
  const loadRevision = useRef(0);
  const actionRequest = useRef<{ body: string; key: string } | null>(null);
  const pending = useRef(false);
  async function load(cursor = '') {
    const revision = ++loadRevision.current;
    const r = await fetch(
      `/api/admin?q=${encodeURIComponent(q)}&cursor=${encodeURIComponent(cursor)}`,
      { cache: 'no-store' },
    );
    const value = await r.json();
    if (!r.ok) {
      if (r.status === 401 || r.status === 403) setData(null);
      throw new Error(value.error);
    }
    if (revision === loadRevision.current) {
      setData(value);
      setCurrentCursor(cursor);
    }
  }
  useEffect(() => {
    fetch('/api/admin', { cache: 'no-store' })
      .then(async (r) => {
        const value = await r.json();
        if (!r.ok) throw new Error(value.error);
        setData(value);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  async function send(input: Record<string, unknown>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setSuccess('');
    const request = {
      ...input,
      reason: input.action === 'event.save' ? eventReason : reason,
    };
    const serialized = JSON.stringify(request);
    if (actionRequest.current?.body !== serialized)
      actionRequest.current = { body: serialized, key: crypto.randomUUID() };
    try {
      const r = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, key: actionRequest.current.key }),
      });
      const value = await r.json();
      if (!r.ok) {
        if (r.status < 500) actionRequest.current = null;
        if (r.status === 401 || r.status === 403) setData(null);
        throw new Error(value.error);
      }
      actionRequest.current = null;
      setSelected(null);
      setReason('');
      setDelta('');
      setSuccess('Action enregistrée dans le journal d’administration.');
      if (input.action === 'event.save') {
        setEvent(blankEvent);
        setEventReason('');
      }
      try {
        await load();
      } catch {
        setError(
          'Action enregistrée, mais l’affichage n’a pas pu être actualisé. Utilisez Actualiser.',
        );
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Connexion interrompue. Vous pouvez réessayer sans modifier les champs.',
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function search(cursor = '') {
    setLoading(true);
    setError('');
    try {
      await load(cursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }
  const currentResource =
    selected?.[resource as 'munny' | 'tickets' | 'fragments'];
  const afterResource =
    currentResource &&
    /^\d+$/.test(currentResource) &&
    Number.isSafeInteger(Number(delta))
      ? BigInt(currentResource) + BigInt(Number(delta))
      : null;
  const validAdjustment =
    afterResource !== null &&
    afterResource >= 0n &&
    afterResource <= BigInt(Number.MAX_SAFE_INTEGER) &&
    Number(delta) !== 0 &&
    Math.abs(Number(delta)) <= 1000000;
  if (!data)
    return (
      <section className="panel empty">
        <Shield size={40} />
        <h2>
          {loading ? 'Vérification des accès…' : 'Administration protégée'}
        </h2>
        <p role="status">
          {error || 'Seuls les comptes autorisés peuvent accéder à cette page.'}
        </p>
      </section>
    );
  return (
    <div className="admin-console">
      <section className="panel">
        <div className="section-title">
          <h2>
            <Shield size={20} /> Administration du royaume
          </h2>
          <span className="eyebrow">
            {data.role === 'admin' ? 'ADMINISTRATEUR' : 'MODÉRATEUR'}
          </span>
        </div>
        <p>
          Actions sensibles journalisées. Aucune action sur les taux
          d’invocation depuis cette interface.
        </p>
        <div className="admin-toolbar">
          <p>
            Recherchez un joueur, vérifiez son solde puis confirmez
            l’intervention avec un motif.
          </p>
          <button
            className="outline"
            disabled={busy || loading}
            onClick={() => void search()}
          >
            Actualiser
          </button>
        </div>
        <div className="codex-totals">
          <div>
            <small>Joueurs</small>
            <strong>{data.totals.players}</strong>
          </div>
          <div>
            <small>Exemplaires</small>
            <strong>{data.totals.copies}</strong>
          </div>
          <div>
            <small>Événements enregistrés</small>
            <strong>{data.events.length}</strong>
          </div>
        </div>
        <div className="codex-controls">
          {[
            ['players', 'Joueurs', Users],
            ['events', 'Événements', CalendarDays],
            ['audit', 'Journal', ScrollText],
            ['wallet', 'Logs Munny', ScrollText],
          ].map(([id, label, Icon]) => (
            <button
              className={tab === id ? 'primary' : 'outline'}
              key={String(id)}
              onClick={() => setTab(String(id))}
            >
              <Icon size={15} />
              {String(label)}
            </button>
          ))}
        </div>
      </section>
      {error && !selected && (
        <div className="notice" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="notice" role="status">
          {success}
        </div>
      )}
      {tab === 'players' && (
        <section className="panel">
          <h2>Joueurs et modération</h2>
          <form
            className="filter-row"
            onSubmit={(e) => {
              e.preventDefault();
              void search();
            }}
          >
            <input
              aria-label="Rechercher un joueur"
              placeholder="Nom ou identifiant Discord"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              maxLength={80}
            />
            <button className="outline" disabled={loading}>
              <Search size={14} /> Rechercher
            </button>
          </form>
          {data.players.map((p) => (
            <div className="mission-row admin-player-row" key={p.id}>
              <div>
                <h3>
                  {p.name}
                  {p.moderation?.suspended ? ' · Suspendu' : ''}
                </h3>
                <p>
                  {p.id} · {p.copies} cartes · {p.munny} Munny · {p.tickets}{' '}
                  tickets · {p.fragments} fragments
                </p>
              </div>
              <button
                className="outline"
                disabled={loading || busy}
                onClick={() => {
                  setSelected(p);
                  setReason('');
                  setResource('munny');
                  setDelta('');
                }}
              >
                Gérer
              </button>
              <button
                className="outline"
                disabled={loading || busy}
                onClick={() => {
                  setWalletSearch(p.id);
                  setTab('wallet');
                }}
              >
                Logs Munny
              </button>
            </div>
          ))}
          <p className="admin-caption">
            {data.players.length} joueur(s) affiché(s) sur cette page. Recherche
            par nom ou identifiant Discord.
          </p>
          {!data.players.length && (
            <p>
              Aucun joueur trouvé. Modifiez votre recherche ou effacez le nom
              saisi.
            </p>
          )}
          {currentCursor && (
            <button
              className="outline"
              disabled={loading}
              onClick={() => void search()}
            >
              Retour à la première page
            </button>
          )}
          {data.nextCursor && (
            <button
              className="outline"
              disabled={loading}
              onClick={() => void search(data.nextCursor!)}
            >
              Page suivante
            </button>
          )}
        </section>
      )}
      {tab === 'wallet' && (
        <WalletLogPanel key={walletSearch} initialSearch={walletSearch} />
      )}
      {tab === 'events' && (
        <section className="panel">
          <h2>Calendrier des événements</h2>
          <p>
            Ces événements sont informatifs. Ils ne modifient pas les bannières,
            les chances ou les récompenses automatiquement.
          </p>
          {data.events.map((e) => (
            <div className="mission-row" key={e.id}>
              <div>
                <h3>
                  {e.title} · {e.published ? 'Publié' : 'Brouillon'}
                </h3>
                <p>
                  {new Date(e.startsAt).toLocaleString('fr-FR')} →{' '}
                  {new Date(e.endsAt).toLocaleString('fr-FR')} · version{' '}
                  {e.revision}
                </p>
              </div>
              {data.role === 'admin' && (
                <button
                  className="outline"
                  onClick={() => {
                    setEvent({
                      id: e.id,
                      revision: e.revision,
                      title: e.title,
                      description: e.description,
                      startsAt: localDateTime(e.startsAt),
                      endsAt: localDateTime(e.endsAt),
                      published: e.published,
                    });
                    setEventReason('');
                  }}
                >
                  Modifier
                </button>
              )}
            </div>
          ))}
          {data.role === 'admin' && (
            <form
              className="admin-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  !window.confirm(
                    event.published
                      ? 'Enregistrer et publier cet événement ?'
                      : 'Enregistrer ce brouillon ?',
                  )
                )
                  return;
                if (
                  new Date(event.endsAt).getTime() <=
                  new Date(event.startsAt).getTime()
                ) {
                  setError(
                    'La fin doit être postérieure au début de l’événement.',
                  );
                  return;
                }
                void send({
                  action: 'event.save',
                  ...(event.id
                    ? { id: event.id, revision: event.revision }
                    : {}),
                  title: event.title,
                  description: event.description,
                  startsAt: new Date(event.startsAt).toISOString(),
                  endsAt: new Date(event.endsAt).toISOString(),
                  published: event.published,
                });
              }}
            >
              <h3>
                {event.id ? 'Modifier l’événement' : 'Créer un événement'}
              </h3>
              <label>
                Titre
                <input
                  required
                  minLength={3}
                  maxLength={100}
                  value={event.title}
                  onChange={(e) =>
                    setEvent({ ...event, title: e.target.value })
                  }
                />
              </label>
              <label>
                Description
                <textarea
                  required
                  minLength={10}
                  maxLength={4000}
                  value={event.description}
                  onChange={(e) =>
                    setEvent({ ...event, description: e.target.value })
                  }
                />
              </label>
              <div className="admin-dates">
                <label>
                  Début (heure locale)
                  <input
                    required
                    type="datetime-local"
                    value={event.startsAt}
                    onChange={(e) =>
                      setEvent({ ...event, startsAt: e.target.value })
                    }
                  />
                </label>
                <label>
                  Fin (heure locale)
                  <input
                    required
                    type="datetime-local"
                    value={event.endsAt}
                    onChange={(e) =>
                      setEvent({ ...event, endsAt: e.target.value })
                    }
                  />
                </label>
              </div>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={event.published}
                  onChange={(e) =>
                    setEvent({ ...event, published: e.target.checked })
                  }
                />{' '}
                Visible sur le site
              </label>
              <label>
                Motif de l’intervention
                <textarea
                  required
                  minLength={8}
                  maxLength={500}
                  value={eventReason}
                  onChange={(e) => setEventReason(e.target.value)}
                />
              </label>
              <div className="action-row">
                <button className="primary" disabled={busy}>
                  Enregistrer
                </button>
                {event.id && (
                  <button
                    type="button"
                    className="outline"
                    disabled={busy}
                    onClick={() => {
                      setEvent(blankEvent);
                      setEventReason('');
                    }}
                  >
                    Nouveau brouillon
                  </button>
                )}
              </div>
            </form>
          )}
        </section>
      )}
      {tab === 'audit' && (
        <section className="panel">
          <h2>Dernières interventions</h2>
          <p>
            Les 50 dernières actions réussies, avec leur motif et leurs états
            avant/après.
          </p>
          <label className="admin-audit-filter">
            Type d’intervention
            <select
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
            >
              <option value="all">Toutes les interventions</option>
              {Object.entries(auditLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p className="admin-caption">
            Filtre sur les 50 dernières interventions chargées.
          </p>
          {data.audit
            .filter((a) => auditFilter === 'all' || a.action === auditFilter)
            .map((a) => (
              <details className="audit-entry" key={a.id}>
                <summary>
                  {auditLabels[a.action] ?? a.action} · {a.targetId} ·{' '}
                  {new Date(a.createdAt).toLocaleString('fr-FR')}
                </summary>
                <p>Acteur : {a.actorId}</p>
                <p>{a.reason}</p>
                <pre>{JSON.stringify(a.result, null, 2)}</pre>
              </details>
            ))}
          {!data.audit.filter(
            (a) => auditFilter === 'all' || a.action === auditFilter,
          ).length && <p>Aucune intervention pour ce filtre.</p>}
        </section>
      )}
      {selected && (
        <CollectorDialog
          title="Gestion du joueur"
          busy={busy}
          onClose={() => setSelected(null)}
        >
          <section className="admin-player-editor">
            <h2>{selected.name}</h2>
            <p>{selected.id}</p>
            {error && (
              <p role="alert" className="notice">
                {error}
              </p>
            )}
            <div className="admin-form">
              <label>
                Motif obligatoire
                <textarea
                  minLength={8}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              {data.role === 'admin' && (
                <>
                  <label>
                    Ressource
                    <select
                      value={resource}
                      onChange={(e) => setResource(e.target.value)}
                    >
                      <option value="munny">Munny</option>
                      <option value="tickets">Tickets</option>
                      <option value="fragments">Fragments</option>
                    </select>
                  </label>
                  <label>
                    Variation (positive ou négative)
                    <input
                      type="number"
                      step={1}
                      min={-1000000}
                      max={1000000}
                      value={delta}
                      onChange={(e) => setDelta(e.target.value)}
                    />
                  </label>
                  <div className="admin-balance-preview">
                    <span>
                      Solde actuel : {currentResource} {resource}
                    </span>
                    <strong>
                      Après ajustement :{' '}
                      {afterResource?.toLocaleString('fr-FR') ?? '—'} {resource}
                    </strong>
                    {afterResource !== null && afterResource < 0n && (
                      <p>Le solde ne peut pas devenir négatif.</p>
                    )}
                  </div>
                  <button
                    className="outline"
                    disabled={
                      busy || reason.trim().length < 8 || !validAdjustment
                    }
                    onClick={() => {
                      if (
                        window.confirm(
                          `Appliquer ${Number(delta) > 0 ? '+' : ''}${delta} ${resource} au joueur ${selected.name} ?`,
                        )
                      )
                        void send({
                          action: 'resources.adjust',
                          target: selected.id,
                          resource,
                          delta: Number(delta),
                        });
                    }}
                  >
                    Appliquer l’ajustement
                  </button>
                </>
              )}
              <button
                className="outline"
                disabled={busy || reason.trim().length < 8}
                onClick={() => {
                  if (
                    window.confirm(
                      selected.moderation?.suspended
                        ? 'Lever la suspension de ce compte ?'
                        : 'Suspendre les opérations de ce compte ?',
                    )
                  )
                    void send({
                      action: 'player.suspend',
                      target: selected.id,
                      suspended: !selected.moderation?.suspended,
                    });
                }}
              >
                {selected.moderation?.suspended
                  ? 'Lever la suspension'
                  : 'Suspendre le compte'}
              </button>
              <button
                className="outline"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                Fermer
              </button>
            </div>
          </section>
        </CollectorDialog>
      )}
    </div>
  );
}
