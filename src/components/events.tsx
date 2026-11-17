'use client';
import { useEffect, useState } from 'react';
import { CalendarDays, Sparkles } from 'lucide-react';
import { eventStatus, type GameEvent } from '../game/events';
export default function Events() {
  const [events, setEvents] = useState<GameEvent[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [now, setNow] = useState(0),
    [filter, setFilter] = useState('active');
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    fetch('/api/events', { cache: 'no-store' })
      .then(async (r) => {
        const value = await r.json();
        if (!r.ok) throw new Error(value.error);
        setEvents(value);
        setNow(Date.now());
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    return () => clearInterval(timer);
  }, []);
  const filtered = events.filter((e) => eventStatus(e, now) === filter);
  return (
    <>
      <section className="panel">
        <h2>Les chroniques du royaume</h2>
        <p>
          Le calendrier des rendez-vous publiés par l’équipe. Les dates sont
          affichées dans votre fuseau horaire.
        </p>
        <div className="codex-controls">
          {[
            ['active', 'En cours'],
            ['upcoming', 'À venir'],
            ['ended', 'Archives'],
          ].map(([id, label]) => (
            <button
              key={id}
              className={filter === id ? 'primary' : 'outline'}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      {error ? (
        <section className="panel">
          <p role="alert">{error}</p>
        </section>
      ) : loading ? (
        <section className="panel">
          <p role="status">Chargement du calendrier…</p>
        </section>
      ) : filtered.length ? (
        filtered.map((e) => (
          <section className="panel event-card" key={e.id}>
            <span className="eyebrow">
              <Sparkles size={14} />
              {filter === 'active'
                ? 'ÉVÉNEMENT ACTIF'
                : filter === 'upcoming'
                  ? 'PROCHAINEMENT'
                  : 'ÉVÉNEMENT TERMINÉ'}
            </span>
            <h2>{e.title}</h2>
            <p className="event-description">{e.description}</p>
            <p>
              <CalendarDays size={14} />{' '}
              {new Date(e.startsAt).toLocaleString('fr-FR')} →{' '}
              {new Date(e.endsAt).toLocaleString('fr-FR')}
            </p>
          </section>
        ))
      ) : (
        <section className="panel empty">
          <CalendarDays size={45} />
          <h2>
            {filter === 'active'
              ? 'Aucun événement en cours'
              : filter === 'upcoming'
                ? 'Aucun événement annoncé'
                : 'Aucun événement archivé'}
          </h2>
          <p>
            Les rendez-vous apparaîtront ici lorsqu’ils seront publiés par
            l’équipe.
          </p>
        </section>
      )}
    </>
  );
}
