import { discordId } from './auth-policy';
export type StaffRole = 'admin' | 'moderator' | 'player';
export class ForbiddenAccess extends Error {
  constructor(message = 'Accès interdit') {
    super(message);
    this.name = 'ForbiddenAccess';
  }
}
export class PlayerSuspended extends ForbiddenAccess {
  constructor() {
    super('Ce compte est suspendu. Contactez un administrateur.');
    this.name = 'PlayerSuspended';
  }
}
export function staffRole(
  id: string,
  env: Record<string, string | undefined> = process.env,
): StaffRole {
  const contains = (value: string | undefined) =>
    (value ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(discordId)
      .includes(id);
  if (contains(env.ADMIN_DISCORD_IDS)) return 'admin';
  if (contains(env.MODERATOR_DISCORD_IDS)) return 'moderator';
  return 'player';
}
export function requireStaff(id: string, adminOnly = false) {
  const role = staffRole(id);
  if (role === 'player' || (adminOnly && role !== 'admin'))
    throw new ForbiddenAccess();
  return role;
}
