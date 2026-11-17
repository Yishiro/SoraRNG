'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Crown,
  LockKeyhole,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import GameCard from './game-card';
import OpeningSummary from './opening-summary';
import type { RevealBaseline } from '../game/collection-tools';
import PackOpening from './pack-opening';
import { useOpeningAudio } from './use-opening-audio';
import { getCardLegend } from '../game/card-legends';
import { economy, rarities } from '../game/config';
import type { Card, Copy } from '../game/core';
const colors = [
  '#c9cacc',
  '#70bdff',
  '#b99aff',
  '#efc174',
  '#f091c6',
  '#f9e2a0',
];
export default function Reveal({
  copies,
  cards,
  reduced,
  tone,
  demo = false,
  onClose,
  baseline = { discoveries: [], owned: {} },
}: {
  copies: Copy[];
  cards: Card[];
  reduced: boolean;
  tone?: 'gold' | 'violet' | 'silver';
  demo?: boolean;
  onClose: () => void;
  baseline?: RevealBaseline;
}) {
  const [phase, setPhase] = useState(reduced ? 'cards' : 'sealed');
  const [shown, setShown] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [turning, setTurning] = useState(false);
  const [review, setReview] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const audio = useOpeningAudio();
  const swipeStart = useRef<number | null>(null);
  const swiped = useRef(false);
  const current = copies[index];
  const card = cards.find((c) => c.id === current?.cardId);
  const faceUp = shown.includes(current?.id);
  const complete =
    copies.length > 0 && copies.every((c) => shown.includes(c.id)) && !turning;
  const reduce =
    reduced ||
    (typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  useEffect(() => {
    if (phase === 'cards')
      dialog.current
        ?.querySelector<HTMLElement>('.flip-card-back:not(:disabled)')
        ?.focus();
  }, [index, phase]);
  useEffect(() => {
    if (phase !== 'cards' || !faceUp || turning) return;
    const focused = document.activeElement;
    if (
      focused === document.body ||
      focused?.classList.contains('flip-card-back')
    )
      dialog.current
        ?.querySelector<HTMLButtonElement>('.card-advance:not(:disabled)')
        ?.focus();
  }, [phase, faceUp, turning]);
  useEffect(() => {
    if (reduce && phase !== 'cards') {
      const timer = setTimeout(() => setPhase('cards'), 0);
      return () => clearTimeout(timer);
    }
  }, [phase, reduce]);
  useEffect(() => {
    if (turning) {
      const timer = setTimeout(() => setTurning(false), 850);
      return () => clearTimeout(timer);
    }
  }, [turning]);
  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (complete) onClose();
      }
      if (event.key === 'Tab') {
        const elements = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),a[href],summary,[tabindex="0"]',
          ) ?? [],
        ).filter(
          (element) =>
            element.getClientRects().length > 0 &&
            element.getAttribute('tabindex') !== '-1',
        );
        if (!elements?.length) {
          event.preventDefault();
          return;
        }
        const first = elements[0],
          last = elements[elements.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialog.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === dialog.current)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', keyboard, true);
    return () => document.removeEventListener('keydown', keyboard, true);
  }, [complete, onClose]);
  const accent =
    faceUp && card ? colors[rarities.indexOf(card.rarity)] : '#d0d1d3';
  function flip() {
    if (faceUp || turning) return;
    setShown((previous) =>
      previous.includes(current.id) ? previous : [...previous, current.id],
    );
    audio.play('flip', card ? rarities.indexOf(card.rarity) : 0);
    if (!reduce) setTurning(true);
  }
  const packCount = Math.ceil(copies.length / economy.cardsPerBooster);
  return (
    <div
      ref={dialog}
      tabIndex={-1}
      className={`modal-backdrop reveal theatre-reveal${faceUp ? ' theatre-lit' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Résultats de votre invocation"
      style={{ '--reveal-accent': accent } as CSSProperties}
    >
      <section className={`modal theatre-modal phase-${phase}`}>
        <div className="theatre-heading">
          <span className="eyebrow">OUVERTURE / ÉDITION 01</span>
          <button
            className="opening-audio-toggle"
            onClick={audio.toggle}
            aria-pressed={audio.enabled}
            aria-label={audio.enabled ? 'Couper le son' : 'Activer le son'}
          >
            {audio.enabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <span className="theatre-saved">
            <Check size={12} />{' '}
            {demo
              ? 'MODE TEST · Cartes non enregistrées'
              : 'Collection sauvegardée'}
          </span>
        </div>
        {phase !== 'cards' ? (
          <PackOpening
            count={Math.min(copies.length, economy.cardsPerBooster)}
            tone={tone ?? 'gold'}
            onComplete={() => setPhase('cards')}
            onTear={() => audio.play('tear')}
          />
        ) : (
          <>
            <div className="theatre-progress">
              <div>
                <span className="eyebrow">
                  BOOSTER {Math.floor(index / economy.cardsPerBooster) + 1} /{' '}
                  {packCount}
                </span>
                <h2>{faceUp ? 'Carte révélée.' : 'Retournez votre carte.'}</h2>
              </div>
              <strong>
                {shown.length}
                <small> / {copies.length} retournées</small>
              </strong>
            </div>
            <div
              className="theatre-progress-track"
              role="progressbar"
              aria-label="Cartes retournées"
              aria-valuenow={shown.length}
              aria-valuemin={0}
              aria-valuemax={copies.length}
            >
              <i
                style={{ width: `${(shown.length / copies.length) * 100}%` }}
              />
            </div>
            {review && complete ? (
              <div className="cards-grid theatre-review">
                {copies.map((c) => {
                  const model = cards.find((k) => k.id === c.cardId);
                  return model ? (
                    <GameCard
                      key={c.id}
                      card={model}
                      copy={c}
                      showDetails={false}
                    />
                  ) : (
                    <p key={c.id}>{c.cardId} · Carte sauvegardée</p>
                  );
                })}
              </div>
            ) : (
              <>
                <div
                  className={`card-theatre${faceUp ? ' is-revealed' : ''}${turning ? ' is-turning' : ''}`}
                  key={current.id}
                >
                  <div
                    className={`flip-card${faceUp ? ' face-up' : ''}${reduce ? ' no-motion' : ''}`}
                  >
                    <div className="flip-card-rotator">
                      <button
                        className="flip-card-back"
                        tabIndex={faceUp ? -1 : 0}
                        disabled={faceUp}
                        aria-hidden={faceUp}
                        aria-label={`Retourner la carte ${index + 1}`}
                        onClick={() => {
                          if (swiped.current) {
                            swiped.current = false;
                            return;
                          }
                          flip();
                        }}
                        onPointerDown={(event) => {
                          swipeStart.current = event.clientX;
                          swiped.current = false;
                          event.currentTarget.setPointerCapture(
                            event.pointerId,
                          );
                        }}
                        onPointerUp={(event) => {
                          const distance =
                            swipeStart.current === null
                              ? 0
                              : event.clientX - swipeStart.current;
                          swipeStart.current = null;
                          if (Math.abs(distance) > 45) {
                            swiped.current = true;
                            flip();
                          }
                        }}
                        onPointerCancel={() => {
                          swipeStart.current = null;
                        }}
                      >
                        <span className="flip-card-border" />
                        <span className="flip-back-brand">
                          SORA<span>RNG</span>
                        </span>
                        <span className="flip-back-sigil">
                          <Crown size={72} strokeWidth={0.7} />
                          <Sparkles size={30} strokeWidth={0.8} />
                        </span>
                        <span className="flip-back-title">
                          CHRONICLES
                          <br />
                          OF LIGHT
                        </span>
                        <span className="flip-back-prompt">
                          TOUCHER OU GLISSER <ArrowRight size={12} />
                        </span>
                      </button>
                      <div className="flip-card-front" aria-hidden={!faceUp}>
                        {faceUp && index < copies.length - 1 && (
                          <button
                            className="card-advance"
                            aria-label={`Passer à la carte ${index + 2}`}
                            disabled={turning}
                            onClick={() => {
                              if (!turning) setIndex((i) => i + 1);
                            }}
                          />
                        )}
                        {faceUp &&
                          (card ? (
                            <GameCard
                              card={card}
                              copy={current}
                              showDetails={false}
                              fullImage
                            />
                          ) : (
                            <div className="game-card missing-reveal-card">
                              <Crown />
                              <h3>{current.cardId}</h3>
                              <p>Carte enregistrée dans votre collection.</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                  <div className="theatre-card-caption" aria-live="polite">
                    {faceUp ? (
                      <>
                        <span className="theatre-rarity">
                          {card?.rarity ?? 'Carte sauvegardée'}
                          {current.holo ? ' · ✦ Holographique' : ''}
                        </span>
                        <p>
                          {card?.name ?? current.cardId}{' '}
                          <span>· {card?.version}</span>
                        </p>
                        {card && getCardLegend(card.id) && (
                          <blockquote
                            className="reveal-card-legend"
                            aria-label="Légende de la carte"
                          >
                            {getCardLegend(card.id)}
                          </blockquote>
                        )}
                        {index < copies.length - 1 && (
                          <small className="card-advance-hint">
                            Touchez la carte pour passer à la suivante
                          </small>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="theatre-rarity">
                          CARTE {(index % economy.cardsPerBooster) + 1} /{' '}
                          {Math.min(
                            economy.cardsPerBooster,
                            copies.length -
                              Math.floor(index / economy.cardsPerBooster) *
                                economy.cardsPerBooster,
                          )}
                        </span>
                        <p>Cliquez sur la carte pour la retourner.</p>
                      </>
                    )}
                  </div>
                </div>
                <div className="theatre-navigation">
                  <button
                    className="outline"
                    disabled={index === 0 || turning}
                    onClick={() => setIndex((i) => i - 1)}
                  >
                    <ArrowLeft size={14} /> Précédente
                  </button>
                  <div
                    className="theatre-dots"
                    aria-label={`${shown.length} cartes retournées`}
                  >
                    {copies
                      .slice(
                        Math.floor(index / economy.cardsPerBooster) *
                          economy.cardsPerBooster,
                        Math.floor(index / economy.cardsPerBooster) *
                          economy.cardsPerBooster +
                          economy.cardsPerBooster,
                      )
                      .map((c) => (
                        <i
                          className={`${shown.includes(c.id) ? 'done ' : ''}${c.id === current.id ? 'current' : ''}`}
                          key={c.id}
                        />
                      ))}
                  </div>
                  <button
                    className="primary"
                    disabled={!faceUp || turning || index === copies.length - 1}
                    onClick={() => setIndex((i) => i + 1)}
                  >
                    Suivante <ArrowRight size={14} />
                  </button>
                </div>
              </>
            )}
            {complete && (
              <OpeningSummary
                copies={copies}
                cards={cards}
                baseline={baseline}
                onClose={onClose}
                demo={demo}
              />
            )}
            <div className="theatre-footer">
              <p role="status">
                {complete ? (
                  <>
                    <Check size={13} /> Toutes les cartes ont été révélées.
                  </>
                ) : (
                  <>
                    <LockKeyhole size={13} /> Retournez chaque carte avant de
                    terminer. {copies.length - shown.length} restante
                    {copies.length - shown.length > 1 ? 's' : ''}.
                  </>
                )}
              </p>
              <div className="action-row">
                {complete && (
                  <button
                    className="outline"
                    onClick={() => setReview((value) => !value)}
                  >
                    {review ? 'Revenir à la carte' : 'Revoir mes cartes'}
                  </button>
                )}
                <button
                  className="primary"
                  disabled={!complete}
                  onClick={() => {
                    if (complete) onClose();
                  }}
                >
                  Continuer l’aventure
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
