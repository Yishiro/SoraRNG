import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Interaction,
  type InteractionEditReplyOptions,
} from 'discord.js';
import {
  FinanceService,
  type FinanceResult,
  type PublicGame,
} from '../src/server/finance';
import { FinanceError } from '../src/game/finance';
import { amountFrom } from '../src/game/finance';
import { donationConfirmation, readDonation } from './donations';
const names = new Set([
  'solde',
  'double',
  'don',
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'banque',
  'roulette',
  'guess',
  'coinflip',
  'duel-des',
]);
const mentions = { parse: [] as never[] };
export function economyVisibility(command: string) {
  return [
    'solde',
    'double',
    'roulette',
    'guess',
    'coinflip',
    'duel-des',
  ].includes(command)
    ? {}
    : { flags: MessageFlags.Ephemeral as const };
}
const money = (value: number | string) =>
  BigInt(value).toLocaleString('fr-FR') + ' Munny';
function embed(title: string) {
  return new EmbedBuilder()
    .setColor(0x303033)
    .setTitle(title)
    .setFooter({ text: 'SoraRNG · Compte commun avec le site' });
}
export async function revealResult(
  edit: (message: InteractionEditReplyOptions) => Promise<unknown>,
  result: FinanceResult,
) {
  const finished =
    result.double ||
    result.roulette ||
    (result.game && ['won', 'lost', 'settled'].includes(result.game.status));
  if (finished) {
    const kind = result.double
      ? 'double'
      : result.roulette
        ? 'roulette'
        : result.game!.kind;
    const frames =
      kind === 'double'
        ? ['🪙 Le sort est lancé…', '✨ Le résultat se dévoile…']
        : kind === 'roulette'
          ? ['🎡 La roulette tourne…', '🎡 La bille ralentit…']
          : kind === 'coinflip'
            ? ['🪙 La pièce s’élance…', '🪙 Elle retombe…']
            : kind === 'dice'
              ? ['🎲 Les dés roulent…', '🎲 Les dés s’immobilisent…']
              : ['🔎 Vérification du nombre…', '📖 Le résultat se dévoile…'];
    for (const frame of frames) {
      try {
        await edit({
          content: '',
          embeds: [embed(frame)],
          components: [],
          allowedMentions: mentions,
        });
      } catch {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
  }
  await edit({ content: '', ...financeMessage(result) });
}
export function gameMessage(game: PublicGame): InteractionEditReplyOptions {
  const state = game.state,
    buttons = new ActionRowBuilder<ButtonBuilder>();
  let description: string;
  const title =
    game.kind === 'guess'
      ? '🔎 Guess Number'
      : game.kind === 'coinflip'
        ? '🪙 Pile ou face'
        : '🎲 Duel de dés';
  if (game.kind === 'guess') {
    description = `Mise réservée : ${money(state.stake)}\n`;
    if (game.status === 'active') {
      description += `Trouvez le nombre entre 1 et 100. Essais : ${state.attempts?.length ?? 0} / 5.`;
      buttons.addComponents(
        new ButtonBuilder()
          .setCustomId('econ:guess:' + game.id)
          .setLabel('Proposer un nombre')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('econ:abandon:' + game.id)
          .setLabel('Abandonner')
          .setStyle(ButtonStyle.Secondary),
      );
    } else
      description += `${game.status === 'won' ? 'Trouvé !' : game.status === 'abandoned' ? 'Partie abandonnée.' : 'Partie terminée.'} Le nombre était **${state.answer}**.\nTotal reçu : ${money(state.payout ?? 0)}.`;
    if (state.attempts?.length)
      description +=
        '\n\n' +
        state.attempts
          .map(
            (attempt, i) => `${i + 1}. **${attempt.number}** — ${attempt.hint}`,
          )
          .join('\n');
  } else {
    description = `<@${game.authorId}> contre <@${game.opponentId}>\nMise par joueur : ${money(state.stake)}.`;
    if (game.status === 'pending') {
      description += `\nEn attente de l’accord du joueur invité. Expiration <t:${Math.floor(game.expiresAt! / 1000)}:R>.`;
      if (game.kind === 'coinflip')
        description += `\nCôté de l’auteur : ${state.side}.`;
      buttons.addComponents(
        new ButtonBuilder()
          .setCustomId('econ:accept:' + game.id)
          .setLabel('Accepter')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('econ:decline:' + game.id)
          .setLabel('Refuser / annuler')
          .setStyle(ButtonStyle.Secondary),
      );
    } else if (['expired', 'declined'].includes(game.status))
      description += `\nDéfi ${game.status === 'expired' ? 'expiré' : 'annulé'}. La mise réservée a été remboursée.`;
    else {
      description +=
        game.kind === 'coinflip'
          ? `\nRésultat : **${state.coin}**.`
          : `\nDés : **${state.rolls?.[0]} — ${state.rolls?.[1]}**.`;
      description += state.winner
        ? `\nGagnant : <@${state.winner}>. Total reçu : ${money(BigInt(state.stake) * 2n + '')}.`
        : '\nÉgalité : les deux mises ont été remboursées.';
    }
  }
  return {
    embeds: [embed(title).setDescription(description)],
    components: buttons.components.length ? [buttons] : [],
    allowedMentions: mentions,
  };
}
export function financeMessage(
  result: FinanceResult,
): InteractionEditReplyOptions {
  if (result.double) {
    const { stake, won, payout } = result.double;
    return {
      embeds: [
        embed(won ? '✨ Double · Gagné !' : '🪙 Double · Résultat')
          .setColor(won ? 0x78a78b : 0x9b8580)
          .setDescription(
            `Mise : ${money(stake)}\n${won ? 'Mise doublée !' : 'Mise perdue.'} Total reçu : ${money(payout)}.\nDisponible : ${money(result.wallet)}`,
          ),
      ],
      components: [],
      allowedMentions: mentions,
    };
  }
  if (result.game) return gameMessage(result.game);
  if (result.games) {
    const cards = result.games.map((game) => gameMessage(game));
    return {
      content: result.games.length
        ? 'Vos parties en cours :'
        : 'Aucune partie en cours.',
      embeds: cards.flatMap((card) => card.embeds ?? []),
      components: cards.flatMap((card) => card.components ?? []).slice(0, 5),
      allowedMentions: mentions,
    };
  }
  if (result.roulette) {
    const r = result.roulette;
    return {
      embeds: [
        embed(r.won ? '🎡 Roulette · Gagné !' : '🎡 Roulette · Résultat')
          .setColor(r.won ? 0x78a78b : 0x9b8580)
          .setDescription(
            `**${r.number} · ${r.color}**\nMise : ${money(r.stake)}\n${r.won ? 'Gagné !' : 'Partie terminée.'} Total reçu : ${money(r.payout)}.\nDisponible : ${money(result.wallet)}`,
          ),
      ],
      components: [],
      allowedMentions: mentions,
    };
  }
  const title =
    result.kind === 'bonus'
      ? 'Bonus récupéré'
      : result.kind === 'deposit'
        ? 'Dépôt enregistré'
        : 'Retrait enregistré';
  return {
    embeds: [
      embed(title).setDescription(
        `${money(result.amount ?? 0)}${result.kind === 'deposit' ? ' déposés' : result.kind === 'withdraw' ? ' retirés' : ' récupérés'}.\nDisponible : ${money(result.wallet)}${result.bank !== undefined ? '\nÉpargne disponible au retrait : ' + money(result.bank) : ''}${result.nextAt ? '\nProchain bonus <t:' + Math.floor(result.nextAt / 1000) + ':R>.' : ''}`,
      ),
    ],
    components: [],
    allowedMentions: mentions,
  };
}
export async function handleEconomy(
  interaction: Interaction,
  finance: FinanceService,
) {
  if (interaction.isButton() && interaction.customId.startsWith('gift:')) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    let gift;
    try {
      gift = readDonation(
        interaction.customId,
        interaction.user.id,
        process.env.DISCORD_BOT_TOKEN!,
      );
    } catch {
      throw new FinanceError(
        'Confirmation invalide ou expirée. Relancez /don.',
      );
    }
    const result = await finance.action(
      interaction.user.id,
      gift.key,
      'donate',
      { recipient: gift.recipient, amount: gift.amount },
    );
    await interaction.editReply({
      content: `Don effectué : **${money(result.amount!)}** à <@${gift.recipient}>.\nDisponible : ${money(result.wallet)}.`,
      allowedMentions: mentions,
    });
    await interaction.message.edit({ components: [] }).catch(() => {});
    return true;
  }
  if (
    interaction.isButton() &&
    interaction.customId.startsWith('econ:guess:')
  ) {
    const id = interaction.customId.slice('econ:guess:'.length);
    const modal = new ModalBuilder()
      .setCustomId('econ:number:' + id)
      .setTitle('Guess Number')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('number')
            .setLabel('Un nombre entre 1 et 100')
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(3)
            .setRequired(true),
        ),
      );
    await interaction.showModal(modal);
    return true;
  }
  if (interaction.isButton() && interaction.customId.startsWith('econ:')) {
    const [, action, id] = interaction.customId.split(':');
    await interaction.deferReply(
      action === 'abandon' ? {} : { flags: MessageFlags.Ephemeral },
    );
    if (!['accept', 'decline', 'abandon'].includes(action))
      throw new FinanceError('Action inconnue.');
    const result = await finance.action(
      interaction.user.id,
      'discord:' + interaction.id,
      action === 'abandon'
        ? 'guess.abandon'
        : action === 'accept'
          ? 'duel.accept'
          : 'duel.decline',
      { id, guildId: interaction.guildId },
    );
    const response = financeMessage(result);
    if (action !== 'abandon')
      await revealResult(
        (message) => interaction.message.edit(message),
        result,
      ).catch(() => {});
    await interaction.editReply(response);
    return true;
  }
  if (
    interaction.isModalSubmit() &&
    interaction.customId.startsWith('econ:number:')
  ) {
    await interaction.deferReply({});
    const text = interaction.fields.getTextInputValue('number');
    if (!/^\d{1,3}$/.test(text)) throw new FinanceError('Nombre invalide.');
    const result = await finance.action(
      interaction.user.id,
      'discord:' + interaction.id,
      'guess.attempt',
      {
        id: interaction.customId.slice('econ:number:'.length),
        number: Number(text),
      },
    );
    await revealResult((message) => interaction.editReply(message), result);
    return true;
  }
  if (!interaction.isChatInputCommand() || !names.has(interaction.commandName))
    return false;
  const command = interaction.commandName;
  await interaction.deferReply(economyVisibility(command));
  await finance.expireDue();
  const user = interaction.user.id,
    key = 'discord:' + interaction.id;
  if (command === 'don') {
    const recipient = interaction.options.getUser('membre', true);
    if (recipient.bot || recipient.id === user)
      throw new FinanceError('Choisissez un autre membre, pas un bot.');
    const view = await finance.view(user);
    await finance.view(recipient.id);
    const amount = amountFrom(
      interaction.options.getString('montant', true),
      view.wallet,
    );
    await interaction.editReply({
      content: `Donner **${money(amount)}** à <@${recipient.id}> ? Confirmation valable 5 minutes.`,
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(
              donationConfirmation(
                user,
                recipient.id,
                amount,
                process.env.DISCORD_BOT_TOKEN!,
              ),
            )
            .setLabel('Confirmer le don')
            .setStyle(ButtonStyle.Primary),
        ),
      ],
      allowedMentions: mentions,
    });
    return true;
  }
  if (
    command === 'solde' ||
    (command === 'banque' && interaction.options.getSubcommand() === 'solde')
  ) {
    const target =
      command === 'solde' ? interaction.options.getUser('pseudo') : null;
    const view = await finance.view(target?.id ?? user);
    if (target && target.id !== user) {
      await interaction.editReply({
        embeds: [
          embed(`Solde de ${target.username}`).setDescription(
            `Disponible : **${money(view.wallet)}**\nÉpargne : **${money(view.bank)}**\nMises réservées : **${money(view.reserved)}**`,
          ),
        ],
        allowedMentions: mentions,
      });
      return true;
    }
    await interaction.editReply({
      embeds: [
        embed('Votre solde')
          .setDescription(
            `Disponible : **${money(view.wallet)}**\nÉpargne : **${money(view.bank)}**\nMises réservées : **${money(view.reserved)}**\n\nLa banque produit 2 % d’intérêts composés par jour, au prorata du temps. Retrait possible à tout moment.`,
          )
          .addFields({
            name: 'Bonus',
            value: Object.entries(view.bonuses)
              .map(
                ([type, bonus]) =>
                  `/${type} — ${bonus.available ? 'Disponible' : '<t:' + Math.floor(bonus.nextAt / 1000) + ':R>'}`,
              )
              .join('\n'),
          }),
      ],
      allowedMentions: mentions,
    });
    return true;
  }
  let result: FinanceResult;
  if (['hourly', 'daily', 'weekly', 'monthly'].includes(command))
    result = await finance.action(user, key, 'bonus', { type: command });
  else if (command === 'banque')
    result = await finance.action(
      user,
      key,
      interaction.options.getSubcommand() === 'deposer'
        ? 'deposit'
        : 'withdraw',
      { amount: interaction.options.getString('montant', true) },
    );
  else if (command === 'double')
    result = await finance.action(user, key, 'double', {
      amount: interaction.options.getString('mise', true),
    });
  else if (command === 'roulette')
    result = await finance.action(user, key, 'roulette', {
      amount: interaction.options.getString('mise', true),
      choice: interaction.options.getString('choix', true),
    });
  else if (command === 'guess')
    result = await finance.action(user, key, 'guess.start', {
      amount: interaction.options.getString('mise', true),
    });
  else {
    const opponent = interaction.options.getUser('adversaire', true);
    if (opponent.bot)
      throw new FinanceError('Choisissez un autre membre, pas un bot.');
    result = await finance.action(user, key, 'duel.start', {
      opponent: opponent.id,
      amount: interaction.options.getString('mise', true),
      game: command === 'duel-des' ? 'dice' : 'coinflip',
      side: interaction.options.getString('cote') ?? 'pile',
      guildId: interaction.guildId,
    });
  }
  await revealResult((message) => interaction.editReply(message), result);
  return true;
}
