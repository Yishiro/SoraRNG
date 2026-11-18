// Commandes de progression : quêtes, série de connexion, guilde et saison.
// Toutes les actions passent par `mutate`, comme sur le site : verrou du
// joueur, clé d'idempotence issue de l'interaction Discord, journal d'audit.
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  escapeMarkdown,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Interaction,
} from 'discord.js';
import type { Player } from '../src/game/core';
import type { QuestStatus } from '../src/game/quests';
import { streakRewards, streakStatus } from '../src/game/streak';
import { guildClaimKey, guildRules } from '../src/game/community';
import {
  seasonId,
  seasonLabel,
  seasonRewards,
  seasonBounds,
} from '../src/game/seasons';

type Play = typeof import('../src/server/play');
type Community = typeof import('../src/server/community');
type Seasons = typeof import('../src/server/seasons');
export type ProgressionDeps = {
  play: Pick<Play, 'snapshot' | 'mutate' | 'catalog' | 'pool'>;
  community: Pick<Community, 'guildOverview'>;
  seasons: Pick<Seasons, 'seasonStandings' | 'settleSeasons'>;
};

export const progressionCommands = new Set([
  'quetes',
  'serie',
  'guilde',
  'saison',
  'leaderboard',
]);
const color = 0x8d8e95;
const allowedMentions = { parse: [] as never[] };
const fmt = (n: number) => n.toLocaleString('fr-FR');
const bar = (value: number, max: number, width = 10) => {
  const filled = Math.round((Math.min(value, max) / max) * width);
  return '▰'.repeat(filled) + '▱'.repeat(width - filled);
};

async function playerState(deps: ProgressionDeps, id: string) {
  const snap = await deps.play.snapshot(id);
  if (!snap.state) return null;
  return snap as typeof snap & { state: Player; quests: QuestStatus[] };
}

// Seuls les messages métier (en français, sans code d'erreur PostgreSQL) sont
// montrés au joueur ; toute erreur technique reste générique.
export function userMessage(error: unknown) {
  return error instanceof Error && !('code' in error) && error.message
    ? error.message
    : 'SoraRNG est temporairement indisponible. Réessayez dans un instant.';
}

const noProfile = {
  content:
    'Aucun profil SoraRNG pour ce compte : connectez-vous une première fois sur le site avec Discord.',
  allowedMentions,
};

export function questEmbed(quests: QuestStatus[], cycle: 'daily' | 'weekly') {
  const list = quests.filter((q) => q.cycle === cycle);
  const done = list.filter((q) => q.claimed).length;
  const ready = list.filter((q) => q.claimable);
  const pending = list
    .filter((q) => !q.claimed)
    .sort(
      (a, b) =>
        Number(b.claimable) - Number(a.claimable) ||
        b.progress / b.target - a.progress / a.target,
    )
    .slice(0, 12);
  const lines = pending.map(
    (q) =>
      `${q.claimable ? '✅' : '▫️'} **${escapeMarkdown(q.name)}** · ${fmt(q.progress)}/${fmt(q.target)} · +${fmt(q.munny)}`,
  );
  return {
    embed: new EmbedBuilder()
      .setColor(color)
      .setTitle(cycle === 'daily' ? 'Quêtes du jour' : 'Quêtes de la semaine')
      .setDescription(
        `${done}/${list.length} terminées · ${ready.length} à réclamer\n\n${lines.join('\n') || 'Toutes les quêtes sont terminées.'}`,
      )
      .setFooter({ text: 'Quêtes · SoraRNG' }),
    ready,
  };
}

function questReply(quests: QuestStatus[], cycle: 'daily' | 'weekly') {
  const { embed, ready } = questEmbed(quests, cycle);
  const other = cycle === 'daily' ? 'weekly' : 'daily';
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`sora:quests:claim:${cycle}`)
          .setStyle(ButtonStyle.Success)
          .setLabel(
            ready.length
              ? `Réclamer ${ready.length} quête${ready.length > 1 ? 's' : ''}`
              : 'Rien à réclamer',
          )
          .setDisabled(!ready.length),
        new ButtonBuilder()
          .setCustomId(`sora:quests:view:${other}`)
          .setStyle(ButtonStyle.Secondary)
          .setLabel(
            other === 'daily'
              ? 'Voir les journalières'
              : 'Voir les hebdomadaires',
          ),
      ),
    ],
    allowedMentions,
  };
}

