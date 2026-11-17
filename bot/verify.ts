import { REST, Routes } from 'discord.js';
import { botConfig } from './config';
async function main() {
  const config = botConfig(process.env, { database: false });
  const rest = new REST({ version: '10', timeout: 10000 }).setToken(
    config.token,
  );
  const application = (await rest.get(Routes.oauth2CurrentApplication())) as {
    id: string;
  };
  if (application.id !== config.applicationId)
    throw new Error('Incorrect application');
  const route = config.guildId
    ? Routes.applicationGuildCommands(config.applicationId, config.guildId)
    : Routes.applicationCommands(config.applicationId);
  const commands = (await rest.get(route)) as { name: string }[];
  const guilds = (await rest.get(Routes.userGuilds())) as { id: string }[];
  console.log(
    JSON.stringify({
      applicationId: application.id,
      authenticated: true,
      commands: commands.map((c) => c.name),
      guildCount: guilds.length,
    }),
  );
}
main().catch(() => {
  console.error(
    'Vérification Discord impossible ; vérifier les identifiants et la connexion. Aucun secret affiché.',
  );
  process.exitCode = 1;
});
