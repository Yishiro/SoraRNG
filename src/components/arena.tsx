'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Shield, Swords, Trophy } from 'lucide-react';
import type { Card, Player } from '../game/core';
import { buildFighter, cardCanFight, teamPower } from '../game/battle/engine';
import { leagueOf, leagues, pvpRules } from '../game/battle/rules';
import BattleView, { type PublicBattle } from './battle-view';

type Opponent = { id: string; name: string; power: number; rating: number };
type RankRow = {
  id: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
};
type Recent = {
  id: string;
  attackerId: string;
  defenderId: string;
  attackerName: string;
  defenderName: string;
  winner: 'a' | 'b' | 'draw' | null;
  result: PublicBattle['result'];
};
type Overview = {
  team: { copyIds: string[]; power: number; league: string } | null;
  rating: { rating: number; wins: number; losses: number; draws: number };
  attacksLeft: number;
  opponents: Opponent[];
  leaderboards: Record<string, RankRow[]>;
  active: PublicBattle | null;
  recent: Recent[];
};

const leagueName = (id?: string) =>
  leagues.find((l) => l.id === id)?.name ?? '—';

async function call(body: Record<string, unknown>) {
  const r = await fetch('/api/arena', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok)
    throw Object.assign(new Error(data?.error ?? 'Action impossible.'), {
      status: r.status,
    });
  return data;
}

