import { z } from 'zod';
const schema = z.object({
  playerId: z.string().min(1).max(80),
  key: z.uuid(),
  path: z.enum(['/api/game', '/api/economy']),
  kind: z.string().min(1).max(40),
  payload: z.record(z.string(), z.unknown()),
  baseline: z
    .object({
      discoveries: z.array(z.string()),
      owned: z.record(z.string(), z.number()),
    })
    .optional(),
});
export type PendingAction = z.infer<typeof schema>;
const storageKey = (playerId: string) =>
  `sorarng.pending-action.v1:${playerId}`;
export function restoreAction(playerId: string): PendingAction | null {
  try {
    const raw = sessionStorage.getItem(storageKey(playerId));
    if (!raw) return null;
    const value = schema.safeParse(JSON.parse(raw));
    return value.success && value.data.playerId === playerId
      ? value.data
      : null;
  } catch {
    return null;
  }
}
export function saveAction(action: PendingAction) {
  try {
    sessionStorage.setItem(storageKey(action.playerId), JSON.stringify(action));
  } catch {
    /* The in-memory copy still protects retries in this page. */
  }
}
export function clearAction(action: PendingAction) {
  try {
    const stored = restoreAction(action.playerId);
    if (stored?.key === action.key)
      sessionStorage.removeItem(storageKey(action.playerId));
  } catch {}
}
export function sameAction(
  a: PendingAction,
  b: Pick<PendingAction, 'path' | 'kind' | 'payload'>,
) {
  return (
    a.path === b.path &&
    a.kind === b.kind &&
    JSON.stringify(a.payload) === JSON.stringify(b.payload)
  );
}
