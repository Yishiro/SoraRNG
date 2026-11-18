import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { QuestStatus } from '../game/quests';

// Aperçu des quêtes du jour sur l'accueil : les réclamables d'abord.
export default function DashboardNext({
  quests,
  busy,
  onClaim,
}: {
  quests: QuestStatus[];
  busy: boolean;
  onClaim: (quest: QuestStatus) => void;
}) {
  const daily = quests.filter((q) => q.cycle === 'daily');
  if (!daily.length) return null;
  const done = daily.filter((q) => q.claimed).length;
  const shown = daily
    .filter((q) => !q.claimed)
    .sort(
      (a, b) =>
        Number(b.claimable) - Number(a.claimable) ||
        b.progress / b.target - a.progress / a.target,
    )
    .slice(0, 4);
  return (
    <section className="panel home-quests" aria-labelledby="home-quests">
      <div className="section-title">
        <h2 id="home-quests">Quêtes du jour</h2>
        <Link href="/missions">
          {done} / {daily.length} terminées <ChevronRight size={14} />
        </Link>
      </div>
      {shown.length ? (
        <ul className="quest-list">
          {shown.map((q) => (
            <li key={q.claimKey} className={q.claimable ? 'ready' : ''}>
              <div>
                <h3>{q.name}</h3>
                <div
                  className="quest-progress"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={q.target}
                  aria-valuenow={q.progress}
                  aria-label={`${q.name} : ${q.progress} sur ${q.target}`}
                >
                  <i style={{ width: `${(q.progress / q.target) * 100}%` }} />
                </div>
              </div>
              <strong>+{q.munny.toLocaleString('fr-FR')} Munny</strong>
              <button
                className={q.claimable ? 'primary' : 'outline'}
                disabled={busy || !q.claimable}
                onClick={() => onClaim(q)}
              >
                {q.claimable ? 'Réclamer' : `${q.progress} / ${q.target}`}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>Toutes les quêtes du jour sont terminées. Bravo !</p>
      )}
    </section>
  );
}
