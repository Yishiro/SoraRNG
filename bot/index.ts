import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
  ApplicationFlagsBitField,
} from 'discord.js';
import { ChatChallenges } from './challenges';
import {
  AuctionNotifier,
  discordNoticeDelivery,
} from './auction-notifications';
import { Pool } from 'pg';
import { writeFile, unlink } from 'node:fs/promises';
import { botConfig } from './config';
import { botReply, replyVisibility } from './replies';
import { handleEconomy } from './economy';
import { handleCollector } from './collector';
import { CollectorStore } from './collector-store';
import { AuctionService } from '../src/server/auctions';
import { FinanceService } from '../src/server/finance';
import { FinanceError } from '../src/game/finance';
const healthPath = '/tmp/sorarng-bot-ready';
async function main() {
  const config = botConfig();
  const db = new Pool({
    connectionString: config.databaseUrl,
    max: 3,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    options: '-c statement_timeout=5000',
  });
  const app = (await new REST({ version: '10', timeout: 10000 })
    .setToken(config.token)
    .get(Routes.oauth2CurrentApplication())) as {
    flags: number;
    owner?: { id: string };
    team?: { owner_user_id: string };
  };
  const finance = new FinanceService(db);
  const collector = new CollectorStore(db);
  const auctions = new AuctionService(db);
  let settlingAuctions = false;
  const auctionTimer = setInterval(() => {
    if (settlingAuctions) return;
    settlingAuctions = true;
    void auctions
      .settle()
      .catch(() => console.error('Clôture des enchères à réessayer.'))
      .finally(() => {
        settlingAuctions = false;
      });
  }, 15000);
  auctionTimer.unref();
  const maintenance = setInterval(
    () =>
      void finance
        .expireDue()
        .catch(() => console.error('Remboursement des défis à réessayer.')),
    30000,
  );
  maintenance.unref();
  const flags = new ApplicationFlagsBitField(app.flags);
  const messageContent =
    flags.has('GatewayMessageContent') ||
    flags.has('GatewayMessageContentLimited');
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      ...(messageContent
        ? [GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
        : []),
    ],
    allowedMentions: { parse: [] },
  });
  const challenges = new ChatChallenges(db, client, finance, messageContent);
  const auctionNotifier = new AuctionNotifier(
    db,
    discordNoticeDelivery(client, config.site),
  );
  let notifying = false;
  const notificationTimer = setInterval(() => {
    if (notifying || !client.isReady()) return;
    notifying = true;
    void auctionNotifier
      .tick()
      .catch(() => console.error('Notifications des enchères à réessayer.'))
      .finally(() => {
        notifying = false;
      });
  }, 15000);
  notificationTimer.unref();
  const challengeTimer = setInterval(
    () =>
      void challenges
        .tick()
        .catch(() => console.error('Planification des défis à réessayer.')),
    15000,
  );
  challengeTimer.unref();
  client.on(
    Events.MessageCreate,
    (message) =>
      void challenges
        .answer(message)
        .catch(() => console.error('Réponse au défi à réessayer.')),
  );
  const cooldowns = new Map<string, number>();
  let closing = false,
    healthBusy = false;
  const reader = {
    findState: async (id: string) =>
      (await db.query('SELECT state FROM "Player" WHERE id=$1', [id])).rows[0]
        ?.state ?? null,
  };
  async function health() {
    if (healthBusy || closing) return;
    healthBusy = true;
    try {
      if (!client.isReady()) throw new Error('Not ready');
      await db.query('SELECT 1');
      await writeFile(healthPath, String(Date.now()), { mode: 0o600 });
    } catch {
      await unlink(healthPath).catch(() => {});
    } finally {
      healthBusy = false;
    }
  }
  const timer = setInterval(() => void health(), 15000);
  timer.unref();
  async function stop(code = 0) {
    if (closing) return;
    closing = true;
    clearInterval(timer);
    clearInterval(maintenance);
    clearInterval(auctionTimer);
    clearInterval(notificationTimer);
    clearInterval(challengeTimer);
    await unlink(healthPath).catch(() => {});
    const timeout = setTimeout(() => process.exit(1), 5000);
    timeout.unref();
    await client.destroy();
    await db.end();
    clearTimeout(timeout);
    process.exitCode = code;
  }
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.once(signal, () => {
      void stop();
    });
  client.once(Events.ClientReady, () => {
    console.log('Bot Discord SoraRNG connecté.');
    console.log(
      messageContent
        ? 'Lecture des réponses aux défis disponible.'
        : 'Défis en attente : Message Content Intent doit être activé dans le portail Discord.',
    );
    void health();
  });
  client.on(Events.Error, () =>
    console.error(
      'Incident de connexion Discord ; reconnexion gérée par le client.',
    ),
  );
  db.on('error', () =>
    console.error('Base de données du bot temporairement indisponible.'),
  );
  client.on(Events.ShardDisconnect, () => {
    void unlink(healthPath).catch(() => {});
  });
  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isAutocomplete()) {
      try {
        if (
          !(await handleCollector(interaction, collector, finance, config.site))
        )
          await interaction.respond([]);
      } catch {
        await interaction.respond([]).catch(() => {});
      }
      return;
    }
    if (
      !interaction.isChatInputCommand() &&
      !interaction.isButton() &&
      !interaction.isModalSubmit()
    )
      return;
    try {
      const now = Date.now(),
        last = cooldowns.get(interaction.user.id) ?? 0;
      if (interaction.isChatInputCommand() && now - last < 2000) {
        await interaction.reply({
          content: 'Patientez deux secondes entre deux commandes.',
          flags: MessageFlags.Ephemeral,
          allowedMentions: { parse: [] },
        });
        return;
      }
      if (cooldowns.size > 5000) cooldowns.clear();
      if (interaction.isChatInputCommand())
        cooldowns.set(interaction.user.id, now);
      if (
        interaction.isChatInputCommand() &&
        ['defis', 'defi-maintenant'].includes(interaction.commandName)
      ) {
        if (interaction.commandName === 'defi-maintenant')
          await challenges.force(interaction);
        else await challenges.configure(interaction);
        return;
      }
      if (await handleEconomy(interaction, finance)) return;
      if (await handleCollector(interaction, collector, finance, config.site))
        return;
      if (!interaction.isChatInputCommand()) return;
      await interaction.deferReply(replyVisibility(interaction.commandName));
      await interaction.editReply(
        await botReply(
          interaction.commandName,
          interaction.user.id,
          config.site,
          reader,
        ),
      );
    } catch (error) {
      const response = {
        content:
          error instanceof FinanceError
            ? error.message
            : 'SoraRNG est temporairement indisponible. Réessayez dans un instant.',
        embeds: [],
        components: [],
        allowedMentions: { parse: [] as never[] },
      };
      if (interaction.deferred || interaction.replied)
        await interaction.editReply(response).catch(() => {});
      else
        await interaction
          .reply({ ...response, flags: MessageFlags.Ephemeral })
          .catch(() => {});
    }
  });
  try {
    await db.query('SELECT 1');
    await client.login(config.token);
  } catch {
    await stop(1);
    throw new Error('Bot startup failed');
  }
}
main().catch(() => {
  console.error(
    'Démarrage du bot impossible. Vérifier la configuration et les connexions. Aucun secret affiché.',
  );
  process.exitCode = 1;
});
