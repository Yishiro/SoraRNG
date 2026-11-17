import type { Card, Copy } from '../game/core';
export default function CopyProgress({
  card,
  copy,
}: {
  card: Card;
  copy: Copy;
}) {
  if (copy.level <= 1 && copy.awakening === 0) return null;
  const mastered = copy.level >= card.maxLevel && copy.awakening >= 5;
  return (
    <div
      className={`copy-progress ${mastered ? 'is-mastered' : ''}`}
      aria-label="Progression de cet exemplaire"
    >
      <div>
        <span>
          {mastered
            ? 'Exemplaire accompli'
            : copy.level >= card.maxLevel
              ? 'Niveau maximum'
              : 'Exemplaire développé'}
        </span>
        <strong>
          Niv. {copy.level} / {card.maxLevel}
        </strong>
      </div>
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
      <div
        className="awakening-stars"
        aria-label={`Éveil ${copy.awakening} sur 5`}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={n <= copy.awakening ? 'filled' : ''}
            aria-hidden="true"
          >
            ✦
          </span>
        ))}
        <small>Éveil {copy.awakening}/5</small>
      </div>
    </div>
  );
}
