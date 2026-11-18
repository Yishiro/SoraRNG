import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { AuthenticationRequired, discordId } from './auth-policy';
import { PlayerSuspended } from './permissions';
import { pool } from './play';
export * from './play';

export async function identity() {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!discordId(id)) throw new AuthenticationRequired();
  const account = (
    await pool.query(
      'SELECT state#>>\'{moderation,suspended}\' AS suspended FROM "Player" WHERE id=$1',
      [id],
    )
  ).rows[0];
  if (account?.suspended === 'true') throw new PlayerSuspended();
  return { id, name: session?.user?.name ?? 'Voyageur' };
}
