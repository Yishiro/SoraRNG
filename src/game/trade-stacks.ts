import type { Copy } from './core';
export function tradeStacks(copies: Copy[]) {
  const groups = new Map<
    string,
    {
      key: string;
      cardId: string;
      holo: boolean;
      level: number;
      awakening: number;
      favorite: boolean;
      copies: Copy[];
    }
  >();
  for (const copy of copies.filter((c) => !c.locked)) {
    const key = [
      copy.cardId,
      copy.holo,
      copy.level,
      copy.awakening,
      copy.favorite,
    ].join(':');
    const group = groups.get(key) ?? {
      key,
      cardId: copy.cardId,
      holo: copy.holo,
      level: copy.level,
      awakening: copy.awakening,
      favorite: copy.favorite,
      copies: [],
    };
    group.copies.push(copy);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    copies: group.copies.sort((a, b) => a.id.localeCompare(b.id)),
  }));
}
export function selectStackQuantity(
  selection: string[],
  copies: Copy[],
  quantity: number,
) {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > copies.length)
    throw new Error('Quantité invalide');
  const ids = new Set(copies.map((c) => c.id));
  const selected = copies.filter((c) => selection.includes(c.id));
  const remaining = copies.filter((c) => !selection.includes(c.id));
  const result = [
    ...selection.filter((id) => !ids.has(id)),
    ...[...selected, ...remaining].slice(0, quantity).map((c) => c.id),
  ];
  if (result.length > 50)
    throw new Error('Une offre contient au maximum 50 exemplaires');
  return result;
}
