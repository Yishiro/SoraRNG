'use client';
import { useId } from 'react';
import { Crown, KeyRound, Sparkles } from 'lucide-react';
export default function BoosterPack({
  count = 1,
  tone = 'gold',
  opening = false,
}: {
  count?: number;
  tone?: 'gold' | 'violet' | 'silver';
  opening?: boolean;
}) {
  const id = useId().replaceAll(':', '');
  return (
    <div
      className={`booster-pack booster-${tone}${opening ? ' booster-opening' : ''}`}
      aria-hidden="true"
    >
      <div className="booster-light" />
      <div className="booster-wrapper">
        <div className="booster-seal booster-seal-top">
          <span>SORA RNG · CHRONICLES OF LIGHT</span>
        </div>
        <div className="booster-face">
          <div className="booster-print-border" />
          <div className="booster-edition">
            PREMIÈRE CHRONIQUE <span>01</span>
          </div>
          <div className="booster-brand">
            SORA<span>RNG</span>
            <small>TRADING CARD COLLECTION</small>
          </div>
          <svg className="booster-ornament" viewBox="0 0 220 220" fill="none">
            <defs>
              <linearGradient id={id} x1="20" y1="0" x2="190" y2="220">
                <stop stopColor="#fff2bd" />
                <stop offset=".5" stopColor="#a67d3f" />
                <stop offset="1" stopColor="#ffe7aa" />
              </linearGradient>
            </defs>
            <g stroke={`url(#${id})`} strokeWidth=".8">
              <circle cx="110" cy="110" r="82" />
              <circle cx="110" cy="110" r="73" strokeDasharray="2 6" />
              <path d="M110 7 213 110 110 213 7 110Z M110 25 195 110 110 195 25 110Z" />
              <path d="m110 0 5 14-5 14-5-14ZM220 110l-14 5-14-5 14-5ZM110 220l-5-14 5-14 5 14ZM0 110l14-5 14 5-14 5Z" />
              <path d="M32 32 188 188M188 32 32 188" opacity=".4" />
            </g>
          </svg>
          <div className="booster-emblem">
            <Crown size={62} strokeWidth={0.8} />
            <KeyRound size={42} strokeWidth={0.8} />
          </div>
          <div className="booster-title">
            L’éveil des<em>mondes</em>
            <span>COLLECTION PERMANENTE</span>
          </div>
          <div className="booster-count">
            <Sparkles size={12} />
            {count} CARTE{count > 1 ? 'S' : ''} À DÉCOUVRIR
          </div>
          <div className="booster-foil" />
        </div>
        <div className="booster-seal booster-seal-bottom">
          <span>150 MODÈLES · SIX RARETÉS</span>
        </div>
      </div>
      <div className="booster-tear">
        <span>✦ SORA RNG</span>
      </div>
    </div>
  );
}
