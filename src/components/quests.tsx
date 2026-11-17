'use client';
import { useState } from 'react';
import type { QuestStatus } from '../game/quests';

type Cycle = 'daily' | 'weekly';
const order = (q: QuestStatus) => (q.claimable ? 0 : q.claimed ? 2 : 1);

function remaining(iso: string, now: number) {
  const ms = Math.max(0, Date.parse(iso) - now);
  const hours = Math.floor(ms / 3600000);
  if (hours >= 24) return `${Math.floor(hours / 24)} j ${hours % 24} h`;
  return `${hours} h ${Math.floor((ms % 3600000) / 60000)} min`;
}

export default function Quests({
  quests,
  busy,
  now,
  onClaim,
}: {
  quests: QuestStatus[];
  busy: boolean;
  now: number;
  onClaim: (quest: QuestStatus) => void;
}) {
  const [cycle, setCycle] = useState<Cycle>('daily');
  const [showDone, setShowDone] = useState(false);
  const list = quests.filter((q) => q.cycle === cycle);
  if (!quests.length) return null;
  const claimed = list.filter((q) => q.claimed);
  const ready = list.filter((q) => q.claimable);
  const earned = claimed.reduce((sum, q) => sum + q.munny, 0);
  const total = list.reduce((sum, q) => sum + q.munny, 0);
  const shown = [...list]
    .filter((q) => showDone || !q.claimed)
    .sort(
      (a, b) =>
        order(a) - order(b) || b.progress / b.target - a.progress / a.target,
    );
  return (
    <section className="panel quests" aria-labelledby="quests-title">
      <div className="section-title">
        <h2 id="quests-title">Quêtes</h2>
        <div
          className="quest-tabs"
          role="tablist"
          aria-label="Période des quêtes"
        >
          {(['daily', 'weekly'] as const).map((c) => {
            const count = quests.filter(
              (q) => q.cycle === c && q.claimable,
            ).length;
            return (
              <button
                key={c}
                role="tab"
                aria-selected={cycle === c}
                className={cycle === c ? 'active' : ''}
                onClick={() => setCycle(c)}
              >
                {c === 'daily' ? 'Journalières' : 'Hebdomadaires'}
                {count > 0 && <span className="quest-badge">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <p className="quest-summary">
        {claimed.length} / {list.length} terminées ·{' '}
        {earned.toLocaleString('fr-FR')} / {total.toLocaleString('fr-FR')} Munny
        · renouvellement dans {list[0] ? remaining(list[0].resetsAt, now) : '—'}
      </p>
      {ready.length > 1 && (
        <p className="quest-ready" role="status">
          {ready.length} quêtes prêtes à être réclamées.
        </p>
      )}
      <ul className="quest-list">
        {shown.map((q) => (
          <li
            key={q.claimKey}
            className={q.claimed ? 'done' : q.claimable ? 'ready' : ''}
          >
            <div>
              <h3>{q.name}</h3>
              <div
                className="quest-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={q.target}
                aria-valuenow={q.progress}
                aria-label={`${q.name} : ${q.progress} sur ${q.target}`}
              >
                <i style={{ width: `${(q.progress / q.target) * 100}%` }} />
              </div>
              <small>
                {q.progress.toLocaleString('fr-FR')} /{' '}
                {q.target.toLocaleString('fr-FR')}
              </small>
            </div>
            <strong>+{q.munny.toLocaleString('fr-FR')} Munny</strong>
            <button
              className={q.claimable ? 'primary' : 'outline'}
              disabled={busy || !q.claimable}
              onClick={() => onClaim(q)}
            >
              {q.claimed ? 'Réclamée' : q.claimable ? 'Réclamer' : 'En cours'}
            </button>
          </li>
        ))}
      </ul>
      {claimed.length > 0 && (
        <button className="text-link" onClick={() => setShowDone((v) => !v)}>
          {showDone
            ? 'Masquer les quêtes terminées'
            : `Afficher les ${claimed.length} quêtes terminées`}
        </button>
      )}
    </section>
  );
}
