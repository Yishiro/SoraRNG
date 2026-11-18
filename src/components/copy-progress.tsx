import type { Card, Copy } from '../game/core';
import { fusionRank } from '../game/stats';

// Une seule ligne fine sous la carte : niveau, éveil et fusion.
export default function CopyProgress({
  card,
  copy,
}: {
  card: Card;
  copy: Copy;
}) {
  const fusion = fusionRank(copy);
  if (copy.level <= 1 && copy.awakening === 0 && fusion === 0) return null;
  const mastered = copy.level >= card.maxLevel && copy.awakening >= 5;
  return (
    <div
      className={`copy-progress ${mastered ? 'is-mastered' : ''}`}
      aria-label="Progression de cet exemplaire"
    >
      <div
        className="copy-level-track"
        role="progressbar"
        aria-label="Niveau de la carte"
        aria-valuemin={1}
        aria-valuemax={card.maxLevel}
        aria-valuenow={copy.level}
      >
        <i
          style={{
            width: `${Math.min(100, (copy.level / card.maxLevel) * 100)}%`,
          }}
        />
      </div>
      <div className="copy-progress-line">
        {mastered ? (
          <strong>Exemplaire accompli</strong>
        ) : (
          <strong>
            Niv. {copy.level}
            <small>/{card.maxLevel}</small>
          </strong>
        )}
        <span className="awakening-stars">
          {/* Texte lu par les lecteurs d'écran ; les étoiles restent visuelles. */}
          <span className="sr-only">Éveil {copy.awakening}/5</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              className={n <= copy.awakening ? 'filled' : ''}
              aria-hidden="true"
            >
              ✦
            </span>
          ))}
        </span>
        {fusion > 0 && <span className="copy-fusion-rank">F{fusion}</span>}
      </div>
    </div>
  );
}