async function streakReply(deps: ProgressionDeps, id: string, key: string) {
  let snap = await playerState(deps, id);
  if (!snap) return noProfile;
  const before = streakStatus(snap.state, Date.now());
  let gained = '';
  if (before.claimable) {
    const result = (await deps.play.mutate(id, key, 'streak', {})) as {
      day: number;
      munny: number;
      tickets: number;
    };
    gained = `+${fmt(result.munny)} Munny${result.tickets ? ` et ${result.tickets} ticket` : ''} · jour ${result.day}/7`;
    snap = (await playerState(deps, id))!;
  }
  const status = streakStatus(snap.state, Date.now());
  const days = streakRewards
    .map((r, i) => {
      const day = i + 1;
      const mark = day <= status.day ? '🔥' : '▫️';
      return `${mark} J${day} · ${fmt(r.munny)}${r.tickets ? ' + ticket' : ''}`;
    })
    .join('\n');
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(color)
        .setTitle(
          gained ? 'Série de connexion validée !' : 'Série de connexion',
        )
        .setDescription(
          `${gained || `Déjà reçue aujourd’hui (jour ${status.day}/7). Revenez demain.`}\n\n${days}`,
        )
        .setFooter({
          text: 'Un jour manqué fait repartir au jour 1 · heure de Paris',
        }),
    ],
    allowedMentions,
  };
}

async function guildReply(deps: ProgressionDeps, id: string, site: string) {
  const snap = await playerState(deps, id);
  if (!snap) return noProfile;
  const data = await deps.community.guildOverview(deps.play.pool, id);
  if (!data.mine)
    return {
      content: `Vous n’êtes dans aucune guilde. Fondez-en une ou rejoignez-en une sur ${new URL('/guild', site).href}`,
      allowedMentions,
    };
  const g = data.mine;
  const claimable =
    g.previous.boosters >= guildRules.weeklyBoosters &&
    !snap.state.claimed.includes(guildClaimKey(g.previous.key));
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(color)
        .setTitle(escapeMarkdown(g.name))
        .setURL(new URL('/guild', site).href)
        .setDescription(
          [
            `${g.members.length}/${guildRules.maxMembers} membres`,
            `Cette semaine : ${bar(g.week.boosters, guildRules.weeklyBoosters)} ${fmt(g.week.boosters)}/${guildRules.weeklyBoosters} boosters`,
            `Semaine précédente : ${fmt(g.previous.boosters)} boosters${g.previous.boosters >= guildRules.weeklyBoosters ? ' · objectif atteint' : ''}`,
          ].join('\n'),
        )
        .setFooter({
          text: `Objectif atteint = ${fmt(guildRules.weeklyReward)} Munny par membre`,
        }),
    ],
    components: claimable
      ? [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId('sora:guild:reward')
              .setStyle(ButtonStyle.Success)
              .setLabel(`Réclamer ${fmt(guildRules.weeklyReward)} Munny`),
          ),
        ]
      : [],
    allowedMentions,
  };
}

async function seasonReply(deps: ProgressionDeps, id: string) {
  const cards = await deps.play.catalog();
  // Le bot règle aussi les saisons terminées : le top 3 est payé même si
  // personne n'ouvre le site le premier jour du mois.
  await deps.seasons.settleSeasons(deps.play.pool, cards);
  const season = seasonId(new Date());
  const standings = await deps.seasons.seasonStandings(
    deps.play.pool,
    season,
    cards,
  );
  const rank = standings.findIndex((s) => s.id === id);
  const days = Math.max(
    1,
    Math.ceil((seasonBounds(season).end.getTime() - Date.now()) / 86400000),
  );
  const top = standings.slice(0, 10).map((s, i) => {
    const reward = seasonRewards[i];
    return `**${i + 1}.** ${escapeMarkdown(s.name)} · ${fmt(s.points)} pts${reward ? ` · ${fmt(reward)} Munny` : ''}`;
  });
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(color)
        .setTitle(`Saison de ${seasonLabel(season)}`)
        .setDescription(
          `${top.join('\n') || 'Personne n’a encore marqué de points ce mois-ci.'}\n\n${rank >= 0 ? `Vous êtes **${rank + 1}e** avec ${fmt(standings[rank].points)} points.` : 'Vous n’avez pas encore de points ce mois-ci.'}`,
        )
        .setFooter({
          text: `Fin dans ${days} jour${days > 1 ? 's' : ''} · top 3 récompensé`,
        }),
    ],
    allowedMentions,
  };
}

