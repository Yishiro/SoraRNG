import type { Copy } from '../game/core';
import { operationLabel, signedMunny } from '../game/operation-labels';

export type HistoryEntry = {
  kind: string;
  delta: number;
  createdAt: string;
  result: { copies?: Copy[] };
};

export default function AdventureLog({
  history,
  onReplay,
}: {
  history: HistoryEntry[];
  onReplay: (copies: Copy[]) => void;
}) {
  return (
    <section className="panel history">
      <h2>Journal de votre aventure</h2>
      {history.length ? (
        history.map((h, i) => (
          <div key={i}>
            <span>{operationLabel(h.kind)}</span>
            {h.kind === 'summon' && Array.isArray(h.result?.copies) && (
              <button
                className="text-link"
                onClick={() => onReplay(h.result.copies!)}
              >
                Revoir les cartes
              </button>
            )}
            <time>{new Date(h.createdAt).toLocaleString('fr-FR')}</time>
            <strong>{h.delta ? signedMunny(h.delta) : '—'}</strong>
          </div>
        ))
      ) : (
        <p>Vos premières actions apparaîtront ici.</p>
      )}
    </section>
  );
}
