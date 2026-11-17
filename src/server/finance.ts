import { randomInt, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Pool, PoolClient } from 'pg';
import type { Player } from '../game/core';
import { walletAuditContext } from './wallet-audit';
import {
  matchesAnswer,
  type ChallengeContent,
} from '../../bot/challenge-content';
import {
  FinanceError,
  amountFrom,
  assertWallet,
  claimBonus,
  bankMove,
  financeView,
  reserve,
  release,
  safeAmount,
  rouletteChoice,
  rouletteResult,
  type Bonus,
} from '../game/finance';
export type GameKind = 'guess' | 'coinflip' | 'dice';
export type GameState = {
  stake: number;
  guildId?: string;
  side?: 'pile' | 'face';
  secret?: number;
  attempts?: { number: number; hint: string }[];
  winner?: string | null;
  rolls?: number[];
  coin?: string;
  payout?: number;
};
export type SavedGame = {
  id: string;
  authorId: string;
  opponentId: string | null;
  kind: GameKind;
  status:
    | 'pending'
    | 'active'
    | 'won'
    | 'lost'
    | 'settled'
    | 'declined'
    | 'expired'
    | 'abandoned';
  state: GameState;
  expiresAt: Date | null;
};
export type PublicGame = Omit<SavedGame, 'state' | 'expiresAt'> & {
  state: Omit<GameState, 'secret'> & { answer?: number };
  expiresAt: number | null;
};
export type FinanceResult = {
  kind: string;
  wallet: number;
  amount?: number;
  bonus?: Bonus;
  nextAt?: number;
  game?: PublicGame;
  double?: { stake: number; won: boolean; payout: number };
  roulette?: {
    number: number;
    color: string;
    won: boolean;
    payout: number;
    stake: number;
  };
  bank?: string;
  games?: PublicGame[];
};
export function publicGame(game: SavedGame): PublicGame {
  const { secret, ...state } = game.state;
  return {
    ...game,
    expiresAt: game.expiresAt?.getTime() ?? null,
    state: {
      ...state,
      ...(game.kind === 'guess' && game.status !== 'active'
        ? { answer: secret }
        : {}),
    },
  };
}
function validateId(id: string) {
  if (!/^\d{17,20}$/.test(id))
    throw new FinanceError('Identifiant Discord invalide.');
}
function validateKey(key: string) {
  if (!/^[a-zA-Z0-9:_-]{1,150}$/.test(key))
    throw new FinanceError('Identifiant de requête invalide.');
}
export class FinanceService {
  constructor(
    private pool: Pool,
    private now: () => number = Date.now,
    private rng: (max: number) => number = randomInt,
  ) {}
  private async transaction(
    actor: string,
    key: string,
    kind: string,
    request: Record<string, unknown>,
    work: (
      db: PoolClient,
      load: (
        ids: string[],
        allowSuspended?: boolean,
      ) => Promise<Map<string, Player>>,
      now: number,
    ) => Promise<Omit<FinanceResult, 'wallet' | 'kind'>>,
  ) {
    validateId(actor);
    validateKey(key);
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      await db.query(
        "SELECT pg_advisory_xact_lock(hashtext('sorarng-finance-v1'))",
      );
      const old = (
        await db.query(
          'SELECT kind,request,result FROM "EconomyOperation" WHERE "playerId"=$1 AND key=$2',
          [actor, key],
        )
      ).rows[0];
      if (old) {
        if (old.kind !== kind || !isDeepStrictEqual(old.request, request))
          throw new FinanceError(
            'Identifiant déjà utilisé pour une autre action.',
          );
        await db.query('COMMIT');
        return old.result as FinanceResult;
      }
      const loaded = new Map<string, Player>(),
        before = new Map<string, Player>();
      const load = async (ids: string[], allowSuspended = false) => {
        const wanted = [...new Set(ids)].sort();
        wanted.forEach(validateId);
        const missing = wanted.filter((id) => !loaded.has(id));
        if (missing.length) {
          const rows = (
            await db.query(
              'SELECT id,state FROM "Player" WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',
              [missing],
            )
          ).rows;
          for (const row of rows) {
            loaded.set(row.id, row.state);
            before.set(row.id, structuredClone(row.state));
          }
        }
        for (const id of wanted) {
          const p = loaded.get(id);
          if (!p)
            throw new FinanceError(
              'Profil absent. Connectez-vous au site avec ce compte Discord.',
            );
          if (!allowSuspended && p.moderation?.suspended)
            throw new FinanceError('Ce compte est suspendu.');
          assertWallet(p);
        }
        return loaded;
      };
      const extra = await work(db, load, this.now());
      await walletAuditContext(db, {
        source: 'economy',
        kind,
        actor,
        reference: key,
      });
      if (!loaded.has(actor)) await load([actor]);
      const result = JSON.parse(
        JSON.stringify({ kind, wallet: loaded.get(actor)!.munny, ...extra }),
      ) as FinanceResult;
      for (const [id, p] of loaded) {
        assertWallet(p);
        const original = before.get(id)!;
        if (!isDeepStrictEqual(original, p))
          await db.query('UPDATE "Player" SET state=$2 WHERE id=$1', [
            id,
            JSON.stringify(p),
          ]);
        if (id === actor || !isDeepStrictEqual(original, p))
          await db.query(
            'INSERT INTO "EconomyOperation" (id,"playerId",key,kind,delta,request,result) VALUES ($1,$2,$3,$4,$5,$6,$7)',
            [
              randomUUID(),
              id,
              key,
              kind,
              BigInt(p.munny) - BigInt(original.munny),
              JSON.stringify(request),
              JSON.stringify({ ...result, wallet: p.munny }),
            ],
          );
      }
      await db.query('COMMIT');
      return result;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
  }
  private async game(db: PoolClient, id: unknown) {
    if (typeof id !== 'string' || !/^[-a-f0-9]{36}$/.test(id))
      throw new FinanceError('Partie invalide.');
    const game = (
      await db.query('SELECT * FROM "EconomyGame" WHERE id=$1 FOR UPDATE', [id])
    ).rows[0] as SavedGame | undefined;
    if (!game) throw new FinanceError('Partie introuvable.');
    return game;
  }
  private async save(db: PoolClient, game: SavedGame) {
    await db.query('UPDATE "EconomyGame" SET status=$2,state=$3 WHERE id=$1', [
      game.id,
      game.status,
      JSON.stringify(game.state),
    ]);
  }
  private async expire(
    db: PoolClient,
    game: SavedGame,
    players: Map<string, Player>,
    now: number,
  ) {
    if (game.status === 'pending' && game.expiresAt!.getTime() <= now) {
      release(
        players.get(game.authorId)!,
        game.state.stake,
        2,
        game.state.stake,
      );
      game.status = 'expired';
      await this.save(db, game);
      return true;
    }
    return false;
  }
  async view(id: string) {
    validateId(id);
    const row = (
      await this.pool.query('SELECT state FROM "Player" WHERE id=$1', [id])
    ).rows[0];
    if (!row)
      throw new FinanceError(
        'Profil absent. Connectez-vous au site avec ce compte Discord.',
      );
    if (row.state.moderation?.suspended)
      throw new FinanceError('Ce compte est suspendu.');
    return financeView(row.state, this.now());
  }
  async resume(id: string) {
    validateId(id);
    const view = await this.view(id);
    const games = (
      await this.pool.query(
        'SELECT * FROM "EconomyGame" WHERE ("authorId"=$1 OR "opponentId"=$1) AND status=ANY($2::text[]) ORDER BY "createdAt" DESC LIMIT 5',
        [id, ['active', 'pending']],
      )
    ).rows as SavedGame[];
    return {
      kind: 'resume',
      wallet: view.wallet,
      games: games.map(publicGame),
    } satisfies FinanceResult;
  }
  async action(
    actor: string,
    key: string,
    kind: string,
    input: Record<string, unknown> = {},
  ): Promise<FinanceResult> {
    return this.transaction(actor, key, kind, input, async (db, load, now) => {
      if (kind === 'challenge.answer') {
        const round = (
          await db.query(
            'SELECT * FROM "ChatChallenge" WHERE id=$1 FOR UPDATE',
            [input.id],
          )
        ).rows[0];
        if (
          !round ||
          round.status !== 'published' ||
          new Date(round.expiresAt).getTime() <= now ||
          round.guildId !== input.guildId ||
          round.channelId !== input.channelId ||
          typeof input.answer !== 'string' ||
          input.answer.length > 200 ||
          typeof input.messageId !== 'string' ||
          !/^\d{17,20}$/.test(input.messageId) ||
          typeof input.sentAt !== 'number' ||
          input.sentAt < new Date(round.publishedAt).getTime() ||
          input.sentAt > now ||
          !matchesAnswer(round.content as ChallengeContent, input.answer)
        )
          throw new FinanceError('Défi non disponible ou réponse incorrecte.');
        const p = (await load([actor])).get(actor)!;
        p.munny = safeAmount(BigInt(p.munny) + 250n);
        assertWallet(p);
        await db.query(
          'UPDATE "ChatChallenge" SET status=$2,"winnerId"=$3,"winningMessageId"=$4 WHERE id=$1',
          [round.id, 'won', actor, input.messageId],
        );
        return { amount: 250 };
      }
      if (kind === 'donate') {
        if (typeof input.recipient !== 'string' || input.recipient === actor)
          throw new FinanceError('Choisissez un autre membre.');
        const players = await load([actor, input.recipient]);
        const sender = players.get(actor)!,
          recipient = players.get(input.recipient)!;
        const amount = amountFrom(input.amount, sender.munny);
        sender.munny -= amount;
        recipient.munny = safeAmount(BigInt(recipient.munny) + BigInt(amount));
        assertWallet(recipient);
        return { amount };
      }
      if (kind === 'bonus') {
        const p = (await load([actor])).get(actor)!;
        if (
          !['hourly', 'daily', 'weekly', 'monthly'].includes(String(input.type))
        )
          throw new FinanceError('Bonus inconnu.');
        const reward = claimBonus(p, input.type as Bonus, now);
        return {
          amount: reward.amount,
          bonus: reward.type,
          nextAt: reward.nextAt,
        };
      }
      if (kind === 'deposit' || kind === 'withdraw') {
        const p = (await load([actor])).get(actor)!;
        const amount = bankMove(p, kind, input.amount, now);
        return { amount, bank: financeView(p, now).bank };
      }
      if (kind === 'double') {
        const p = (await load([actor])).get(actor)!;
        const stake = amountFrom(input.amount, p.munny);
        reserve(p, stake, 2, now);
        const won = this.rng(2) === 1;
        const payout = won ? safeAmount(BigInt(stake) * 2n) : 0;
        release(p, stake, 2, payout);
        return { double: { stake, won, payout } };
      }
      if (kind === 'roulette') {
        const p = (await load([actor])).get(actor)!,
          stake = amountFrom(input.amount, p.munny),
          choice = rouletteChoice(input.choice);
        const multiplier = ['rouge', 'noir'].includes(choice) ? 2 : 36;
        reserve(p, stake, multiplier, now);
        const roll = rouletteResult(choice, this.rng(37));
        const payout = roll.won
          ? safeAmount(BigInt(stake) * BigInt(multiplier))
          : 0;
        release(p, stake, multiplier, payout);
        return {
          roulette: {
            number: roll.number,
            color: roll.color,
            won: roll.won,
            payout,
            stake,
          },
        };
      }
      if (kind === 'guess.start') {
        const p = (await load([actor])).get(actor)!;
        const old = (
          await db.query(
            'SELECT * FROM "EconomyGame" WHERE "authorId"=$1 AND kind=$2 AND status=$3 ORDER BY "createdAt" LIMIT 1',
            [actor, 'guess', 'active'],
          )
        ).rows[0] as SavedGame | undefined;
        if (old) return { game: publicGame(old) };
        const stake = amountFrom(input.amount, p.munny);
        reserve(p, stake, 3, now);
        const game: SavedGame = {
          id: randomUUID(),
          authorId: actor,
          opponentId: null,
          kind: 'guess',
          status: 'active',
          expiresAt: null,
          state: { stake, secret: this.rng(100) + 1, attempts: [] },
        };
        await db.query(
          'INSERT INTO "EconomyGame" (id,"authorId",kind,status,state) VALUES ($1,$2,$3,$4,$5)',
          [game.id, actor, game.kind, game.status, JSON.stringify(game.state)],
        );
        return { game: publicGame(game) };
      }
      if (kind === 'guess.attempt' || kind === 'guess.abandon') {
        const game = await this.game(db, input.id);
        if (game.authorId !== actor || game.kind !== 'guess')
          throw new FinanceError('Cette partie ne vous appartient pas.');
        const p = (await load([actor])).get(actor)!;
        if (game.status !== 'active') return { game: publicGame(game) };
        if (kind === 'guess.abandon') {
          game.status = 'abandoned';
          release(p, game.state.stake, 3, 0);
          await this.save(db, game);
          return { game: publicGame(game) };
        }
        const guess = input.number;
        if (
          typeof guess !== 'number' ||
          !Number.isInteger(guess) ||
          guess < 1 ||
          guess > 100
        )
          throw new FinanceError('Choisissez un nombre de 1 à 100.');
        if (game.state.attempts!.some((a) => a.number === guess))
          throw new FinanceError('Ce nombre a déjà été essayé.');
        const found = guess === game.state.secret;
        game.state.attempts!.push({
          number: guess,
          hint: found
            ? 'Trouvé'
            : guess < game.state.secret!
              ? 'Plus haut'
              : 'Plus bas',
        });
        if (found || game.state.attempts!.length >= 5) {
          game.status = found ? 'won' : 'lost';
          game.state.payout = found
            ? safeAmount(BigInt(game.state.stake) * 3n)
            : 0;
          release(p, game.state.stake, 3, game.state.payout);
        }
        await this.save(db, game);
        return { game: publicGame(game) };
      }
      if (kind === 'duel.start') {
        const opponent = input.opponent,
          guildId = input.guildId;
        if (typeof opponent !== 'string' || opponent === actor)
          throw new FinanceError('Choisissez un autre joueur.');
        if (typeof guildId !== 'string' || !/^\d{17,20}$/.test(guildId))
          throw new FinanceError(
            'Les défis se jouent dans un serveur Discord.',
          );
        if (!['coinflip', 'dice'].includes(String(input.game)))
          throw new FinanceError('Jeu invalide.');
        if (
          input.side !== undefined &&
          !['pile', 'face'].includes(String(input.side))
        )
          throw new FinanceError('Côté invalide.');
        const players = await load([actor, opponent]),
          p = players.get(actor)!;
        const pending = (
          await db.query(
            'SELECT id FROM "EconomyGame" WHERE "authorId"=$1 AND status=$2 LIMIT 1',
            [actor, 'pending'],
          )
        ).rows[0];
        if (pending)
          throw new FinanceError(
            'Vous avez déjà un défi en attente. Utilisez ses boutons ou attendez son expiration.',
          );
        const stake = amountFrom(input.amount, p.munny);
        reserve(p, stake, 2, now);
        const game: SavedGame = {
          id: randomUUID(),
          authorId: actor,
          opponentId: opponent,
          kind: input.game as GameKind,
          status: 'pending',
          expiresAt: new Date(now + 120000),
          state: {
            stake,
            side: input.side === 'face' ? 'face' : 'pile',
            guildId,
          },
        };
        await db.query(
          'INSERT INTO "EconomyGame" (id,"authorId","opponentId",kind,status,state,"expiresAt") VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [
            game.id,
            actor,
            opponent,
            game.kind,
            game.status,
            JSON.stringify(game.state),
            game.expiresAt,
          ],
        );
        return { game: publicGame(game) };
      }
      if (
        kind === 'duel.accept' ||
        kind === 'duel.decline' ||
        kind === 'duel.expire'
      ) {
        const game = await this.game(db, input.id);
        if (!['coinflip', 'dice'].includes(game.kind))
          throw new FinanceError('Défi invalide.');
        if (kind === 'duel.expire' && actor !== game.authorId)
          throw new FinanceError('Défi invalide.');
        if (![game.authorId, game.opponentId].includes(actor))
          throw new FinanceError('Ce défi ne vous concerne pas.');
        if (kind === 'duel.accept' && actor !== game.opponentId)
          throw new FinanceError('Seul le joueur invité peut accepter.');
        if (kind !== 'duel.expire' && input.guildId !== game.state.guildId)
          throw new FinanceError(
            'Utilisez le défi dans son serveur d’origine.',
          );
        const players = await load(
          [game.authorId, game.opponentId!],
          kind !== 'duel.accept',
        );
        if (game.status !== 'pending') return { game: publicGame(game) };
        if (await this.expire(db, game, players, now))
          return { game: publicGame(game) };
        if (kind === 'duel.expire')
          throw new FinanceError('Ce défi n’a pas encore expiré.');
        const author = players.get(game.authorId)!,
          opponent = players.get(game.opponentId!)!;
        if (kind === 'duel.decline') {
          release(author, game.state.stake, 2, game.state.stake);
          game.status = 'declined';
        } else {
          reserve(opponent, game.state.stake, 2, now);
          let winner: string | null;
          if (game.kind === 'coinflip') {
            game.state.coin = this.rng(2) ? 'face' : 'pile';
            winner =
              game.state.coin === game.state.side
                ? game.authorId
                : game.opponentId;
          } else {
            game.state.rolls = [this.rng(6) + 1, this.rng(6) + 1];
            winner =
              game.state.rolls[0] === game.state.rolls[1]
                ? null
                : game.state.rolls[0] > game.state.rolls[1]
                  ? game.authorId
                  : game.opponentId;
          }
          game.state.winner = winner;
          game.status = 'settled';
          const pot = safeAmount(BigInt(game.state.stake) * 2n);
          release(
            author,
            game.state.stake,
            2,
            winner === null
              ? game.state.stake
              : winner === game.authorId
                ? pot
                : 0,
          );
          release(
            opponent,
            game.state.stake,
            2,
            winner === null
              ? game.state.stake
              : winner === game.opponentId
                ? pot
                : 0,
          );
        }
        await this.save(db, game);
        return { game: publicGame(game) };
      }
      throw new FinanceError('Action économique inconnue.');
    });
  }
  async expireDue() {
    const now = this.now();
    const rows = (
      await this.pool.query(
        'SELECT id,"authorId" FROM "EconomyGame" WHERE status=$1 AND "expiresAt"<=$2 ORDER BY "expiresAt" LIMIT 100',
        ['pending', new Date(now)],
      )
    ).rows;
    for (const row of rows)
      await this.action(row.authorId, 'expire:' + row.id, 'duel.expire', {
        id: row.id,
      });
    return rows.length;
  }
}
