import { REST, Routes } from 'discord.js';
import { botConfig } from './config';
import { commands } from './commands';
async function main() {
  const config = botConfig(process.env, { database: false });
  const rest = new REST({ version: '10', timeout: 10000 }).setToken(
    config.token,
  );
  const app = (await rest.get(Routes.oauth2CurrentApplication())) as {
    id: string;
  };
  if (app.id !== config.applicationId)
    throw new Error('Application incorrecte.');
  const route = config.guildId
    ? Routes.applicationGuildCommands(config.applicationId, config.guildId)
    : Routes.applicationCommands(config.applicationId);
  // Upsert only our commands; do not erase unrelated application commands.
  for (const command of commands) await rest.post(route, { body: command });
  const registered = (await rest.get(route)) as { id: string; name: string }[];
  for (const command of registered.filter((command) =>
    ['cf', 'partie', 'ajouter-argent'].includes(command.name),
  ))
    await rest.delete(
      config.guildId
        ? Routes.applicationGuildCommand(
            config.applicationId,
            config.guildId,
            command.id,
          )
        : Routes.applicationCommand(config.applicationId, command.id),
    );
  console.log(
    `${commands.length} commandes SoraRNG enregistrées (${config.guildId ? 'serveur de test' : 'globales'}).`,
  );
}
main().catch(() => {
  console.error(
    'Enregistrement impossible : vérifier le token, l’application et les accès Discord. Aucun secret affiché.',
  );
  process.exitCode = 1;
});
