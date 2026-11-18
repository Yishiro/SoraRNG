'use client';
import { Flame, Ticket } from 'lucide-react';
import type { Player } from '../game/core';
import { streakRewards, streakStatus } from '../game/streak';

export default function StreakCard({
  player,
  now,
  busy,
  onClaim,
}: {
  player: Player;
  now: number;
  busy: boolean;
  onClaim: () => void;
}) {
  const status = streakStatus(player, now);
  // Jours déjà validés dans le cycle en cours.
  const done = status.claimable ? status.day - 1 : status.day;
  return (
    <section className="panel streak-card" aria-labelledby="streak-title">
      <div className="streak-head">
        <div>
          <h2 id="streak-title">
            <Flame size={18} aria-hidden="true" /> Série de connexion
          </h2>
          <p>
            {status.claimable
              ? status.broken
                ? 'La série a été interrompue : elle repart au jour 1.'
                : `Jour ${status.day} sur 7 à réclamer aujourd’hui.`
              : `Jour ${status.day} reçu. Revenez demain pour le jour ${(status.day % 7) + 1}.`}
          </p>
        </div>
        <button
          className={status.claimable ? 'primary' : 'outline'}
          disabled={busy || !status.claimable}
          onClick={onClaim}
        >
          {status.claimable
            ? `Réclamer ${status.reward.munny.toLocaleString('fr-FR')} Munny`
            : 'Reçu aujourd’hui'}
        </button>
      </div>
      <ol className="streak-days">
        {streakRewards.map((reward, i) => {
          const day = i + 1;
          const state =
            day <= done
              ? 'done'
              : day === status.day && status.claimable
                ? 'today'
                : '';
          return (
            <li key={day} className={state}>
              <span>J{day}</span>
              <strong>{reward.munny.toLocaleString('fr-FR')}</strong>
              {reward.tickets > 0 && (
                <small>
                  <Ticket size={12} aria-hidden="true" /> +1 ticket
                </small>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
