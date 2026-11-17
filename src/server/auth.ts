import type { NextAuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';
import { ensurePlayer } from './players';
import { discordId, safeAuthRedirect, safeAuthLogCode } from './auth-policy';
import { PlayerSuspended } from './permissions';
// NextAuth v4 is CommonJS; native ESM/tsx may expose an extra default wrapper.
const discordProvider =
  typeof DiscordProvider === 'function'
    ? DiscordProvider
    : (DiscordProvider as unknown as { default: typeof DiscordProvider })
        .default;
// No provider is exposed until real application credentials have been configured.
export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  jwt: { maxAge: 30 * 24 * 60 * 60 },
  debug: false,
  pages: { signIn: '/auth/signin', error: '/auth/error' },
  logger: {
    error(code) {
      console.error('[auth]', safeAuthLogCode(code));
    },
    warn(code) {
      console.warn('[auth]', safeAuthLogCode(code));
    },
    debug() {},
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      const id = (profile as { id?: unknown } | undefined)?.id;
      if (
        account?.provider !== 'discord' ||
        !discordId(id) ||
        id !== account.providerAccountId ||
        user.id !== id
      )
        return false;
      try {
        await ensurePlayer(id, (user.name?.trim() || 'Voyageur').slice(0, 80));
      } catch (error) {
        if (error instanceof PlayerSuspended) return false;
        throw new Error('PROFILE_CREATION_FAILED');
      }
      return true;
    },
    async redirect({ url, baseUrl }) {
      return safeAuthRedirect(url, baseUrl);
    },
    async jwt({ token, account }) {
      if (account) {
        if (
          account.provider !== 'discord' ||
          !discordId(account.providerAccountId)
        )
          throw new Error('INVALID_DISCORD_IDENTITY');
        token.discordId = account.providerAccountId;
        token.sub = account.providerAccountId;
      }
      // Session updates from the browser never overwrite the verified identity.
      return token;
    },
    async session({ session, token }) {
      if (session.user)
        Object.assign(session.user, {
          id: discordId(token.discordId) ? token.discordId : undefined,
        });
      return session;
    },
  },
  providers:
    discordId(process.env.AUTH_DISCORD_ID) &&
    process.env.AUTH_DISCORD_SECRET &&
    (process.env.AUTH_SECRET?.length ?? 0) >= 32
      ? [
          discordProvider({
            clientId: process.env.AUTH_DISCORD_ID,
            clientSecret: process.env.AUTH_DISCORD_SECRET,
            authorization: { params: { scope: 'identify' } },
            checks: ['state'],
            issuer: 'https://discord.com',
          }),
        ]
      : [],
};
