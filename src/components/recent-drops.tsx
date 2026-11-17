'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Pause, Play, Sparkles } from 'lucide-react';
import type { RecentDrop } from '../server/recent-drops';
import { getCardAsset } from '../game/assets';
import CollectorDialog from './collector-dialog';
import GameCard from './game-card';

const date = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

export default function RecentDrops({
  hidden,
  reducedMotion = false,
}: {
  hidden: boolean;
  reducedMotion?: boolean;
}) {
  const [drops, setDrops] = useState<RecentDrop[]>([]);
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<RecentDrop | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    const refresh = async () => {
      if (document.hidden || busy) return;
      busy = true;
      try {
        const response = await fetch('/api/recent-drops', {
          signal: controller.signal,
        });
        if (response.ok) {
          const body = await response.json();
          if (!controller.signal.aborted && Array.isArray(body?.drops))
            setDrops(body.drops);
        }
      } catch {
        /* Keep the last successful feed during a network interruption. */
      } finally {
        busy = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  if (hidden || !drops.length) return null;
  return (
    <>
      <section
        className={`recent-drops ${paused || reducedMotion || selected ? 'is-paused' : ''}`}
        aria-label="Derniers gros drops"
      >
        <div className="drop-label">
          <Sparkles size={15} />
          <strong>Gros drops</strong>
        </div>
        <div className="drop-window">
          <div
            className="drop-track"
            style={{ animationDuration: `${Math.max(20, drops.length * 12)}s` }}
          >
            {[0, 1].map((repeat) => (
              <div
                className="drop-group"
                key={repeat}
                aria-hidden={repeat === 1 ? true : undefined}
              >
                {drops.map((drop) => {
                  const asset = getCardAsset(drop.card.id);
                  return (
                    <button
                      className="drop-item"
                      key={drop.id}
                      tabIndex={repeat === 1 ? -1 : undefined}
                      onClick={() => setSelected(drop)}
                    >
                      <span className="drop-art">
                        {asset?.thumbnailPath ? (
                          <Image
                            unoptimized
                            src={asset.thumbnailPath}
                            width={38}
                            height={48}
                            alt=""
                          />
                        ) : (
                          <Sparkles size={22} />
                        )}
                      </span>
                      <span>
                        <strong>{drop.playerName}</strong>
                        <span className="drop-card-name">
                          {drop.card.name} · {drop.card.version}
                        </span>
                      </span>
                      <span
                        className={`drop-finish ${drop.holo ? 'is-holo' : ''}`}
                      >
                        {drop.card.rarity}
                        {drop.holo && ' · Holographique'}
                        <time dateTime={drop.openedAt}>
                          {date(drop.openedAt)}
                        </time>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <button
          className="icon-button drop-pause"
          onClick={() => setPaused(!paused)}
          aria-label={
            paused ? 'Reprendre le défilement' : 'Suspendre le défilement'
          }
        >
          {paused ? <Play size={15} /> : <Pause size={15} />}
        </button>
      </section>
      {selected && (
        <CollectorDialog
          title="Carte découverte"
          onClose={() => setSelected(null)}
        >
          <GameCard
            card={selected.card}
            holographic={selected.holo}
            fullImage
          />
          <p>
            <strong>{selected.playerName}</strong> a découvert cette carte le{' '}
            {date(selected.openedAt)} (heure de Paris).
          </p>
        </CollectorDialog>
      )}
    </>
  );
}
