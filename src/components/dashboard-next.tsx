import Link from 'next/link';
import {
  BookOpen,
  ChevronRight,
  Crown,
  ScrollText,
  Sparkles,
} from 'lucide-react';
import type { Player } from '../game/core';
import { bonusNext } from '../game/finance';

export default function DashboardNext({
  player,
  busy,
  now,
  onDaily,
}: {
  player: Player;
  busy: boolean;
  now: number;
  onDaily: () => void;
}) {
  return (
    <div className="lower-grid">
      <section className="panel">
        <div className="section-title">
          <h2>
            <ScrollText size={19} /> Vos prochaines aventures
          </h2>
          <Link href="/missions">Toutes les missions →</Link>
        </div>
        <div className="mission-row">
          <div className="mission-icon">
            <Crown />
          </div>
          <div>
            <h3>Bonus quotidien</h3>
            <p>Récupérez votre bonus du jour.</p>
            <small>
              ✦ 5 000 Munny <span>+ 10 fragments</span>
            </small>
          </div>
          <button
            className="outline"
            disabled={!player || busy || bonusNext(player, 'daily') > now}
            onClick={() => onDaily()}
          >
            Récupérer
          </button>
        </div>
        <div className="mission-row">
          <div className="mission-icon purple">
            <Sparkles />
          </div>
          <div>
            <h3>Première invocation</h3>
            <p>Effectuez votre première invocation.</p>
            <small>
              {Math.min(player?.summons ?? 0, 1)} / 1 <span>+ 500 Munny</span>
            </small>
          </div>
          <Link href="/missions" className="icon-button">
            <ChevronRight />
          </Link>
        </div>
      </section>
      <section className="panel codex-panel">
        <span className="eyebrow">LE LIVRE DES MONDES</span>
        <h2>
          Le Codex.
          <br />
          Votre progression.
        </h2>
        <p>Retrouvez les modèles découverts et les cartes encore à obtenir.</p>
        <Link href="/codex">
          Ouvrir le Codex <ChevronRight size={15} />
        </Link>
        <BookOpen className="codex-watermark" size={130} strokeWidth={0.6} />
      </section>
    </div>
  );
}
