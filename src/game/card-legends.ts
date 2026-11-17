import legends from '../../data/card-legends.fr.json';
const byId: Readonly<Record<string, string>> = legends;
/** Original SoraRNG flavour text, kept separate from the immutable game catalogue. */
export function getCardLegend(id: string): string | null {
  return byId[id] ?? null;
}