async function claimQuests(
  deps: ProgressionDeps,
  interaction: ButtonInteraction,
  cycle: 'daily' | 'weekly',
) {
  const id = interaction.user.id;
  const snap = await playerState(deps, id);
  if (!snap) return noProfile;
  let total = 0,
    claimed = 0;
  for (const q of snap.quests.filter(
    (quest: QuestStatus) => quest.cycle === cycle && quest.claimable,
  )) {
    // Une clé par quête et par clic : un double clic ne paie qu'une fois.
    try {
      await deps.play.mutate(id, `discord:${interaction.id}:${q.id}`, 'quest', {
        quest: q.id,
        cycle,
      });
      total += q.munny;
      claimed++;
    } catch {
      /* Quête déjà réclamée entre-temps : on passe à la suivante. */
    }
  }
  const after = await playerState(deps, id);
  const reply = questReply(after?.quests ?? [], cycle);
  return {
    ...reply,
    content: claimed
      ? `✅ ${claimed} quête${claimed > 1 ? 's' : ''} réclamée${claimed > 1 ? 's' : ''} · +${fmt(total)} Munny`
      : 'Aucune quête à réclamer.',
  };
}

export async function handleProgression(
  interaction: Interaction,
  deps: ProgressionDeps,
  site: string,
) {
  if (interaction.isButton()) {
    const [scope, area, action, arg] = interaction.customId.split(':');
    if (scope !== 'sora' || !['quests', 'guild'].includes(area)) return false;
    await interaction.deferUpdate();
    try {
      if (area === 'quests') {
        const cycle = arg === 'weekly' ? 'weekly' : 'daily';
        const reply =
          action === 'claim'
            ? await claimQuests(deps, interaction, cycle)
            : questReply(
                (await playerState(deps, interaction.user.id))?.quests ?? [],
                cycle,
              );
        await interaction.editReply(reply);
      } else {
        await deps.play.mutate(
          interaction.user.id,
          `discord:${interaction.id}`,
          'guild-reward',
          {},
        );
        await interaction.editReply({
          ...(await guildReply(deps, interaction.user.id, site)),
          content: `✅ +${fmt(guildRules.weeklyReward)} Munny de récompense de guilde.`,
        });
      }
    } catch (error) {
      await interaction.followUp({
        content: userMessage(error),
        flags: MessageFlags.Ephemeral,
        allowedMentions,
      });
    }
    return true;
  }
  if (!interaction.isChatInputCommand()) return false;
  const command = interaction as ChatInputCommandInteraction;
  if (!progressionCommands.has(command.commandName)) return false;
  const publicReply = ['saison', 'leaderboard'].includes(command.commandName);
  await command.deferReply(
    publicReply ? {} : { flags: MessageFlags.Ephemeral },
  );
  const id = command.user.id;
  try {
    let reply;
    if (command.commandName === 'quetes') {
      const snap = await playerState(deps, id);
      const cycle =
        command.options.getString('periode') === 'semaine' ? 'weekly' : 'daily';
      reply = snap ? questReply(snap.quests, cycle) : noProfile;
    } else if (command.commandName === 'serie')
      reply = await streakReply(deps, id, `discord:${command.id}`);
    else if (command.commandName === 'guilde')
      reply = await guildReply(deps, id, site);
    else reply = await seasonReply(deps, id);
    await command.editReply(reply);
  } catch (error) {
    await command.editReply({
      content: userMessage(error),
      allowedMentions,
    });
  }
  return true;
}
