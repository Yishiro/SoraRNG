'use client';
import { useEffect, useState } from 'react';
export default function Leaderboards() {
  const [rows, setRows] = useState<
    { id: string; name: string; collection: number; summons: number }[]
  >([]);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/leaderboards')
      .then(async (r) => {
        if (!r.ok) throw new Error('Classement indisponible');
        setRows(await r.json());
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="panel">
      <h2>Les voyageurs du royaume</h2>
      <p>
        Classement global par nombre d’exemplaires, puis nombre d’invocations.
      </p>
      {error && <p role="alert">{error}</p>}
      {rows.map((r, i) => (
        <div className="mission-row" key={r.id}>
          <span>{i + 1}</span>
          <div>
            <h3>{r.name}</h3>
            <p>
              {r.collection} exemplaires · {r.summons} invocations
            </p>
          </div>
        </div>
      ))}
      {!rows.length && !error && <p>Aucun voyageur pour le moment.</p>}
    </section>
  );
}
