import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  escapeMarkdown,
  type Interaction,
  type InteractionEditReplyOptions,
} from 'discord.js';
import type { Card, Player } from '../src/game/core';
import { showcaseCopies } from '../src/game/showcase';
import { getCardAsset } from '../src/game/assets';
import { getCardLegend } from '../src/game/card-legends';
import type { FinanceService } from '../src/server/finance';
import { FinanceError } from '../src/game/finance';
import type { CollectorStore } from './collector-store';
type Store = Pick<
  CollectorStore,
  'cards' | 'prices' | 'profile' | 'wishlist' | 'market' | 'history'
>;
const names = new Set([
  'carte',
  'collection',
  'wishlist',
  'marche',
  'ventes',
  'historique',
  'bonus',
  'vitrine',
]);
const publicNames = new Set(['carte', 'collection', 'marche', 'vitrine']);
const allowedMentions = { parse: [] as never[] };
const money = (n: number | string) =>
  typeof n === 'number'
    ? n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })
    : BigInt(n).toLocaleString('fr-FR');
const normal = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
export function cardChoices(cards: Card[], query: string) {
  const q = normal(query).slice(0, 100);
  return cards
    .filter((c) => normal(`${c.id} ${c.name} ${c.version}`).includes(q))
    .slice(0, 25)
    .map((c) => ({
      name: `${c.id} · ${c.name} · ${c.version}`.slice(0, 100),
      value: c.id,
    }));
}
export function exactCard(cards: Card[], query: string): Card {
  const q = normal(query);
  const byId = cards.find((c) => normal(c.id) === q);
  if (byId) return byId;
  const matches = cards.filter(
    (c) =>
      normal(c.name) === q ||
      normal(`${c.name} ${c.version}`) === q ||
      normal(`${c.name} · ${c.version}`) === q,
  );
  if (matches.length === 1) return matches[0];
  if (matches.length > 1)
    throw new FinanceError(
      'Plusieurs versions correspondent. Choisissez la version exacte dans les suggestions ou utilisez son identifiant KH-xxx.',
    );
  throw new FinanceError(
    'Carte introuvable. Choisissez une carte dans les suggestions.',
  );
}
function embed(title: string) {
  return new EmbedBuilder()
    .setColor(0x333335)
    .setTitle(title.slice(0, 256))
    .setFooter({ text: 'SoraRNG · Collection Kingdom Hearts' });
}
function links(site: string, items: [string, string][]) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    items.map(([label, path]) =>
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel(label)
        .setURL(new URL(path, site).toString()),
    ),
  );
}
function cardEmbed(card: Card, site: string) {
  const result = embed(`${card.name} · ${card.version}`)
    .setURL(new URL(`/cards/${card.id}`, site).toString())
    .setDescription(
      `${card.rarity} · ${card.affinity}\n\n${getCardLegend(card.id) ?? 'La légende de cette carte reste à découvrir.'}`,
    );
  const asset = getCardAsset(card.id);
  if (asset?.localPath)
    result.setThumbnail(new URL(asset.localPath, site).toString());
  return result;
}
const cardLine = (card: Card) =>
  `**${escapeMarkdown(card.name)}** · ${escapeMarkdown(card.version)} · ${card.id}`;
