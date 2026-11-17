'use client';
import { useState } from 'react';
import type { Player } from '../game/core';
import { financeView, type Bonus } from '../game/finance';
const labels: Record<Bonus, string> = {
  hourly: 'Horaire',
  daily: 'Quotidien',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
};
function remainingTime(milliseconds: number) {
  const minutes = Math.max(1, Math.ceil(milliseconds / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} j ${hours % 24} h`;
}
export default function FinancePanel({
  player,
  now,
  busy,
  onAction,
}: {
  player: Player;
  now: number;
  busy: boolean;
  onAction: (kind: string, payload: Record<string, unknown>) => void;
}) {
  const [amount, setAmount] = useState('');
  const view = financeView(player, now);
  return (
    <section className="panel finance-panel" aria-labelledby="finance-title">
      <div className="section-title">
        <h2 id="finance-title">Munny & banque</h2>
        <span>Compte commun · Site et Discord</span>
      </div>
      <div className="finance-balances">
        <div>
          <span>Disponible</span>
          <strong>
            {view.wallet.toLocaleString('fr-FR')} <small>Munny</small>
          </strong>
        </div>
        <div>
          <span>Épargne · 2 % / jour</span>
          <strong>
            {BigInt(view.bank).toLocaleString('fr-FR')} <small>Munny</small>
          </strong>
        </div>
        <div>
          <span>Mises réservées</span>
          <strong>
            {view.reserved.toLocaleString('fr-FR')} <small>Munny</small>
          </strong>
        </div>
      </div>
      <p>
        L’épargne et ses intérêts restent à la banque. Les intérêts sont
        composés automatiquement selon la durée du dépôt. Dépôt et retrait sans
        frais ; l’épargne n’est pas utilisable pour les achats ou les paris
        avant retrait.
      </p>
      <div className="finance-bank-actions">
        <label className="bank-amount-field">
          <span>Montant du transfert</span>
          <input
            aria-label="Montant bancaire"
            inputMode="numeric"
            value={amount}
            placeholder="Montant ou tout"
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <button
          className="outline bank-all"
          disabled={busy}
          onClick={() => setAmount('tout')}
        >
          Tout
        </button>
        <button
          className="outline"
          disabled={busy || !amount || view.wallet === 0}
          onClick={() => onAction('deposit', { amount })}
        >
          Déposer
        </button>
        <button
          className="outline"
          disabled={busy || !amount || BigInt(view.bank) === 0n}
          onClick={() => onAction('withdraw', { amount })}
        >
          Retirer
        </button>
      </div>
      <div className="finance-bonuses">
        {(Object.keys(labels) as Bonus[]).map((type) => {
          const bonus = view.bonuses[type];
          return (
            <div key={type}>
              <span>{labels[type]}</span>
              <strong>{bonus.amount.toLocaleString('fr-FR')} Munny</strong>
              <small>
                {bonus.available
                  ? 'Disponible'
                  : `Dans ${remainingTime(bonus.nextAt - now)}`}
              </small>
              <div className="bonus-progress" aria-hidden="true">
                <span
                  style={{
                    width: `${bonus.available ? 100 : Math.max(0, Math.min(100, 100 * (1 - (bonus.nextAt - now) / bonus.delay)))}%`,
                  }}
                />
              </div>
              <button
                className="outline"
                disabled={busy || !bonus.available}
                onClick={() => onAction('bonus', { type })}
              >
                Réclamer {labels[type].toLowerCase()}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
