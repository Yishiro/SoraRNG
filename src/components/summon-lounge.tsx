'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Check,
  Gem,
  LockKeyhole,
  Sparkles,
  Ticket,
} from 'lucide-react';
import type { Player } from '../game/core';
import { economy } from '../game/config';
import { boosts, type summonOdds } from '../game/boosts';
import BoosterPack from './booster-pack';
const modes = [
  { id: 'single', label: 'Un booster', count: 1, tone: 'gold' },
  { id: 'multi', label: '10 boosters', count: 10, tone: 'violet' },
  { id: 'ticket', label: 'Avec un ticket', count: 1, tone: 'gold' },
] as const;
export default function SummonLounge({
  player,
  odds,
  now,
  busy,
  pending = false,
  ready,
  onSummon,
}: {
  player: Player | undefined;
  odds: ReturnType<typeof summonOdds>;
  now: number;
  busy: boolean;
  pending?: boolean;
  ready: boolean;
  onSummon: (mode: string) => void;
}) {
  const [mode, setMode] = useState<(typeof modes)[number]['id']>('single');
  const selected = modes.find((m) => m.id === mode)!;
  const cost = selected.count * economy.summon;
  const discovered = new Set(
    player?.discoveries ?? player?.copies.map((copy) => copy.cardId) ?? [],
  ).size;
  const issue = !player
    ? 'Connectez-vous avec Discord pour ouvrir un sachet.'
    : !ready
      ? 'Le catalogue est temporairement indisponible.'
      : mode === 'ticket' && player.tickets < 1
        ? 'Vous n’avez aucun ticket disponible.'
        : (mode === 'single' || mode === 'multi') && player.munny < cost
          ? 'Votre réserve de Munny est insuffisante.'
          : '';
  return (
    <section className="summon-lounge">
      <div className="summon-edition-header">
        <div>
          <span className="eyebrow">KINGDOM HEARTS · ÉDITION 01</span>
          <h2>
            La prochaine rencontre
            <br />
            se cache ici.
          </h2>
          <p>
            Choisissez un sachet. Déchirez le sceau. Découvrez vos cinq cartes,
            une à une.
          </p>
        </div>
        <Link href="/codex" className="edition-progress">
          <span>Votre édition</span>
          <strong>
            {discovered}
            <small> / 150</small>
          </strong>
          <div className="edition-progress-track">
            <span
              style={{ width: `${Math.min(100, (discovered / 150) * 100)}%` }}
            />
          </div>
          <span>
            Explorer le Codex <ArrowUpRight size={13} />
          </span>
        </Link>
      </div>
      <div className="summon-counter">
        <span>
          <Gem size={15} />
          <strong>{player?.munny.toLocaleString('fr-FR') ?? '—'}</strong> Munny
        </span>
        <span>
          <Ticket size={15} />
          <strong>{player?.tickets ?? '—'}</strong> tickets
        </span>
      </div>
      <div className="summon-experience">
        <div className={`pack-display pack-display-${selected.tone}`}>
          <span className="pack-display-label">
            COLLECTION PERMANENTE / ÉDITION 01
          </span>
          <div className="pack-main" key={selected.id}>
            <BoosterPack tone={selected.tone} count={economy.cardsPerBooster} />
          </div>
          <div className="pack-pedestal" />
          <span className="pack-display-caption">5 CARTES / BOOSTER</span>
        </div>
        <div className="pack-order">
          <div className="pack-order-heading">
            <span className="eyebrow">CHOISIR UN FORMAT</span>
            <h3>{selected.label}</h3>
          </div>
          <div className="pack-modes" aria-label="Format du sachet">
            {modes.map((m) => (
              <button
                key={m.id}
                disabled={busy || pending}
                className={mode === m.id ? 'pack-mode selected' : 'pack-mode'}
                aria-pressed={mode === m.id}
                onClick={() => setMode(m.id)}
              >
                <span className="pack-mode-icon">
                  {m.id === 'ticket' ? (
                    <Ticket size={17} />
                  ) : (
                    <Sparkles size={17} />
                  )}
                </span>
                <span>
                  <strong>{m.label}</strong>
                  <small>
                    {m.id === 'ticket'
                      ? '1 ticket'
                      : `${(m.count * economy.summon).toLocaleString('fr-FR')} Munny`}
                  </small>
                </span>
                <span className="pack-mode-check">
                  {mode === m.id && <Check size={13} />}
                </span>
              </button>
            ))}
          </div>
          <div className="pack-order-total">
            <span>
              {selected.count * economy.cardsPerBooster} cartes ·{' '}
              {selected.count} booster{selected.count > 1 ? 's' : ''} de{' '}
              {economy.cardsPerBooster} cartes
            </span>
            <strong>
              {mode === 'ticket' ? (
                '1 ticket'
              ) : (
                <>
                  {cost.toLocaleString('fr-FR')} <small>Munny</small>
                </>
              )}
            </strong>
          </div>
          <button
            className="primary pack-open-button"
            disabled={Boolean(issue) || busy || pending}
            onClick={() => onSummon(mode)}
          >
            {busy ? (
              <>
                <span className="pack-button-spinner" />
                Préparation du sachet…
              </>
            ) : (
              <>
                <Sparkles size={18} />
                {selected.count === 10
                  ? 'Ouvrir mes 10 boosters'
                  : 'Ouvrir mon sachet'}
                <ArrowUpRight size={18} />
              </>
            )}
          </button>
          <p className="pack-availability" role="status">
            {issue || (
              <>
                <Check size={13} /> Prêt à ouvrir. Les cartes seront
                enregistrées dans votre collection.
              </>
            )}
          </p>
          {!player && (
            <Link className="text-link" href="/auth/signin">
              <LockKeyhole size={13} /> Se connecter avec Discord{' '}
              <ArrowUpRight size={13} />
            </Link>
          )}
          <div className="pack-promises">
            <span>
              ✧ {(odds.holoRate / 100).toLocaleString('fr-FR')} % de finition
              holographique
            </span>
            {odds.active && (
              <span>
                {boosts[odds.active.kind].name} ·{' '}
                {Math.ceil((odds.active.expiresAt - now) / 60000)} min restantes
              </span>
            )}
            <span>5 cartes par booster. Aucune rareté garantie.</span>
            <span>Cartes sauvegardées avant leur révélation.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
