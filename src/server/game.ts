import { liveCatalog } from '../game/catalog';
import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { claimBonus, assertWallet } from '../game/finance';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { pool } from './postgres';
export { pool } from './postgres';
export { ensurePlayer } from './players';
import { AuthenticationRequired, discordId } from './auth-policy';
import { PlayerSuspended, staffRole } from './permissions';
import { economy } from '../game/config';
import { boosts, boostDuration, summonOdds } from '../game/boosts';
import { showcaseLimit } from '../game/showcase';
import { playerMissions } from './missions';
import { playerQuests } from './quests';
import { pruneQuestClaims } from '../game/quests';
import {
  fusion,
  fusionCost,
  fusionFodder,
  fusionRank,
  statKeys,
  unspentPoints,
  type StatKey,
} from '../game/stats';
import { walletAuditContext } from './wallet-audit';
import {
  caps,
  draw,
  rarities,
  requireFunds,
  type Card,
  type Player,
} from '../game/core';

export async function identity() {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!discordId(id)) throw new AuthenticationRequired();
  const account = (
    await pool.query(
      'SELECT state#>>\'{moderation,suspended}\' AS suspended FROM "Player" WHERE id=$1',
      [id],
    )
  ).rows[0];
  if (account?.suspended === 'true') throw new PlayerSuspended();
  return { id, name: session?.user?.name ?? 'Voyageur' };
}
export async function catalog(db: Pool | PoolClient = pool): Promise<Card[]> {
  return liveCatalog(
    (await db.query('SELECT cards FROM "Catalogue" WHERE id=$1', ['standard']))
      .rows[0]?.cards ?? [],
  );
}
export async function snapshot(id: string) {
  const player = (
    await pool.query('SELECT id,name,state FROM "Player" WHERE id=$1', [id])
  ).rows[0];
  const history = (
    await pool.query(
      'SELECT kind,delta,result,"createdAt" FROM (SELECT kind,delta::bigint,result,"createdAt",id FROM "Operation" WHERE "playerId"=$1 UNION ALL SELECT kind,delta,result,"createdAt",id FROM "EconomyOperation" WHERE "playerId"=$1) logs ORDER BY "createdAt" DESC,id DESC LIMIT 30',
      [id],
    )
  ).rows;
  return {
    ...player,
    staffRole: staffRole(id),
    cards: await catalog(),
    history: history.map((row) => ({ ...row, delta: Number(row.delta) })),
    missions: player ? await playerMissions(pool, id, player.state) : [],
    quests: player
      ? await playerQuests(pool, id, player.state, await catalog())
      : [],
  };
}
export async function mutate(
  id: string,
  key: string,
  kind: string,
  payload: Record<string, unknown>,
) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const row = (
      await db.query('SELECT state FROM "Player" WHERE id=$1 FOR UPDATE', [id])
    ).rows[0];
    if (!row) throw new Error('Profil introuvable');
    const old = (
      await db.query(
        'SELECT kind,result,request FROM "Operation" WHERE "playerId"=$1 AND key=$2',
        [id, key],
      )
    ).rows[0];
    if (old) {
      if (old.kind !== kind || !isDeepStrictEqual(old.request, payload))
        throw new Error('Clé déjà utilisée pour une autre requête');
      await db.query('COMMIT');
      return old.result;
    }
    const p: Player = row.state;
    await walletAuditContext(db, {
      source: 'site',
      kind,
      actor: id,
      reference: key,
    });
    if (p.moderation?.suspended) throw new PlayerSuspended();
    const before = p.munny;
    const resourceBefore = {
      munny: p.munny,
      tickets: p.tickets,
      fragments: p.fragments,
    };
    const cards = await catalog(db);
    let result: unknown = { success: true };
    const now = Date.now();
    if (kind === 'daily') {
      result = claimBonus(p, 'daily', now);
    } else if (kind === 'summon') {
      if (cards.length !== 150)
        throw new Error(
          'Le catalogue officiel de 150 cartes doit être importé',
        );
      const mode = payload.mode;
      if (!['single', 'multi', 'ticket'].includes(String(mode)))
        throw new Error('Mode invalide');
      const boosters = mode === 'multi' ? 10 : 1;
      const count = boosters * economy.cardsPerBooster;
      if (mode === 'ticket') {
        if (p.tickets < 1) throw new Error('Ticket insuffisant');
        p.tickets--;
      } else requireFunds(p, boosters * economy.summon);
      const odds = summonOdds(p.boost, now);
      const copies = Array.from({ length: count }, () => ({
        ...draw(cards, undefined, odds),
        id: randomUUID(),
        level: 1,
        awakening: 0,
        locked: false,
        favorite: false,
      }));
      p.copies.push(...copies);
      p.discoveries = [
        ...new Set([...(p.discoveries ?? []), ...copies.map((c) => c.cardId)]),
      ];
      p.holoDiscoveries = [
        ...new Set([
          ...(p.holoDiscoveries ?? []),
          ...copies.filter((c) => c.holo).map((c) => c.cardId),
        ]),
      ];
      p.summons += count;
      const version = (
        await db.query('SELECT version FROM "Catalogue" WHERE id=$1', [
          'standard',
        ])
      ).rows[0].version;
      result = {
        copies,
        boosterCount: boosters,
        cardsPerBooster: economy.cardsPerBooster,
        rateVersion: odds.active
          ? `standard-v2-${odds.active.kind}`
          : 'standard-v2',
        catalogueVersion: version,
        rates: odds.rates,
        holoRate: odds.holoRate,
        ...(odds.active ? { boost: odds.active } : {}),
      };
    } else if (kind === 'shop') {
      if (payload.item === 'ticket') {
        requireFunds(p, economy.summon);
        p.tickets++;
      } else if (payload.item === 'fragments') {
        requireFunds(p, economy.fragmentPackCost);
        p.fragments += economy.fragmentPack;
      } else if (
        payload.item === 'boost-rare' ||
        payload.item === 'boost-holo'
      ) {
        if (summonOdds(p.boost, now).active)
          throw new Error(
            'Un boost est déjà actif. Attendez sa fin avant le prochain achat.',
          );
        const boostKind = payload.item === 'boost-rare' ? 'rare' : 'holo';
        requireFunds(p, boosts[boostKind].cost);
        p.boost = { kind: boostKind, expiresAt: now + boostDuration };
      } else throw new Error('Article inconnu');
    } else if (kind === 'showcase') {
      const selection = payload.copies;
      if (
        !Array.isArray(selection) ||
        selection.length > showcaseLimit ||
        new Set(selection).size !== selection.length ||
        selection.some(
          (id) =>
            typeof id !== 'string' || !p.copies.some((copy) => copy.id === id),
        )
      ) {
        throw new Error(
          'Sélectionnez jusqu’à cinq exemplaires de votre collection.',
        );
      }
      p.showcase = selection;
    } else if (kind === 'mission') {
      const mission = (await playerMissions(db, id, p, new Date(now))).find(
        (m) => m.id === payload.mission,
      );
      if (!mission?.claimable) throw new Error('Mission non disponible');
      p.claimed.push(mission.claimKey);
      p.munny += mission.munny;
      p.tickets += mission.tickets;
      p.fragments += mission.fragments;
      result = {
        success: true,
        missionId: mission.id,
        claimKey: mission.claimKey,
      };
    } else if (kind === 'wishlist') {
      if (
        typeof payload.cardId !== 'string' ||
        typeof payload.wanted !== 'boolean' ||
        !(await catalog(db)).some((card) => card.id === payload.cardId)
      )
        throw new Error('Carte ou préférence invalide');
      const wanted = new Set(p.wishlist ?? []);
      if (payload.wanted) wanted.add(payload.cardId);
      else wanted.delete(payload.cardId);
      p.wishlist = [...wanted];
    } else if (kind === 'quest') {
      const cycle = payload.cycle;
      if (cycle !== 'daily' && cycle !== 'weekly')
        throw new Error('Quête invalide');
      const quest = (await playerQuests(db, id, p, cards, new Date(now))).find(
        (q) => q.id === payload.quest && q.cycle === cycle,
      );
      if (!quest?.claimable) throw new Error('Quête non disponible');
      p.claimed = [
        ...pruneQuestClaims(p.claimed, new Date(now)),
        quest.claimKey,
      ];
      p.munny += quest.munny;
      result = { success: true, questId: quest.id, munny: quest.munny };
    } else if (kind === 'fuse') {
      const target = p.copies.find((c) => c.id === payload.copyId);
      const fodder = p.copies.find((c) => c.id === payload.duplicateId);
      if (!target || !fodder) throw new Error('Exemplaire introuvable');
      if (fusionRank(target) >= fusion.maxRank)
        throw new Error('Fusion maximale atteinte');
      if (!fusionFodder(fodder, target))
        throw new Error(
          'Le doublon doit être un exemplaire standard du même modèle, ni verrouillé, ni favori.',
        );
      requireFunds(p, fusionCost(target));
      p.copies = p.copies.filter((c) => c.id !== fodder.id);
      if (p.showcase) p.showcase = p.showcase.filter((c) => c !== fodder.id);
      target.fusion = fusionRank(target) + 1;
      result = { success: true, copyId: target.id, fusion: target.fusion };
    } else if (kind === 'allocate') {
      const target = p.copies.find((c) => c.id === payload.copyId);
      const stat = payload.stat;
      if (!target) throw new Error('Exemplaire introuvable');
      if (!statKeys.includes(stat as StatKey))
        throw new Error('Statistique invalide');
      if (unspentPoints(target) < 1) throw new Error('Aucun point à répartir');
      target.bonus = {
        ...target.bonus,
        [stat as StatKey]: (target.bonus?.[stat as StatKey] ?? 0) + 1,
      };
      result = { success: true, copyId: target.id, stat };
    } else if (kind === 'settings') {
      if (
        Object.keys(payload).length !== 1 ||
        (typeof payload.reducedMotion !== 'boolean' &&
          typeof payload.auctionNotifications !== 'boolean')
      )
        throw new Error('Préférence invalide');
      if (typeof payload.reducedMotion === 'boolean')
        p.reducedMotion = payload.reducedMotion;
      else p.auctionNotifications = payload.auctionNotifications as boolean;
    } else {
      const copy = p.copies.find((c) => c.id === payload.copyId);
      if (!copy) throw new Error('Exemplaire introuvable');
      if (kind === 'lock') copy.locked = !copy.locked;
      else if (kind === 'favorite') copy.favorite = !copy.favorite;
      else {
        if (copy.locked) throw new Error('Carte verrouillée');
        if (kind === 'recycle') {
          p.copies = p.copies.filter((c) => c.id !== copy.id);
          p.fragments += economy.recycleFragments;
        } else if (kind === 'upgrade') {
          const card = cards.find((c) => c.id === copy.cardId);
          if (!card || copy.level >= caps[rarities.indexOf(card.rarity)])
            throw new Error('Niveau maximum atteint');
          if (p.fragments < economy.levelFragments)
            throw new Error('Fragments insuffisants');
          requireFunds(p, copy.level * economy.levelCost);
          p.fragments -= economy.levelFragments;
          copy.level++;
        } else if (kind === 'awaken') {
          if (copy.awakening >= 5) throw new Error('Éveil maximum atteint');
          const needed = economy.awakeningDuplicates[copy.awakening];
          const duplicates = p.copies
            .filter(
              (c) =>
                c.id !== copy.id &&
                c.cardId === copy.cardId &&
                !c.locked &&
                !c.favorite &&
                c.level === 1 &&
                c.awakening === 0 &&
                !c.holo,
            )
            .slice(0, needed);
          if (payload.alternative === true) {
            if (p.fragments < needed * economy.alternativeFragments)
              throw new Error('Fragments insuffisants');
            p.fragments -= needed * economy.alternativeFragments;
          } else {
            if (duplicates.length !== needed)
              throw new Error('Doublons standards disponibles insuffisants');
            p.copies = p.copies.filter(
              (c) => !duplicates.some((d) => d.id === c.id),
            );
          }
          requireFunds(p, needed * economy.awakeningMunny);
          copy.awakening++;
        } else throw new Error('Action inconnue');
      }
    }
    assertWallet(p);
    result = {
      ...(result as Record<string, unknown>),
      resources: {
        before: resourceBefore,
        after: { munny: p.munny, tickets: p.tickets, fragments: p.fragments },
      },
    };
    await db.query('UPDATE "Player" SET state=$2 WHERE id=$1', [
      id,
      JSON.stringify(p),
    ]);
    await db.query(
      'INSERT INTO "Operation" (id,"playerId",key,kind,delta,result,request) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [
        randomUUID(),
        id,
        key,
        kind,
        p.munny - before,
        JSON.stringify(result),
        JSON.stringify(payload),
      ],
    );
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}
