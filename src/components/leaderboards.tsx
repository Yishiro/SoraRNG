'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';

type Row = { id: string; name: string; value: number };
type Board = {
  season: {
    id: string;
    label: string;
    endsAt: string;
    rewards: number[];
    standings: { id: string; name: string; points: number }[];
  };
  previous: {
    id: string;
    label: string;
    winners: { id: string; name: string; rank: number; reward: number }[];
  } | null;
  collection: Row[];
  holos: Row[];
  codex: Row[];
};
type Tab = 'season' | 'collection' | 'holos' | 'codex';
const tabs: [Tab, string, string][] = [
  ['season', 'Saison', 'points'],
  ['collection', 'Collection', 'exemplaires'],
  ['holos', 'Holographiques', 'holos'],
  ['codex', 'Codex', 'modèles'],
];

function daysLeft(iso: string) {
  const days = Math.ceil((Date.parse(iso) - Date.now()) / 86400000);
  return days <= 1 ? 'dernier jour' : `${days} jours restants`;
}

export default function Leaderboards({ playerId }: { playerId?: string }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('season');
  useEffect(() => {
    let active = true;
    fetch('/api/leaderboards')
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok || !body?.season)
          throw new Error(body?.error ?? 'Classement indisponible');
        if (active) setBoard(body);
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!board) return <p role="status">Chargement du classement…</p>;
  const rows: (Row & { reward?: number })[] =
    tab === 'season'
      ? board.season.standings.map((s, i) => ({
          id: s.id,
          name: s.name,
          value: s.points,
          reward: board.season.rewards[i],
        }))
      : board[tab];
  const unit = tabs.find(([t]) => t === tab)![2];
  return (
    <>
      <section className="panel season-hero" aria-labelledby="season-title">
        <span className="eyebrow">Saison de {board.season.label}</span>
        <h2 id="season-title">
          <Trophy size={20} aria-hidden="true" /> Le podium du mois
        </h2>
        <p>
          Gagnez des points en ouvrant des boosters (plus la carte est rare,
          plus elle rapporte), en obtenant des holographiques, en terminant des
          quêtes, en fusionnant et en éveillant vos cartes. Le classement repart
          à zéro chaque mois, {daysLeft(board.season.endsAt)}.
        </p>
        <ol className="season-rewards">
          {board.season.rewards.map((reward, i) => (
            <li key={i}>
              <span>{i + 1}</span>
              <strong>{reward.toLocaleString('fr-FR')} Munny</strong>
            </li>
          ))}
        </ol>
        {board.previous && (
          <p className="season-previous">
            Saison de {board.previous.label} :{' '}
            {board.previous.winners
              .map((w) => `${w.rank}. ${w.name}`)
              .join(' · ')}
          </p>
        )}
      </section>
      <section className="panel" aria-label="Classements">
        <div
          className="quest-tabs"
          role="tablist"
          aria-label="Type de classement"
        >
          {tabs.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? 'active' : ''}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {rows.length ? (
          <ol className="ranking">
            {rows.map((row, i) => (
              <li key={row.id} className={row.id === playerId ? 'me' : ''}>
                <span className="ranking-place">{i + 1}</span>
                <Link href={`/profile/${row.id}`}>{row.name}</Link>
                <small>
                  {row.reward
                    ? `+${row.reward.toLocaleString('fr-FR')} Munny`
                    : ''}
                </small>
                <strong>
                  {row.value.toLocaleString('fr-FR')} {unit}
                </strong>
              </li>
            ))}
          </ol>
        ) : (
          <p>
            {tab === 'season'
              ? 'Personne n’a encore marqué de points ce mois-ci.'
              : 'Aucun joueur classé pour le moment.'}
          </p>
        )}
      </section>
    </>
  );
}
