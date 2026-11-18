import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { Card, Player } from '../game/core';
import { requireFunds } from '../game/core';
import {
  announcementKinds,
  boardRules,
  cleanAnnouncement,
  cleanGuildName,
  guildClaimKey,
  guildRules,
  guildWeek,
  previousGuildWeek,
  type AnnouncementKind,
} from '../game/community';

type Db = Pool | PoolClient;

// Total d'une guilde pour une semaine, depuis les contributions conservées :
// les ouvertures d'un membre parti restent acquises à la guilde.
export async function guildBoosters(db: Db, guildId: string, week: string) {
  const row = (
    await db.query(
      'SELECT COALESCE(SUM(boosters),0)::int AS boosters FROM "GuildContribution" WHERE "guildId"=$1 AND week=$2',
      [guildId, week],
    )
  ).rows[0];
  return Number(row.boosters) || 0;
}

// Appelée dans la transaction d'une ouverture : la contribution va à la guilde
// du joueur à cet instant, et à elle seule (un joueur n'a qu'une guilde).
export async function recordGuildContribution(
  db: PoolClient,
  playerId: string,
  boosters: number,
  now: number,
) {
  const member = (
    await db.query('SELECT "guildId" FROM "GuildMember" WHERE "playerId"=$1', [
      playerId,
    ])
  ).rows[0];
  if (!member) return;
  await db.query(
    `INSERT INTO "GuildContribution" ("guildId","playerId",week,boosters) VALUES ($1,$2,$3,$4)
     ON CONFLICT ("guildId","playerId",week)
     DO UPDATE SET boosters="GuildContribution".boosters+EXCLUDED.boosters,"updatedAt"=now()`,
    [member.guildId, playerId, guildWeek(new Date(now)).key, boosters],
  );
}

export async function membership(db: Db, playerId: string) {
  return (
    await db.query(
      'SELECT m."guildId",m."joinedAt",g.name,g."ownerId" FROM "GuildMember" m JOIN "Guild" g ON g.id=m."guildId" WHERE m."playerId"=$1',
      [playerId],
    )
  ).rows[0] as
    | { guildId: string; joinedAt: Date; name: string; ownerId: string }
    | undefined;
}

export async function guildOverview(
  db: Db,
  playerId: string,
  now = new Date(),
) {
  const mine = await membership(db, playerId);
  const week = guildWeek(now);
  const previous = previousGuildWeek(now);
  const guilds = (
    await db.query(
      `SELECT g.id,g.name,g."ownerId",o.name AS "ownerName",count(m."playerId")::int AS members
         FROM "Guild" g JOIN "Player" o ON o.id=g."ownerId"
         LEFT JOIN "GuildMember" m ON m."guildId"=g.id
        GROUP BY g.id,o.name ORDER BY members DESC,g."createdAt" LIMIT 100`,
    )
  ).rows;
  if (!mine) return { guilds, mine: null };
  const members = (
    await db.query(
      `SELECT m."playerId" AS id,p.name,m."joinedAt" FROM "GuildMember" m JOIN "Player" p ON p.id=m."playerId"
        WHERE m."guildId"=$1 ORDER BY m."joinedAt"`,
      [mine.guildId],
    )
  ).rows;
  const progress = await guildBoosters(db, mine.guildId, week.key);
  const last = await guildBoosters(db, mine.guildId, previous.key);
  return {
    guilds,
    mine: {
      id: mine.guildId,
      name: mine.name,
      ownerId: mine.ownerId,
      joinedAt: mine.joinedAt,
      members,
      week: { key: week.key, endsAt: week.end, boosters: progress },
      previous: { key: previous.key, boosters: last },
    },
  };
}

export async function activeAnnouncements(db: Db) {
  return (
    await db.query(
      `SELECT a.id,a."playerId",p.name AS "playerName",a.kind,a.text,a."cardIds",a."createdAt",a."expiresAt"
         FROM "Announcement" a JOIN "Player" p ON p.id=a."playerId"
        WHERE a.status='active' AND a."expiresAt">now()
          AND COALESCE(p.state#>>'{moderation,suspended}','false')<>'true'
        ORDER BY a."createdAt" DESC LIMIT 100`,
    )
  ).rows;
}

