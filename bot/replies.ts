import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { z } from 'zod';
export function replyVisibility(command: string) {
  return command === 'collection'
    ? {}
    : { flags: MessageFlags.Ephemeral as const };
}
const stateSchema = z.object({
  munny: z.number().int().nonnegative(),
  tickets: z.number().int().nonnegative(),
  fragments: z.number().int().nonnegative(),
  summons: z.number().int().nonnegative(),
  copies: z.array(z.object({ cardId: z.string(), holo: z.boolean() })),
  discoveries: z.array(z.string()).optional(),
  wishlist: z.array(z.string()).optional(),
  moderation: z.object({ suspended: z.boolean() }).optional(),
});
export type BotReader = { findState: (id: string) => Promise<unknown | null> };
function link(site: string, path: string, label: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel(label)
      .setURL(new URL(path, site).toString()),
  );
}
const allowedMentions = { parse: [] as never[] };
export async function botReply(
  command: string,
  userId: string,
  site: string,
  reader: BotReader,
) {
  const embed = new EmbedBuilder()
    .setColor(0x303033)
    .setFooter({ text: 'SoraRNG · Collection Kingdom Hearts' });
  if (command === 'play')
    return {
      embeds: [
        embed
          .setTitle('Vos boosters Kingdom Hearts')
          .setDescription(
            'Connectez-vous au site avec Discord pour ouvrir vos boosters avec des Munny ou un ticket et retrouver votre collection.',
          ),
      ],
      components: [link(site, '/summon', 'Ouvrir les boosters')],
      allowedMentions,
    };
  if (command === 'help')
    return {
      embeds: [
        embed
          .setTitle('Les commandes de SoraRNG')
          .setDescription(
            '/play — Ouvrir le site et les boosters\n/profile — Consulter vos ressources et votre progression\n/collection — Partager votre collection dans le salon\n/quetes — Quêtes du jour ou de la semaine\n/serie — Série de connexion\n/guilde — Progression de votre guilde\n/saison · /leaderboard — Classement de la saison\n/solde [pseudo] — Portefeuille et épargne, visibles par tout le salon\n/hourly · /daily · /weekly · /monthly — Bonus\n/banque — Déposer ou retirer\n/roulette · /guess — Jouer contre le bot\n/coinflip · /duel-des — Défier un joueur\n/help — Afficher cette aide',
          )
          .addFields(
            {
              name: 'Collection et marché',
              value:
                '/carte nom — Illustration, légende et prix moyen\n/collection [pseudo] [page] — Collection d’un membre\n/wishlist afficher · ajouter · retirer — Vos cartes recherchées\n/marche [carte] [page] — Enchères en cours\n/ventes [page] — Vos ventes (privé)\n/vitrine — Partager cinq cartes favorites du site\n/historique — Dix derniers mouvements (privé)\n/bonus — Disponibilité des quatre bonus (privé)',
            },
            {
              name: 'Votre compte',
              value:
                'Connectez-vous au site avec le même compte Discord pour retrouver votre progression. Le bot ne crée pas de profil. Le site et Discord partagent les mêmes Munny et bonus.',
            },
          ),
      ],
      components: [link(site, '/dashboard', 'Ouvrir SoraRNG')],
      allowedMentions,
    };
  if (command === 'leaderboard')
    return {
      embeds: [
        embed
          .setTitle('Classement — En construction')
          .setDescription(
            'Le classement sera disponible prochainement, comme sur le site.',
          ),
      ],
      components: [link(site, '/dashboard', 'Retour à l’accueil')],
      allowedMentions,
    };
  if (
    !['profile', 'collection'].includes(command) ||
    !/^\d{17,20}$/.test(userId)
  )
    return { content: 'Commande inconnue. Utilisez /help.', allowedMentions };
  const raw = await reader.findState(userId);
  if (raw === null)
    return {
      embeds: [
        embed
          .setTitle('Votre collection commence sur le site')
          .setDescription(
            'Aucun profil associé à ce compte Discord. Connectez-vous sur SoraRNG avec ce même compte pour commencer.',
          ),
      ],
      components: [link(site, '/auth/signin', 'Se connecter au site')],
      allowedMentions,
    };
  const parsed = stateSchema.safeParse(raw);
  if (!parsed.success)
    return {
      content:
        'Votre profil est temporairement indisponible. Réessayez depuis le site.',
      allowedMentions,
    };
  const state = parsed.data;
  if (state.moderation?.suspended)
    return {
      content: 'Ce compte est suspendu. Contactez l’équipe du site.',
      allowedMentions,
    };
  const models = new Set(state.copies.map((copy) => copy.cardId)).size;
  embed
    .setTitle(
      command === 'profile'
        ? 'Votre profil SoraRNG'
        : 'Votre collection SoraRNG',
    )
    .addFields(
      {
        name: 'Exemplaires',
        value: state.copies.length.toLocaleString('fr-FR'),
        inline: true,
      },
      {
        name: command === 'profile' ? 'Codex' : 'Modèles présents',
        value: `${command === 'profile' ? new Set(state.discoveries ?? state.copies.map((copy) => copy.cardId)).size : models} / 150`,
        inline: true,
      },
      {
        name: 'Holographiques',
        value: state.copies
          .filter((copy) => copy.holo)
          .length.toLocaleString('fr-FR'),
        inline: true,
      },
    );
  if (command === 'profile')
    embed.addFields(
      {
        name: 'Wishlist',
        value: `${state.wishlist?.length ?? 0} cartes recherchées · visible sur votre profil`,
        inline: true,
      },
      {
        name: 'Munny',
        value: state.munny.toLocaleString('fr-FR'),
        inline: true,
      },
      { name: 'Tickets', value: String(state.tickets), inline: true },
      { name: 'Fragments', value: String(state.fragments), inline: true },
      { name: 'Invocations', value: String(state.summons), inline: true },
    );
  return {
    embeds: [embed],
    components: [
      link(
        site,
        command === 'profile' ? `/profile/${userId}` : '/collection',
        command === 'profile' ? 'Voir mon profil' : 'Voir ma collection',
      ),
    ],
    allowedMentions,
  };
}
