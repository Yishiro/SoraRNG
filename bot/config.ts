import { z } from 'zod';
const snowflake = z.string().regex(/^\d{17,20}$/);
export function botConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
  { database = true }: { database?: boolean } = {},
) {
  const schema = z.object({
    token: z.string().min(20).regex(/^\S+$/),
    applicationId: snowflake,
    guildId: snowflake.optional(),
    site: z.url().refine((value) => {
      const url = new URL(value);
      return (
        ['https:', 'http:'].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        url.pathname === '/' &&
        !url.search &&
        !url.hash
      );
    }),
    databaseUrl: z.string().min(1).optional(),
  });
  const parsed = schema.safeParse({
    token: env.DISCORD_BOT_TOKEN,
    applicationId: env.DISCORD_APPLICATION_ID || env.AUTH_DISCORD_ID,
    guildId: env.DISCORD_GUILD_ID || undefined,
    site: env.DISCORD_SITE_URL || env.NEXTAUTH_URL,
    databaseUrl: env.DATABASE_URL,
  });
  if (!parsed.success || (database && !parsed.data.databaseUrl))
    throw new Error(
      'Configuration du bot incomplète ou invalide. Vérifier les variables Discord, URL du site et base de données.',
    );
  const config = parsed.data;
  if (
    env.NODE_ENV === 'production' &&
    new URL(config.site).protocol !== 'https:'
  )
    throw new Error('Le bot de production exige une URL de site HTTPS.');
  return { ...config, site: new URL(config.site).origin };
}
