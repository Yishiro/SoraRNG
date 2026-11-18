'use client';
import { Award } from 'lucide-react';
import type { Player } from '../game/core';
import { codexRewardStatus } from '../game/codex-rewards';

export default function CodexRewards({
  player,
  busy,
  onClaim,
}: {
  player: Player;
  busy: boolean;
  onClaim: (milestone: string) => void;
}) {
  const milestones = codexRewardStatus(player);
  return (
    <section className="panel codex-rewards" aria-labelledby="codex-rewards">
      <div className="section-title">
        <h2 id="codex-rewards">Récompenses de collection</h2>
        <span className="quest-summary">
          {milestones.filter((m) => m.claimed).length} / {milestones.length}{' '}
          paliers
        </span>
      </div>
      <ol className="milestone-track">
        {milestones.map((m) => (
          <li
            key={m.id}
            className={m.claimed ? 'done' : m.claimable ? 'ready' : ''}
          >
            <div className="milestone-head">
              <strong>{m.target} modèles</strong>
              <span>+{m.munny.toLocaleString('fr-FR')} Munny</span>
            </div>
            {m.title && (
              <small>
                <Award size={12} aria-hidden="true" /> Titre « {m.title} »
              </small>
            )}
            <span className="meter-track" aria-hidden="true">
              <i style={{ width: `${(m.progress / m.target) * 100}%` }} />
            </span>
            <button
              className={m.claimable ? 'primary' : 'outline'}
              disabled={busy || !m.claimable}
              onClick={() => onClaim(m.id)}
            >
              {m.claimed
                ? 'Reçu'
                : m.claimable
                  ? 'Réclamer'
                  : `${m.progress} / ${m.target}`}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