// Actions appelées depuis la transaction de `mutate` : le joueur est déjà
// verrouillé, la clé d'idempotence vérifiée et le contexte d'audit posé.
export async function communityAction(
  db: PoolClient,
  id: string,
  p: Player,
  kind: string,
  payload: Record<string, unknown>,
  cards: Card[],
  now: number,
): Promise<Record<string, unknown>> {
  if (kind === 'announce') {
    const text = cleanAnnouncement(payload.text);
    const type = payload.kind as AnnouncementKind;
    if (!(type in announcementKinds))
      throw new Error('Type d’annonce invalide.');
    const cardIds = payload.cardIds ?? [];
    if (
      !Array.isArray(cardIds) ||
      cardIds.length > boardRules.maxCards ||
      new Set(cardIds).size !== cardIds.length ||
      cardIds.some((c) => !cards.some((card) => card.id === c))
    )
      throw new Error(`Jusqu’à ${boardRules.maxCards} cartes du catalogue.`);
    const active = (
      await db.query(
        `SELECT count(*)::int AS n FROM "Announcement" WHERE "playerId"=$1 AND status='active' AND "expiresAt">$2`,
        [id, new Date(now)],
      )
    ).rows[0].n;
    if (active >= boardRules.maxActive)
      throw new Error(`${boardRules.maxActive} annonces actives maximum.`);
    requireFunds(p, boardRules.cost);
    const announcement = randomUUID();
    await db.query(
      'INSERT INTO "Announcement" (id,"playerId",kind,text,"cardIds","createdAt","expiresAt") VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [
        announcement,
        id,
        type,
        text,
        JSON.stringify(cardIds),
        new Date(now),
        new Date(now + boardRules.durationMs),
      ],
    );
    return { success: true, announcementId: announcement };
  }
  if (kind === 'announce-remove') {
    const removed = await db.query(
      `UPDATE "Announcement" SET status='removed' WHERE id=$1 AND "playerId"=$2 AND status='active'`,
      [payload.id, id],
    );
    if (!removed.rowCount) throw new Error('Annonce introuvable.');
    return { success: true };
  }
  if (kind === 'guild-create') {
    const name = cleanGuildName(payload.name);
    if (await membership(db, id))
      throw new Error('Quittez votre guilde avant d’en créer une.');
    await db.query(
      "SELECT pg_advisory_xact_lock(hashtext('sorarng:guild-name'))",
    );
    if (
      (
        await db.query('SELECT 1 FROM "Guild" WHERE lower(name)=lower($1)', [
          name,
        ])
      ).rowCount
    )
      throw new Error('Ce nom de guilde est déjà pris.');
    requireFunds(p, guildRules.createCost);
    const guild = randomUUID();
    await db.query(
      'INSERT INTO "Guild" (id,name,"ownerId") VALUES ($1,$2,$3)',
      [guild, name, id],
    );
    await db.query(
      'INSERT INTO "GuildMember" ("playerId","guildId","joinedAt") VALUES ($1,$2,$3)',
      [id, guild, new Date(now)],
    );
    return { success: true, guildId: guild };
  }
  if (kind === 'guild-join') {
    if (await membership(db, id))
      throw new Error('Vous êtes déjà dans une guilde.');
    const guild = (
      await db.query('SELECT id FROM "Guild" WHERE id=$1 FOR UPDATE', [
        payload.guildId,
      ])
    ).rows[0];
    if (!guild) throw new Error('Guilde introuvable.');
    const count = (
      await db.query(
        'SELECT count(*)::int AS n FROM "GuildMember" WHERE "guildId"=$1',
        [guild.id],
      )
    ).rows[0].n;
    if (count >= guildRules.maxMembers)
      throw new Error('Cette guilde est complète.');
    await db.query(
      'INSERT INTO "GuildMember" ("playerId","guildId","joinedAt") VALUES ($1,$2,$3)',
      [id, guild.id, new Date(now)],
    );
    return { success: true, guildId: guild.id };
  }
  if (kind === 'guild-leave') {
    const mine = await membership(db, id);
    if (!mine) throw new Error('Vous n’êtes dans aucune guilde.');
    await db.query('SELECT id FROM "Guild" WHERE id=$1 FOR UPDATE', [
      mine.guildId,
    ]);
    await db.query('DELETE FROM "GuildMember" WHERE "playerId"=$1', [id]);
    if (mine.ownerId === id) {
      // Le plus ancien membre reprend la guilde ; sinon elle disparaît.
      const next = (
        await db.query(
          'SELECT "playerId" FROM "GuildMember" WHERE "guildId"=$1 ORDER BY "joinedAt" LIMIT 1',
          [mine.guildId],
        )
      ).rows[0];
      if (next)
        await db.query('UPDATE "Guild" SET "ownerId"=$2 WHERE id=$1', [
          mine.guildId,
          next.playerId,
        ]);
      else await db.query('DELETE FROM "Guild" WHERE id=$1', [mine.guildId]);
    }
    return { success: true };
  }
  if (kind === 'guild-kick') {
    const mine = await membership(db, id);
    if (!mine || mine.ownerId !== id)
      throw new Error('Seul le chef de guilde peut exclure un membre.');
    if (payload.playerId === id)
      throw new Error('Utilisez « Quitter la guilde ».');
    const kicked = await db.query(
      'DELETE FROM "GuildMember" WHERE "playerId"=$1 AND "guildId"=$2',
      [payload.playerId, mine.guildId],
    );
    if (!kicked.rowCount) throw new Error('Membre introuvable.');
    return { success: true };
  }
  if (kind === 'guild-reward') {
    const mine = await membership(db, id);
    if (!mine) throw new Error('Rejoignez une guilde pour cette récompense.');
    const previous = previousGuildWeek(new Date(now));
    const key = guildClaimKey(previous.key);
    if (p.claimed.includes(key)) throw new Error('Récompense déjà reçue.');
    if (
      new Date(mine.joinedAt).getTime() >
      previous.end.getTime() - guildRules.joinBeforeEndMs
    )
      throw new Error(
        'Il fallait avoir rejoint la guilde au moins 72 h avant la fin de la semaine.',
      );
    const boosters = await guildBoosters(db, mine.guildId, previous.key);
    if (boosters < guildRules.weeklyBoosters)
      throw new Error('L’objectif de la semaine passée n’a pas été atteint.');
    p.claimed.push(key);
    p.munny += guildRules.weeklyReward;
    return {
      success: true,
      week: previous.key,
      munny: guildRules.weeklyReward,
    };
  }
  throw new Error('Action inconnue');
}

export const communityKinds = [
  'announce',
  'announce-remove',
  'guild-create',
  'guild-join',
  'guild-leave',
  'guild-kick',
  'guild-reward',
] as const;
