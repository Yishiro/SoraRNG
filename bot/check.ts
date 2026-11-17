import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  ButtonBuilder,
  ButtonStyle,
  REST,
} from 'discord.js';
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
new SlashCommandBuilder()
  .setName('environment')
  .setDescription('Environment check')
  .toJSON();
new ButtonBuilder()
  .setCustomId('environment')
  .setLabel('Check')
  .setStyle(ButtonStyle.Primary)
  .toJSON();
new REST({ version: '10' });
client.destroy();
console.log(
  'discord.js, slash commands, buttons and REST available; no external connection.',
);
