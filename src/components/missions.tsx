'use client';
import { Crown, Sparkles } from 'lucide-react';
import type { MissionStatus } from '../game/missions';
import { missionDefinitions } from '../game/missions';
import { economy } from '../game/config';
import { bonusNext } from '../game/finance';
import type { Player } from '../game/core';
export default function Missions({
  player,
  missions,
  busy,
  onClaim,
  onDaily,
  dayKey,
  now,
}: {
  player?: Player;
  missions: MissionStatus[];
  busy: boolean;
  onClaim: (id: string) => void;
  onDaily: () => void;
  dayKey: string;
  now?: number;
}) {
  const finished = (id: string) => {
    const mission = missions.find((m) => m.id === id);
    const definition = missionDefinitions.find((m) => m.id === id);
    return Boolean(
      mission &&
      (mission.claimed ||
        (definition && mission.progress >= definition.target)),
    );
  };
  const completed = missionDefinitions.filter((def) => finished(def.id));
  const dailyClaimed = Boolean(
    player &&
    (player.finance?.claims.daily !== undefined
      ? bonusNext(player, 'daily') > (now ?? Date.parse(`${dayKey}T00:00:00Z`))
      : player.daily === dayKey),
  );
  function dailyReward() {
    return (
      <div className="mission-row" key="daily-reward">
        <Crown />
        <div>
          <h3>Récompense quotidienne</h3>
          <p>
            {economy.dailyMunny.toLocaleString('fr-FR')} Munny et{' '}
            {economy.dailyFragments} fragments
          </p>
        </div>
        <button
          className="outline"
          disabled={!player || busy || dailyClaimed}
          onClick={onDaily}
        >
          {dailyClaimed ? 'Récupéré' : 'Récupérer'}
        </button>
      </div>
    );
  }
  function missionRow(def: (typeof missionDefinitions)[number]) {
    const m = missions.find((m) => m.id === def.id);
    return (
      <div
        className={`mission-row${finished(def.id) ? ' mission-finished' : ''}`}
        key={def.id}
      >
        <Sparkles />
        <div>
          <h3>{def.name}</h3>
          {finished(def.id) && (
            <span
              className={`mission-completion-label${m?.claimed ? ' claimed' : ''}`}
            >
              {m?.claimed
                ? 'Récompense récupérée'
                : 'Terminée · Récompense à récupérer'}
            </span>
          )}
          <p>
            {m?.progress ?? 0} / {def.target}{' '}
            {def.metric === 'discoveries'
              ? 'modèles découverts'
              : 'invocations'}{' '}
            · {def.munny.toLocaleString('fr-FR')} Munny
            {def.tickets ? ` · ${def.tickets} ticket` : ''}
            {def.fragments ? ` · ${def.fragments} fragments` : ''}
          </p>
          <progress
            aria-label={`${def.name} progression`}
            value={m?.progress ?? 0}
            max={def.target}
          />
          {m?.resetsAt && (
            <small className="mission-reset">
              Renouvellement : {new Date(m.resetsAt).toLocaleString('fr-FR')}
            </small>
          )}
        </div>
        <button
          className="outline"
          disabled={!player || busy || !m?.claimable || m.claimed}
          onClick={() => onClaim(def.id)}
        >
          {m?.claimed ? 'Récupéré' : 'Récupérer'}
        </button>
      </div>
    );
  }
  return (
    <section className="panel">
      <h2>Des petits pas, de grandes découvertes</h2>
      <p>
        Les missions quotidiennes se renouvellent à minuit UTC ; les
        hebdomadaires le lundi à minuit UTC. La progression est vérifiée par le
        serveur.
      </p>
      {!dailyClaimed && dailyReward()}
      <section aria-label="Quêtes en cours">
        {(['daily', 'weekly', 'permanent'] as const).map((cycle) => {
          const active = missionDefinitions.filter(
            (def) => def.cycle === cycle && !finished(def.id),
          );
          return (
            <div key={cycle}>
              <h3 className="mission-cycle">
                {cycle === 'daily'
                  ? 'Quotidiennes'
                  : cycle === 'weekly'
                    ? 'Hebdomadaires'
                    : 'Collection et premiers pas'}
              </h3>
              {active.length ? (
                active.map(missionRow)
              ) : (
                <p className="mission-cycle-empty">
                  Les quêtes de cette catégorie sont terminées.
                </p>
              )}
            </div>
          );
        })}
      </section>
      <section
        className="completed-missions"
        aria-labelledby="completed-missions-title"
      >
        <div className="completed-missions-heading">
          <h2 id="completed-missions-title">Quêtes terminées</h2>
          <span>{completed.length + (dailyClaimed ? 1 : 0)}</span>
        </div>
        <p>
          Les récompenses disponibles restent à récupérer ici. Les quêtes
          renouvelées reviennent automatiquement dans les quêtes en cours.
        </p>
        {dailyClaimed && dailyReward()}
        {completed.map(missionRow)}
        {!completed.length && !dailyClaimed && (
          <p className="mission-cycle-empty">
            Vos quêtes terminées apparaîtront ici.
          </p>
        )}
      </section>
    </section>
  );
}
