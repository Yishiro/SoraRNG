'use client';
import { Snowflake } from 'lucide-react';
import type { Player } from '../game/core';
import { rarities } from '../game/config';
import {
  themedOdds,
  themedStatus,
  visibleThemedBoosters,
} from '../game/themed-boosters';
import BoosterPack from './booster-pack';

const monthFmt = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  timeZone: 'Europe/Paris',
});
const dayFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  timeZone: 'Europe/Paris',
});
// « 1er décembre », « 6 janvier » : l'ordinal du premier jour du mois.
const dateFmt = {
  format: (date: Date) => {
    const day = dayFmt.format(date);
    return `${day === '1' ? '1er' : day} ${monthFmt.format(date)}`;
  },
};

export default function ThemedBoosters({
  player,
  now,
  busy,
  onOpen,
}: {
  player?: Player;
  now: number;
  busy: boolean;
  onOpen: (booster: string, multi: boolean) => void;
}) {
  const boosters = visibleThemedBoosters(now);
  if (!boosters.length) return null;
  return (
    <>
      {boosters.map((b) => {
        const s = themedStatus(b, now);
        const odds = themedOdds(b, player?.boost, now);
        const last = new Date(s.end - 1);
        return (
          <section
            key={b.id}
            className={`panel themed-booster themed-${b.tone}`}
            aria-labelledby={`themed-${b.id}`}
          >
            <div className="themed-pack">
              <BoosterPack tone={b.tone} />
            </div>
            <div className="themed-body">
              <span className="eyebrow">
                <Snowflake size={13} aria-hidden="true" /> Édition limitée
              </span>
              <h2 id={`themed-${b.id}`}>{b.name}</h2>
              <p>{b.description}</p>
              <p className="themed-window">
                {s.active
                  ? `En vente jusqu’au ${dateFmt.format(last)} inclus.`
                  : `Disponible du ${dateFmt.format(new Date(s.start))} au ${dateFmt.format(last)}.`}
              </p>
              <dl className="themed-rates">
                {rarities.map((r, i) => (
                  <div key={r}>
                    <dt>{r}</dt>
                    <dd>{(odds.rates[i] / 100).toLocaleString('fr-FR')} %</dd>
                  </div>
                ))}
              </dl>
              {s.active ? (
                <div className="themed-actions">
                  <button
                    className="primary"
                    disabled={busy || !player || player.munny < b.cost}
                    onClick={() => onOpen(b.id, false)}
                  >
                    Ouvrir pour {b.cost.toLocaleString('fr-FR')} Munny
                  </button>
                  <button
                    className="outline"
                    disabled={busy || !player || player.munny < b.cost * 10}
                    onClick={() => onOpen(b.id, true)}
                  >
                    10 boosters · {(b.cost * 10).toLocaleString('fr-FR')} Munny
                  </button>
                </div>
              ) : (
                <p className="workshop-note">
                  Revenez à cette date : le booster apparaîtra ici.
                </p>
              )}
            </div>
          </section>
        );
      })}
    </>
  );
}
