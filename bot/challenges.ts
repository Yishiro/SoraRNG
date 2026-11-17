import { randomUUID } from 'node:crypto';
import {
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type Client,
  type ChatInputCommandInteraction,
  type Message,
  type TextChannel,
} from 'discord.js';
import type { Pool } from 'pg';
import { FinanceService } from '../src/server/finance';
import { FinanceError } from '../src/game/finance';
import {
  makeChallenge,
  matchesAnswer,
  type ChallengeContent,
} from './challenge-content';
const mentions = { parse: [] as never[] };
type Round = {
  id: string;
  guildId: string;
  channelId: string;
  content: ChallengeContent;
  status: string;
  messageId: string | null;
  expiresAt: Date;
  winnerId: string | null;
};
export class ChatChallenges {
  private readonly answers = new Map<string, Promise<void>>();
  constructor(
    private db: Pool,
    private client: Client,
    private finance: FinanceService,
    readonly available: boolean,
  ) {}
  async configure(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (
      !interaction.guildId ||
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    )
      throw new FinanceError('La permission Gérer le serveur est nécessaire.');
    const existing = (
      await this.db.query(
        'SELECT * FROM "ChatChallengeConfig" WHERE "guildId"=$1',
        [interaction.guildId],
      )
    ).rows[0];
    const selected = interaction.options.getChannel('salon');
    const channelId = selected?.id ?? existing?.channelId;
    if (!channelId)
      throw new FinanceError(
        'Choisissez un salon avec /defis salon:#votre-salon.',
      );
    const enabled = interaction.options.getBoolean('actif') ?? true;
    if (enabled && !this.available)
      throw new FinanceError(
        'Activez Message Content Intent dans Discord Developer Portal → Bot → Privileged Gateway Intents, puis redémarrez le bot.',
      );
    const channel = await this.client.channels.fetch(channelId);
    if (
      !channel ||
      channel.type !== ChannelType.GuildText ||
      channel.guildId !== interaction.guildId
    )
      throw new FinanceError('Choisissez un salon textuel de ce serveur.');
    const permissions = channel.permissionsFor(this.client.user!);
    if (
      enabled &&
      !permissions?.has([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ReadMessageHistory,
      ])
    )
      throw new FinanceError(
        'Le bot doit pouvoir voir le salon, envoyer des messages, intégrer des liens et lire l’historique.',
      );
    const minutes =
      interaction.options.getInteger('minutes') ??
      existing?.intervalMinutes ??
      20;
    await this.db.query(
      'INSERT INTO "ChatChallengeConfig" ("guildId","channelId",enabled,"intervalMinutes","nextAt","updatedBy") VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT ("guildId") DO UPDATE SET "channelId"=$2,enabled=$3,"intervalMinutes"=$4,"nextAt"=$5,"updatedBy"=$6',
      [
        interaction.guildId,
        channelId,
        enabled,
        minutes,
        new Date(Date.now() + minutes * 60000),
        interaction.user.id,
      ],
    );
    await interaction.editReply({
      content: enabled
        ? `Défis activés dans <#${channelId}> toutes les **${minutes} minutes**. Première bonne réponse : **250 Munny**. Chaque défi expire après 5 minutes. Le premier sera envoyé dans ${minutes} minutes.`
        : 'Défis automatiques en pause. Le défi déjà publié conserve sa durée.',
      allowedMentions: mentions,
    });
  }
  private async channel(id: string) {
    const channel = await this.client.channels.fetch(id);
    if (!channel || channel.type !== ChannelType.GuildText)
      throw new Error('Channel unavailable');
    return channel as TextChannel;
  }
  async force(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (
      !interaction.guildId ||
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    )
      throw new FinanceError('La permission Gérer le serveur est nécessaire.');
    if (!this.available)
      throw new FinanceError(
        'Message Content Intent doit être activé pour lancer un défi.',
      );
    const id = 'manual:' + interaction.id;
    const db = await this.db.connect();
    let channelId: string;
    try {
      await db.query(
        "SELECT pg_advisory_lock(hashtext('sorarng-chat-scheduler'))",
      );
      const config = (
        await db.query(
          'SELECT * FROM "ChatChallengeConfig" WHERE "guildId"=$1',
          [interaction.guildId],
        )
      ).rows[0];
      if (!config)
        throw new FinanceError(
          'Choisissez d’abord un salon avec /defis salon:#votre-salon.',
        );
      channelId = config.channelId;
      const channel = await this.channel(channelId);
      if (
        channel.guildId !== interaction.guildId ||
        !channel
          .permissionsFor(this.client.user!)
          ?.has([
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ReadMessageHistory,
          ])
      )
        throw new FinanceError(
          'Le bot doit pouvoir voir le salon, envoyer des messages, intégrer des liens et lire l’historique.',
        );
      await db.query(
        'UPDATE "ChatChallenge" SET status=$1 WHERE "channelId"=$2 AND status=ANY($3::text[]) AND "expiresAt"<=NOW()',
        ['expired', channelId, ['draft', 'published']],
      );
      const active = (
        await db.query(
          'SELECT id FROM "ChatChallenge" WHERE "channelId"=$1 AND status=ANY($2::text[])',
          [channelId, ['draft', 'published']],
        )
      ).rows[0];
      if (active && active.id !== id)
        throw new FinanceError(
          'Un défi est déjà en cours dans ce salon. Terminez-le ou attendez son expiration.',
        );
      await db.query(
        'INSERT INTO "ChatChallenge" (id,"guildId","channelId",content,status,"expiresAt") VALUES ($1,$2,$3,$4,$5,NOW()+INTERVAL \'5 minutes\') ON CONFLICT (id) DO NOTHING',
        [
          id,
          interaction.guildId,
          channelId,
          JSON.stringify(makeChallenge()),
          'draft',
        ],
      );
    } finally {
      await db
        .query("SELECT pg_advisory_unlock(hashtext('sorarng-chat-scheduler'))")
        .catch(() => {});
      db.release();
    }
    await this.tick(true);
    const round = (
      await this.db.query('SELECT status FROM "ChatChallenge" WHERE id=$1', [
        id,
      ])
    ).rows[0];
    await interaction.editReply({
      content:
        round?.status === 'published'
          ? `Défi envoyé dans <#${channelId}> ! Première bonne réponse : **250 Munny**. La cadence automatique est conservée.`
          : `Défi préparé pour <#${channelId}>. Publication en attente, le bot réessaiera automatiquement.`,
      allowedMentions: mentions,
    });
  }
  async tick(wait = false) {
    if (!this.available || !this.client.isReady()) return;
    const lock = await this.db.connect();
    try {
      if (wait)
        await lock.query(
          "SELECT pg_advisory_lock(hashtext('sorarng-chat-scheduler'))",
        );
      else if (
        !(
          await lock.query(
            "SELECT pg_try_advisory_lock(hashtext('sorarng-chat-scheduler')) AS locked",
          )
        ).rows[0].locked
      )
        return;
      await lock.query(
        'UPDATE "ChatChallenge" SET status=$1 WHERE status=ANY($2::text[]) AND "expiresAt"<=NOW()',
        ['expired', ['draft', 'published']],
      );
      const due = (
        await lock.query(
          'SELECT * FROM "ChatChallengeConfig" WHERE enabled=true AND "nextAt"<=NOW() ORDER BY "nextAt" LIMIT 20',
        )
      ).rows;
      for (const config of due) {
        if (
          (
            await lock.query(
              'SELECT id FROM "ChatChallenge" WHERE "channelId"=$1 AND status=ANY($2::text[])',
              [config.channelId, ['draft', 'published']],
            )
          ).rowCount
        )
          continue;
        await lock.query('BEGIN');
        try {
          await lock.query(
            'UPDATE "ChatChallengeConfig" SET "nextAt"=NOW()+($2 * INTERVAL \'1 minute\') WHERE "guildId"=$1',
            [config.guildId, config.intervalMinutes],
          );
          await lock.query(
            'INSERT INTO "ChatChallenge" (id,"guildId","channelId",content,status,"expiresAt") VALUES ($1,$2,$3,$4,$5,NOW()+INTERVAL \'5 minutes\')',
            [
              randomUUID(),
              config.guildId,
              config.channelId,
              JSON.stringify(makeChallenge()),
              'draft',
            ],
          );
          await lock.query('COMMIT');
        } catch (error) {
          await lock.query('ROLLBACK');
          throw error;
        }
      }
      const drafts = (
        await lock.query(
          'SELECT * FROM "ChatChallenge" WHERE status=$1 ORDER BY "createdAt" LIMIT 20',
          ['draft'],
        )
      ).rows as Round[];
      for (const round of drafts) {
        try {
          const channel = await this.channel(round.channelId);
          const message = await channel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xc1b399)
                .setTitle('✦ Défi du salon · 250 Munny')
                .setDescription(round.content.prompt)
                .setFooter({
                  text: 'Première bonne réponse dans le salon · Profil SoraRNG requis · 5 minutes maximum',
                }),
            ],
            allowedMentions: mentions,
            nonce: round.id.replaceAll('-', '').slice(0, 24),
            enforceNonce: true,
          });
          await lock.query(
            'UPDATE "ChatChallenge" SET status=$2,"messageId"=$3,"publishedAt"=$4,"expiresAt"=$4::timestamptz+INTERVAL \'5 minutes\' WHERE id=$1 AND status=$5',
            [
              round.id,
              'published',
              message.id,
              new Date(message.createdTimestamp),
              'draft',
            ],
          );
        } catch {
          console.error('Publication d’un défi à réessayer.');
        }
      }
      const ended = (
        await lock.query(
          'SELECT * FROM "ChatChallenge" WHERE status=ANY($1::text[]) AND announced=false ORDER BY "createdAt" LIMIT 20',
          [['won', 'expired']],
        )
      ).rows as Round[];
      for (const round of ended) {
        try {
          if (round.messageId) {
            const channel = await this.channel(round.channelId);
            if (round.status === 'won') {
              await channel.send({
                content: `🏆 Bravo <@${round.winnerId}> ! Tu as été le premier à donner la bonne réponse et tu gagnes **250 Munny** !\nLes Munny ont été ajoutés à ton compte SoraRNG.`,
                allowedMentions: mentions,
                nonce: ('win' + round.id.replaceAll('-', '')).slice(0, 24),
                enforceNonce: true,
              });
              await lock.query(
                'UPDATE "ChatChallenge" SET announced=true WHERE id=$1',
                [round.id],
              );
            }
            const message = await channel.messages.fetch(round.messageId);
            await message.edit({
              embeds: [
                new EmbedBuilder()
                  .setColor(round.status === 'won' ? 0x78a78b : 0x777777)
                  .setTitle(
                    round.status === 'won'
                      ? '🏆 Défi remporté !'
                      : 'Défi terminé',
                  )
                  .setDescription(
                    `${round.content.prompt}\n\n${round.status === 'won' ? `<@${round.winnerId}> a répondu en premier et gagne **250 Munny** !` : `Aucune bonne réponse à temps. Réponse : **${round.content.answers[0]}**.`}`,
                  ),
              ],
              allowedMentions: mentions,
            });
          }
          await lock.query(
            'UPDATE "ChatChallenge" SET announced=true WHERE id=$1',
            [round.id],
          );
        } catch {
          console.error('Annonce de fin de défi à réessayer.');
        }
      }
    } finally {
      await lock
        .query("SELECT pg_advisory_unlock(hashtext('sorarng-chat-scheduler'))")
        .catch(() => {});
      lock.release();
    }
  }
  async answer(message: Message) {
    if (message.author.bot || message.webhookId || !message.guildId) return;
    const previous = this.answers.get(message.channelId) ?? Promise.resolve();
    const work = previous
      .catch(() => {})
      .then(() => this.processAnswer(message));
    this.answers.set(message.channelId, work);
    try {
      await work;
    } finally {
      if (this.answers.get(message.channelId) === work)
        this.answers.delete(message.channelId);
    }
  }
  private async processAnswer(message: Message) {
    if (
      !this.available ||
      message.author.bot ||
      message.webhookId ||
      !message.guildId ||
      !message.content ||
      message.content.length > 200
    )
      return;
    const round = (
      await this.db.query(
        'SELECT * FROM "ChatChallenge" WHERE "guildId"=$1 AND "channelId"=$2 AND status=$3 AND "expiresAt">NOW() LIMIT 1',
        [message.guildId, message.channelId, 'published'],
      )
    ).rows[0] as Round | undefined;
    if (!round || !matchesAnswer(round.content, message.content)) return;
    try {
      await this.finance.action(
        message.author.id,
        'challenge:' + round.id,
        'challenge.answer',
        {
          id: round.id,
          guildId: message.guildId,
          channelId: message.channelId,
          answer: message.content,
          messageId: message.id,
          sentAt: message.createdTimestamp,
        },
      );
      await this.tick(true);
    } catch (error) {
      if (!(error instanceof FinanceError)) throw error;
    }
  }
}
