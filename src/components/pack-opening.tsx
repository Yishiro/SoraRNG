'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Crown, KeyRound, Sparkles, MousePointer2 } from 'lucide-react';
type Tone = 'gold' | 'violet' | 'silver';
function Print({ count }: { count: number }) {
  return (
    <>
      <span className="atelier-crimp crimp-top" />
      <span className="atelier-print">
        <span className="atelier-edition">
          CHRONICLES OF LIGHT <span>VOL. 01</span>
        </span>
        <span className="atelier-brand">
          SORA<span>RNG</span>
          <small>COLLECTION DE CARTES</small>
        </span>
        <span className="atelier-emblem">
          <span className="emblem-diamond" />
          <Crown className="emblem-crown" size={62} strokeWidth={0.8} />
          <KeyRound className="emblem-key" size={112} strokeWidth={0.6} />
          <Sparkles className="emblem-star" size={23} strokeWidth={0.8} />
        </span>
        <span className="atelier-title">
          L’ÉVEIL<small>DES MONDES</small>
        </span>
        <span className="atelier-bottom">
          {count} CARTES À DÉCOUVRIR <span>✦</span> PREMIÈRE ÉDITION
        </span>
      </span>
      <span className="atelier-crimp crimp-bottom" />
      <span className="atelier-foil-shine" />
    </>
  );
}
export default function PackOpening({
  count,
  tone,
  onComplete,
  onTear,
}: {
  count: number;
  tone: Tone;
  onComplete: () => void;
  onTear: () => void;
}) {
  const [stage, setStage] = useState('sealed');
  const active = useRef(false),
    finish = useRef(onComplete);
  useEffect(() => {
    finish.current = onComplete;
  }, [onComplete]);
  const opening = stage !== 'sealed';
  useEffect(() => {
    if (!opening) return;
    const timers = [
      setTimeout(() => setStage('unfold'), 2300),
      setTimeout(() => setStage('fan'), 3800),
      setTimeout(() => finish.current(), 5200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [opening]);
  function tear() {
    if (active.current) return;
    active.current = true;
    setStage('tearing');
    onTear();
  }
  return (
    <div
      className={`physical-opening atelier-opening opening-${stage} tone-${tone}`}
    >
      <div className="atelier-scene-title">
        <span className="eyebrow">L’ÉVEIL DES MONDES</span>
        <h2>
          {stage === 'sealed'
            ? 'Votre booster.'
            : stage === 'fan'
              ? 'Vos cinq cartes.'
              : 'Ouverture en cours.'}
        </h2>
      </div>
      <div className="atelier-stage">
        <div className="atelier-light-column" />
        <div className="atelier-ground" />
        <div className="atelier-motes" aria-hidden="true">
          {Array.from({ length: 22 }, (_, i) => (
            <i
              key={i}
              style={
                {
                  '--x': `${(i * 47) % 100}%`,
                  '--delay': `${-i * 0.71}s`,
                  '--duration': `${4 + (i % 5)}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <div className="atelier-object">
          <div className="atelier-deck" aria-hidden="true">
            {Array.from({ length: Math.min(count, 5) }, (_, i) => (
              <div
                className="atelier-card"
                key={i}
                style={
                  {
                    '--i': i,
                    '--spread': `${(i - 2) * 56}px`,
                    '--angle': `${(i - 2) * 12}deg`,
                  } as CSSProperties
                }
              >
                <span className="atelier-card-line" />
                <span className="atelier-card-brand">
                  SORA<span>RNG</span>
                </span>
                <span className="atelier-card-sigil">
                  <Crown size={57} strokeWidth={0.7} />
                  <KeyRound size={52} strokeWidth={0.6} />
                </span>
                <span className="atelier-card-label">CHRONICLES OF LIGHT</span>
              </div>
            ))}
          </div>
          <button
            className="atelier-pack"
            aria-label="Déchirer le sachet"
            disabled={opening}
            onClick={tear}
          >
            <span className="atelier-body">
              <Print count={count} />
            </span>
            <span className="atelier-lip" />
            <span className="atelier-strip">
              <span className="atelier-strip-attached">
                <Print count={count} />
              </span>
              <span className="atelier-strip-fold">
                <Print count={count} />
                <span className="atelier-strip-backing" />
              </span>
              <span className="atelier-fold-crease" />
            </span>
            <span className="atelier-cut">
              <i />
              <Sparkles size={14} />
            </span>
          </button>
          <div className="atelier-opening-light" />
        </div>
        <div className="atelier-streaks" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <i
              key={i}
              style={
                {
                  '--angle': `${i * 30}deg`,
                  '--d': `${(i % 3) * 0.05}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      </div>
      <div className="atelier-controls">
        <div className="atelier-tap" aria-hidden="true">
          <MousePointer2 size={19} />
        </div>
        <p>
          {stage === 'sealed'
            ? 'Cliquez sur le paquet pour l’ouvrir'
            : 'Laissez la lumière vous guider'}
          <small>
            {stage === 'sealed'
              ? 'Un clic suffit · 5 cartes à découvrir'
              : `${count} cartes · Retournez-les une par une`}
          </small>
        </p>
      </div>
      <button className="text-link atelier-skip" onClick={onComplete}>
        Passer la déchirure
      </button>
    </div>
  );
}
