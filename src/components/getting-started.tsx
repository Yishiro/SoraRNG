'use client';
import Link from 'next/link';
import type { Player } from '../game/core';
import { bonusNext, bonusRules } from '../game/finance';
import { economy } from '../game/config';
export default function GettingStarted({
  player,
  now,
  busy,
  canConnect,
  onConnect,
  onClaim,
}: {
  player?: Player;
  now: number;
  busy: boolean;
  canConnect: boolean;
  onConnect: () => void;
  onClaim: () => void;
}) {
  if (player && player.summons > 0) return null;
  const funded =
      !!player && (player.munny >= economy.summon || player.tickets > 0),
    dailyReady = !!player && bonusNext(player, 'daily') <= now;
  return (
    <section
      id="bien-demarrer"
      className="getting-started"
      aria-label="Bien démarrer"
    >
      <div>
        <span className="eyebrow">VOTRE PREMIER BOOSTER</span>
        <h2>Trois étapes pour commencer.</h2>
        <p>
          Un booster coûte {economy.summon.toLocaleString('fr-FR')} Munny et
          contient {economy.cardsPerBooster} cartes.
        </p>
      </div>
      <ol>
        <li className={player ? 'done' : 'current'}>
          <span>01</span>
          <div>
            <h3>Connecter Discord</h3>
            <p>Votre collection et vos Munny suivent votre compte.</p>
            {player ? (
              <strong>Compte connecté ✓</strong>
            ) : (
              <button
                className="primary"
                disabled={!canConnect}
                onClick={onConnect}
              >
                Connecter Discord
              </button>
            )}
          </div>
        </li>
        <li className={funded ? 'done' : player ? 'current' : ''}>
          <span>02</span>
          <div>
            <h3>Réclamer un bonus</h3>
            <p>
              Le bonus quotidien apporte{' '}
              {bonusRules.daily.amount.toLocaleString('fr-FR')} Munny. Les bonus
              sont partagés avec le bot.
            </p>
            {funded ? (
              <strong>Prêt à ouvrir un booster ✓</strong>
            ) : (
              <button
                className="outline"
                disabled={!dailyReady || busy}
                onClick={onClaim}
              >
                {player && !dailyReady
                  ? 'Bonus quotidien déjà réclamé'
                  : 'Réclamer mon bonus quotidien'}
              </button>
            )}
            {player && !funded && !dailyReady && (
              <a href="#wallet">Voir mes autres bonus et mon épargne ↓</a>
            )}
          </div>
        </li>
        <li className={funded ? 'current' : ''}>
          <span>03</span>
          <div>
            <h3>Ouvrir votre premier booster</h3>
            <p>
              Retournez vos cinq cartes, puis retrouvez-les dans Ma collection.
            </p>
            {funded ? (
              <Link className="primary" href="/summon">
                Choisir mon booster →
              </Link>
            ) : (
              <span className="step-wait">Après la connexion et le bonus</span>
            )}
          </div>
        </li>
      </ol>
    </section>
  );
}