export default function Arena({
  player,
  playerId,
  cards,
}: {
  player: Player;
  playerId: string;
  cards: Card[];
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [battle, setBattle] = useState<PublicBattle | null>(null);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [tab, setTab] = useState<string>('bronze');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Une attaque garde le même identifiant tant que la réponse n'est pas
  // arrivée : relancer après une coupure réseau ne crée pas un 2e combat.
  const pendingAttack = useRef<{ defenderId: string; battleId: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/arena', { cache: 'no-store' });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error ?? 'Arène indisponible.');
      setData(body);
      setBattle(
        (current) =>
          body.active ?? (current?.status === 'active' ? null : current),
      );
      if (body.team) setTab(body.team.league);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Arène indisponible.');
    }
  }, []);
  useEffect(() => {
    // Chargement initial depuis l'API : l'état est mis à jour après la réponse.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const fighters = useMemo(
    () =>
      player.copies
        .map((copy) => ({ copy, card: byId.get(copy.cardId) }))
        .filter(
          (x): x is { copy: typeof x.copy; card: Card } =>
            Boolean(x.card) && cardCanFight(x.card!),
        )
        .map(({ copy, card }) => ({
          copy,
          card,
          fighter: buildFighter(card, copy),
        }))
        .map((x) => ({ ...x, power: teamPower([x.fighter]) }))
        .sort((a, b) => b.power - a.power),
    [player.copies, byId],
  );
  const chosen = selected ?? data?.team?.copyIds ?? [];
  const chosenFighters = chosen
    .map((id) => fighters.find((f) => f.copy.id === id)?.fighter)
    .filter((f) => f !== undefined);
  const previewPower = teamPower(chosenFighters);
  const previewLeague = chosenFighters.length ? leagueOf(previewPower) : null;
  const dirty =
    selected !== null &&
    selected.join(',') !== (data?.team?.copyIds ?? []).join(',');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 409 && battle) {
        // Action déjà prise en compte (double clic, autre onglet) : on recharge.
        setBattle(
          await fetch(`/api/arena?battle=${battle.id}`, {
            cache: 'no-store',
          }).then((r) => r.json()),
        );
      } else setError(e instanceof Error ? e.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) => {
    const next = chosen.includes(id)
      ? chosen.filter((x) => x !== id)
      : chosen.length < pvpRules.team.maxSize
        ? [...chosen, id]
        : chosen;
    setSelected(next);
  };

  if (error && !data) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Chargement de l’arène…</p>;

  if (battle)
    return (
      <>
        {error && <p role="alert">{error}</p>}
        <BattleView
          battle={battle}
          busy={busy}
          onTurn={(move) =>
            run(async () =>
              setBattle(
                await call({
                  action: 'turn',
                  battleId: battle.id,
                  turn: battle.state.turn,
                  move,
                }),
              ),
            )
          }
          onReplace={(to) =>
            run(async () =>
              setBattle(
                await call({ action: 'replace', battleId: battle.id, to }),
              ),
            )
          }
          onForfeit={() =>
            run(async () =>
              setBattle(await call({ action: 'forfeit', battleId: battle.id })),
            )
          }
          onClose={() => {
            setBattle(null);
            void load();
          }}
        />
      </>
    );

  const total = data.rating.wins + data.rating.losses + data.rating.draws;
  return (
    <>
      <section className="panel arena-hero" aria-labelledby="arena-title">
        <span className="eyebrow">
          Arène · ligue {leagueName(data.team?.league)}
        </span>
        <h2 id="arena-title">
          <Swords size={20} aria-hidden="true" /> {data.rating.rating} points
        </h2>
        <p>
          {total
            ? `${data.rating.wins} victoire${data.rating.wins > 1 ? 's' : ''} · ${data.rating.losses} défaite${data.rating.losses > 1 ? 's' : ''}${data.rating.draws ? ` · ${data.rating.draws} nul${data.rating.draws > 1 ? 's' : ''}` : ''}`
            : 'Aucun combat pour l’instant.'}{' '}
          · {data.attacksLeft} attaque{data.attacksLeft > 1 ? 's' : ''} restante
          {data.attacksLeft > 1 ? 's' : ''} aujourd’hui
        </p>
        <p className="arena-rules">
          Attaquez l’équipe de défense d’un joueur de votre ligue, jouée par
          l’IA. Défendre ne coûte rien. Chaque mois, le top 3 de chaque ligue
          reçoit{' '}
          {pvpRules.monthlyRewards
            .map((r) => r.toLocaleString('fr-FR'))
            .join(' / ')}{' '}
          Munny.
        </p>
      </section>

      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}

      <section className="panel" aria-labelledby="arena-team-title">
        <div className="section-title">
          <h2 id="arena-team-title">
            <Shield size={18} aria-hidden="true" /> Équipe de défense
          </h2>
          <small>
            {chosen.length}/{pvpRules.team.maxSize} · puissance {previewPower}
            {previewLeague ? ` · ligue ${previewLeague.name}` : ''}
          </small>
        </div>
        <p className="arena-hint">
          Choisissez de 1 à 3 cartes : la même équipe attaque et défend. Une
          carte en vente ou proposée dans un échange ne peut pas combattre.
        </p>
        {fighters.length ? (
          <ul className="arena-roster">
            {fighters.slice(0, 60).map(({ copy, card, fighter, power }) => {
              const on = chosen.includes(copy.id);
              return (
                <li key={copy.id}>
                  <button
                    className={`arena-pick ${on ? 'active' : ''}`}
                    aria-pressed={on}
                    disabled={
                      busy || (!on && chosen.length >= pvpRules.team.maxSize)
                    }
                    onClick={() => toggle(copy.id)}
                  >
                    <strong>{card.name}</strong>
                    <small>
                      {card.rarity} · {fighter.element} · Nv. {copy.level}
                    </small>
                    <small>
                      PV {fighter.maxHp} · Att {fighter.atk} · Déf {fighter.def}{' '}
                      · Vit {fighter.spd} · {power}
                    </small>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p>Aucune carte capable de combattre : ouvrez des boosters.</p>
        )}
        <div className="arena-team-actions">
          <button
            className="primary"
            disabled={busy || !chosen.length || !dirty}
            onClick={() =>
              run(async () => {
                await call({ action: 'team', copyIds: chosen });
                setSelected(null);
                setNotice('Équipe enregistrée.');
                await load();
              })
            }
          >
            Enregistrer l’équipe
          </button>
          {dirty && (
            <button
              className="text-link"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              Annuler
            </button>
          )}
        </div>
      </section>

      <section className="panel" aria-labelledby="arena-opponents-title">
        <div className="section-title">
          <h2 id="arena-opponents-title">Adversaires</h2>
        </div>
        {!data.team ? (
          <p>Enregistrez une équipe pour trouver des adversaires.</p>
        ) : data.opponents.length ? (
          <ul className="arena-opponents">
            {data.opponents.map((o) => (
              <li key={o.id}>
                <Link href={`/profile/${o.id}`}>{o.name}</Link>
                <small>
                  {o.rating} points · puissance {o.power}
                </small>
                <button
                  className="primary"
                  disabled={busy || data.attacksLeft <= 0 || dirty}
                  onClick={() =>
                    run(async () => {
                      if (pendingAttack.current?.defenderId !== o.id)
                        pendingAttack.current = {
                          defenderId: o.id,
                          battleId: crypto.randomUUID(),
                        };
                      try {
                        const view = await call({
                          action: 'attack',
                          battleId: pendingAttack.current.battleId,
                          defenderId: o.id,
                        });
                        pendingAttack.current = null;
                        setBattle(view);
                      } catch (e) {
                        // Réponse du serveur reçue : le prochain essai est une
                        // nouvelle attaque. Coupure réseau : on garde l'identifiant.
                        if ((e as { status?: number }).status)
                          pendingAttack.current = null;
                        throw e;
                      }
                    })
                  }
                >
                  <Swords size={14} aria-hidden="true" /> Attaquer
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>Personne d’autre dans votre ligue pour l’instant.</p>
        )}
      </section>

      <section className="panel" aria-labelledby="arena-ranking-title">
        <div className="section-title">
          <h2 id="arena-ranking-title">
            <Trophy size={18} aria-hidden="true" /> Classement par ligue
          </h2>
        </div>
        <div className="quest-tabs" role="tablist" aria-label="Ligue">
          {leagues.map((l) => (
            <button
              key={l.id}
              role="tab"
              aria-selected={tab === l.id}
              className={tab === l.id ? 'active' : ''}
              onClick={() => setTab(l.id)}
            >
              {l.name}
            </button>
          ))}
        </div>
        {data.leaderboards[tab]?.length ? (
          <ol className="ranking">
            {data.leaderboards[tab].map((row, i) => (
              <li key={row.id} className={row.id === playerId ? 'me' : ''}>
                <span className="ranking-place">{i + 1}</span>
                <Link href={`/profile/${row.id}`}>{row.name}</Link>
                <small>
                  {row.wins} V · {row.losses} D
                  {i < pvpRules.monthlyRewards.length
                    ? ` · +${pvpRules.monthlyRewards[i].toLocaleString('fr-FR')} Munny`
                    : ''}
                </small>
                <strong>{row.rating} points</strong>
              </li>
            ))}
          </ol>
        ) : (
          <p>Aucun combattant classé dans cette ligue.</p>
        )}
      </section>

      {data.recent.length > 0 && (
        <section className="panel" aria-labelledby="arena-recent-title">
          <h2 id="arena-recent-title">Derniers combats</h2>
          <ul className="arena-recent">
            {data.recent.map((b) => {
              const mine = b.attackerId === playerId ? 'a' : 'b';
              const side =
                mine === 'a' ? b.result?.attacker : b.result?.defender;
              const outcome =
                b.winner === 'draw'
                  ? 'Nul'
                  : b.winner === mine
                    ? 'Victoire'
                    : 'Défaite';
              const delta = side ? side.after - side.before : 0;
              return (
                <li
                  key={b.id}
                  className={
                    outcome === 'Victoire'
                      ? 'won'
                      : outcome === 'Défaite'
                        ? 'lost'
                        : ''
                  }
                >
                  <strong>{outcome}</strong>
                  <span>
                    {mine === 'a'
                      ? `contre ${b.defenderName}`
                      : `défense contre ${b.attackerName}`}
                    {b.result?.reason === 'abandon' ? ' · abandon' : ''}
                  </span>
                  <small>
                    {delta >= 0 ? '+' : ''}
                    {delta}
                  </small>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
