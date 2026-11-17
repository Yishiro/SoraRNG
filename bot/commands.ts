import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
const basics = [
  ['play', 'Ouvrir le site et les boosters SoraRNG'],
  ['profile', 'Afficher votre profil global'],
  ['collection', 'Consulter votre collection globale'],
  ['leaderboard', 'Classement — en construction'],
  ['help', 'Aide et commandes SoraRNG'],
] as const;
const builders = basics.map(([name, description]) =>
  new SlashCommandBuilder().setName(name).setDescription(description),
);
builders
  .find((command) => command.name === 'collection')!
  .addUserOption((option) =>
    option
      .setName('pseudo')
      .setDescription('Collection de ce membre ; vous par défaut'),
  )
  .addIntegerOption((option) =>
    option
      .setName('page')
      .setDescription('Page de 10 modèles')
      .setMinValue(1)
      .setMaxValue(15),
  );
const collectorCommands = [
  new SlashCommandBuilder()
    .setName('carte')
    .setDescription('Illustration, légende et prix moyen d’une carte')
    .addStringOption((option) =>
      option
        .setName('nom')
        .setDescription('Choisissez la version exacte de la carte')
        .setRequired(true)
        .setAutocomplete(true),
    ),
  new SlashCommandBuilder()
    .setName('marche')
    .setDescription('Consulter les enchères en cours')
    .addStringOption((option) =>
      option
        .setName('carte')
        .setDescription('Filtrer par carte et version')
        .setAutocomplete(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('page')
        .setDescription('Page de 10 enchères')
        .setMinValue(1)
        .setMaxValue(100),
    ),
  new SlashCommandBuilder()
    .setName('ventes')
    .setDescription('Consulter vos enchères et vos ventes en privé')
    .addIntegerOption((option) =>
      option
        .setName('page')
        .setDescription('Page de 10 ventes')
        .setMinValue(1)
        .setMaxValue(100),
    ),
  new SlashCommandBuilder()
    .setName('historique')
    .setDescription('Vos dix derniers mouvements de Munny, en privé'),
  new SlashCommandBuilder()
    .setName('bonus')
    .setDescription(
      'Disponibilité et prochaine réclamation de vos quatre bonus',
    ),
  new SlashCommandBuilder()
    .setName('vitrine')
    .setDescription(
      'Partager jusqu’à cinq cartes favorites choisies sur le site',
    ),
  new SlashCommandBuilder()
    .setName('wishlist')
    .setDescription('Consulter et modifier vos cartes recherchées')
    .addSubcommand((command) =>
      command
        .setName('afficher')
        .setDescription('Afficher vos cartes recherchées')
        .addIntegerOption((option) =>
          option
            .setName('page')
            .setDescription('Page de 10 cartes')
            .setMinValue(1)
            .setMaxValue(15),
        ),
    )
    .addSubcommand((command) =>
      command
        .setName('ajouter')
        .setDescription('Ajouter une carte à votre wishlist')
        .addStringOption((option) =>
          option
            .setName('carte')
            .setDescription('Carte et version à rechercher')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((command) =>
      command
        .setName('retirer')
        .setDescription('Retirer une carte de votre wishlist')
        .addStringOption((option) =>
          option
            .setName('carte')
            .setDescription('Carte à retirer')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    ),
];
for (const [name, description] of [
  ['hourly', 'Réclamer votre bonus horaire'],
  ['daily', 'Réclamer votre bonus quotidien commun au site'],
  ['weekly', 'Réclamer votre bonus hebdomadaire'],
  ['monthly', 'Réclamer votre bonus mensuel'],
] as const)
  builders.push(
    new SlashCommandBuilder().setName(name).setDescription(description),
  );
const balance = new SlashCommandBuilder()
  .setName('solde')
  .setDescription(
    'Afficher publiquement le portefeuille et l’épargne d’un membre',
  )
  .addUserOption((option) =>
    option
      .setName('pseudo')
      .setDescription('Membre à consulter ; vous par défaut')
      .setRequired(false),
  );
const bank = new SlashCommandBuilder()
  .setName('banque')
  .setDescription('Gérer votre épargne');
bank.addSubcommand((command) =>
  command.setName('solde').setDescription('Consulter votre épargne'),
);
for (const name of ['deposer', 'retirer'])
  bank.addSubcommand((command) =>
    command
      .setName(name)
      .setDescription(
        name === 'deposer' ? 'Déposer des Munny' : 'Retirer des Munny',
      )
      .addStringOption((option) =>
        option
          .setName('montant')
          .setDescription('Montant entier, all ou tout (tout le disponible)')
          .setRequired(true),
      ),
  );
const roulette = new SlashCommandBuilder()
  .setName('roulette')
  .setDescription('Jouer à la roulette')
  .addStringOption((option) =>
    option
      .setName('mise')
      .setDescription('Montant entier, all ou tout (tout le disponible)')
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName('choix')
      .setDescription('Rouge, noir, vert ou un numéro de 0 à 36')
      .setRequired(true),
  );
const guess = new SlashCommandBuilder()
  .setName('guess')
  .setDescription('Trouver un nombre entre 1 et 100 en cinq essais')
  .addStringOption((option) =>
    option
      .setName('mise')
      .setDescription('Montant entier, all ou tout (tout le disponible)')
      .setRequired(true),
  );
const duels = ['coinflip', 'duel-des'].map((name) => {
  const command = new SlashCommandBuilder()
    .setName(name)
    .setDescription(
      name === 'duel-des'
        ? 'Défier un joueur aux dés'
        : 'Défier un joueur à pile ou face',
    )
    .addUserOption((option) =>
      option
        .setName('adversaire')
        .setDescription('Le joueur à défier')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('mise')
        .setDescription('Montant entier, all ou tout (tout le disponible)')
        .setRequired(true),
    );
  if (name !== 'duel-des')
    command.addStringOption((option) =>
      option
        .setName('cote')
        .setDescription('Votre côté')
        .addChoices(
          { name: 'Pile', value: 'pile' },
          { name: 'Face', value: 'face' },
        ),
    );
  return command;
});
const donation = new SlashCommandBuilder()
  .setName('don')
  .setDescription('Donner des Munny à un membre avec confirmation')
  .addUserOption((option) =>
    option.setName('membre').setDescription('Destinataire').setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName('montant')
      .setDescription('Montant entier, all ou tout (tout le disponible)')
      .setRequired(true),
  );
export const commands = [
  new SlashCommandBuilder()
    .setName('defi-maintenant')
    .setDescription('Envoyer immédiatement un défi dans le salon configuré')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('defis')
    .setDescription('Configurer les défis automatiques du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) =>
      option
        .setName('salon')
        .setDescription('Salon des défis')
        .addChannelTypes(ChannelType.GuildText),
    )
    .addIntegerOption((option) =>
      option
        .setName('minutes')
        .setDescription('Fréquence (20 minutes par défaut)')
        .setMinValue(1)
        .setMaxValue(1440),
    )
    .addBooleanOption((option) =>
      option.setName('actif').setDescription('Activer ou mettre en pause'),
    ),
  new SlashCommandBuilder()
    .setName('double')
    .setDescription('Tenter de doubler votre mise')
    .addStringOption((option) =>
      option
        .setName('mise')
        .setDescription('Montant entier, all ou tout (tout le disponible)')
        .setRequired(true),
    ),
  donation,
  ...builders,
  ...collectorCommands,
  balance,
  bank,
  roulette,
  guess,
  ...duels,
].map((command) => command.toJSON());