const movementNames: Record<string, string> = {
  deposit: 'Dépôt bancaire',
  withdraw: 'Retrait bancaire',
  bonus: 'Bonus',
  donate: 'Don',
  double: 'Double',
  roulette: 'Roulette',
  summon: 'Booster',
  shop: 'Boutique',
  mission: 'Quête',
  upgrade: 'Amélioration',
  awakening: 'Éveil',
  'admin.adjust': 'Ajustement staff',
  'resources.adjust': 'Ajustement staff',
  'auction.bid': 'Mise / remboursement',
  'auction.settle': 'Fin d’enchère',
  'challenge.answer': 'Défi remporté',
};
export async function handleCollector(
  interaction: Interaction,
  store: Store,
  finance: Pick<FinanceService, 'view'>,
  site: string,
): Promise<boolean> {
  if (interaction.isAutocomplete()) {
    if (!['carte', 'marche', 'wishlist'].includes(interaction.commandName))
      return false;
    const query = interaction.options.getFocused();
    await interaction.respond(cardChoices(await store.cards(), String(query)));
    return true;
  }
  if (!interaction.isChatInputCommand() || !names.has(interaction.commandName))
    return false;
  const command = interaction.commandName,
    user = interaction.user.id;
  await interaction.deferReply(
    publicNames.has(command) ? {} : { flags: MessageFlags.Ephemeral },
  );
  const send = (message: InteractionEditReplyOptions) =>
    interaction.editReply({ ...message, allowedMentions });
  if (command === 'bonus') {
    const view = await finance.view(user);
    await send({
      embeds: [
        embed('Vos bonus').setDescription(
          Object.entries(view.bonuses)
            .map(
              ([name, rule]) =>
                `**/${name}** — ${money(rule.amount)} Munny\n${rule.available ? 'Disponible maintenant' : `Disponible <t:${Math.floor(rule.nextAt / 1000)}:R>`}`,
            )
            .join('\n\n'),
        ),
      ],
      components: [links(site, [['Réclamer sur le site', '/dashboard']])],
    });
    return true;
  }
  if (command === 'historique') {
    const history = await store.history(user);
    const lines = history.map(
      (row) =>
        `<t:${Math.floor(new Date(row.createdAt).getTime() / 1000)}:f> · **${movementNames[row.kind] ?? escapeMarkdown(row.kind)}**\n${row.delta == null ? 'Variation non enregistrée' : `${row.delta > 0 ? '+' : ''}${money(row.delta)} Munny`}${row.before != null && row.after != null ? ` · Disponible : ${money(row.before)} → ${money(row.after)}` : ''}${row.bankMicros !== undefined ? `\nÉpargne enregistrée : ${money(BigInt(row.bankMicros) / 1000000n + '')} · Réservé : ${money(row.reserved ?? 0)}` : ''}`,
    );
    await send({
      embeds: [
        embed('Vos derniers mouvements de Munny')
          .setDescription(
            lines.join('\n\n').slice(0, 4000) || 'Aucun mouvement enregistré.',
          )
          .setFooter({
            text: 'Privé · 10 derniers mouvements · Historique ancien partiel',
          }),
      ],
      components: [links(site, [['Voir mon compte', '/dashboard']])],
    });
    return true;
  }
  const cards = await store.cards();
  if (command === 'carte') {
    const card = exactCard(cards, interaction.options.getString('nom', true));
    const history = await store.prices(card.id);
    const result = cardEmbed(card, site);
    result.addFields({
      name: 'Prix moyen des ventes finalisées',
      value: history.stats.length
        ? history.stats
            .map(
              (s) =>
                `${s.holo ? 'Holographique' : 'Standard'} : **${money(s.average)} Munny** · ${s.count} vente(s)${s.count < 5 ? ' · peu de références' : ''}`,
            )
            .join('\n')
        : 'Aucune vente finalisée enregistrée pour cette carte.',
    });
    await send({
      embeds: [result],
      components: [
        links(site, [
          ['Voir la carte', `/cards/${card.id}`],
          ['Ouvrir le marché', '/trade'],
        ]),
      ],
    });
    return true;
  }
  if (command === 'marche' || command === 'ventes') {
    if (command === 'ventes') await store.profile(user);
    const query =
      command === 'marche' ? interaction.options.getString('carte') : null;
    const card = query ? exactCard(cards, query) : null;
    const page = interaction.options.getInteger('page') ?? 1;
    const auctions = await store.market(
      card?.id ?? null,
      command === 'ventes' ? user : null,
      page,
    );
    const statuses: Record<string, string> = {
      sold: 'Vendue',
      cancelled: 'Annulée',
      unsold: 'Sans acheteur',
    };
    const lines = auctions.slice(0, 10).map((auction) => {
      const model = cards.find((c) => c.id === auction.copy.cardId);
      return `${model ? cardLine(model) : auction.copy.cardId}${auction.copy.holo ? ' ✦ Holo' : ''}\n**${money(auction.bid || auction.startPrice)} Munny** · ${auction.status === 'open' ? (new Date(auction.endsAt).getTime() > Date.now() ? `Fin <t:${Math.floor(new Date(auction.endsAt).getTime() / 1000)}:R>` : 'Clôture en cours') : (statuses[auction.status] ?? auction.status)} · [Voir l’enchère](${new URL(`/trade?auction=${encodeURIComponent(auction.id)}`, site).href})`;
    });
    await send({
      embeds: [
        embed(
          command === 'ventes'
            ? 'Vos ventes et enchères'
            : `Marché${card ? ` · ${card.name} · ${card.version}` : ''}`,
        )
          .setDescription(
            lines.join('\n\n') || 'Aucune enchère sur cette page.',
          )
          .setFooter({
            text: `SoraRNG · Page ${page}${auctions.length > 10 ? ' · Une page suivante est disponible avec l’option page' : ''}`,
          }),
      ],
      components: [
        links(site, [
          ['Ouvrir le marché', '/trade'],
          ['Ma collection', '/collection'],
        ]),
      ],
    });
    return true;
  }
  if (command === 'wishlist') {
    const action = interaction.options.getSubcommand();
    if (action !== 'afficher') {
      const card = exactCard(
        cards,
        interaction.options.getString('carte', true),
      );
      await store.wishlist(
        user,
        `discord:${interaction.id}`,
        card.id,
        action === 'ajouter',
      );
      await send({
        embeds: [
          embed(
            action === 'ajouter'
              ? 'Carte ajoutée à la wishlist'
              : 'Carte retirée de la wishlist',
          ).setDescription(cardLine(card)),
        ],
        components: [links(site, [['Voir ma wishlist', '/collection']])],
      });
      return true;
    }
    const profile = await store.profile(user);
    const wanted = cards.filter((c) => profile.state.wishlist?.includes(c.id));
    const page = interaction.options.getInteger('page') ?? 1;
    await send({
      embeds: [
        embed('Votre wishlist')
          .setDescription(
            wanted
              .slice((page - 1) * 10, page * 10)
              .map(cardLine)
              .join('\n\n') ||
              'Aucune carte sur cette page. Ajoutez-en avec /wishlist ajouter.',
          )
          .setFooter({
            text: `SoraRNG · ${wanted.length} cartes recherchées · Page ${page}/${Math.max(1, Math.ceil(wanted.length / 10))}`,
          }),
      ],
      components: [links(site, [['Voir mon profil', `/profile/${user}`]])],
    });
    return true;
  }
  const target =
    command === 'collection' ? interaction.options.getUser('pseudo') : null;
  const id = target?.id ?? user;
  const profile = await store.profile(id),
    state: Player = profile.state;
  if (command === 'vitrine') {
    const favorites = showcaseCopies(state);
    if (!favorites.length) {
      await send({
        embeds: [
          embed('Votre vitrine attend ses premières cartes').setDescription(
            'Choisissez les exemplaires à exposer dans « Personnaliser ma vitrine » sur le site.',
          ),
        ],
        components: [links(site, [['Choisir ma vitrine', '/collection']])],
      });
      return true;
    }
    const embeds = favorites.flatMap((copy) => {
      const card = cards.find((c) => c.id === copy.cardId);
      if (!card) return [];
      return [
        cardEmbed(card, site)
          .setDescription(
            `${card.rarity}${copy.holo ? ' · ✦ Holographique' : ''}\nNiveau ${copy.level} · Éveil ${copy.awakening}`,
          )
          .setAuthor({ name: `Vitrine de ${profile.name}`.slice(0, 256) }),
      ];
    });
    await send({
      content: `Vitrine de **${escapeMarkdown(profile.name)}** · carte vedette en premier.`,
      embeds,
      components: [links(site, [['Voir le profil', `/profile/${id}`]])],
    });
    return true;
  }
  const models = cards.filter((card) =>
    state.copies.some((copy) => copy.cardId === card.id),
  );
  const page = interaction.options.getInteger('page') ?? 1;
  const lines = models.slice((page - 1) * 10, page * 10).map((card) => {
    const copies = state.copies.filter((copy) => copy.cardId === card.id),
      holo = copies.filter((copy) => copy.holo).length;
    return `${cardLine(card)}\n${copies.length} exemplaire(s)${holo ? ` · ${holo} holo` : ''}`;
  });
  await send({
    embeds: [
      embed(`Collection de ${profile.name}`)
        .setDescription(lines.join('\n\n') || 'Aucune carte sur cette page.')
        .addFields(
          {
            name: 'Exemplaires disponibles',
            value: String(state.copies.length),
            inline: true,
          },
          {
            name: 'Modèles présents',
            value: `${models.length} / 150`,
            inline: true,
          },
          {
            name: 'Holographiques',
            value: String(state.copies.filter((c) => c.holo).length),
            inline: true,
          },
        )
        .setFooter({
          text: `SoraRNG · Page ${page}/${Math.max(1, Math.ceil(models.length / 10))} · Les cartes en vente sont réservées au marché`,
        }),
    ],
    components: [links(site, [['Voir le profil', `/profile/${id}`]])],
  });
  return true;
}
