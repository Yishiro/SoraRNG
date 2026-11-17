export type GameEvent = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  published: boolean;
  revision: number;
  updatedAt: string;
};
export function eventStatus(
  event: Pick<GameEvent, 'startsAt' | 'endsAt'>,
  now: number,
) {
  return now < new Date(event.startsAt).getTime()
    ? 'upcoming'
    : now >= new Date(event.endsAt).getTime()
      ? 'ended'
      : 'active';
}
