import { z } from 'zod';
import { rarities } from './config';

export const marketQuery = z.object({
  page: z.coerce.number().int().min(1).max(1000000).catch(1),
  view: z.enum(['open', 'offers', 'sales']).catch('open'),
  search: z.string().trim().max(100).catch(''),
  rarity: z.enum(['Toutes', ...rarities]).catch('Toutes'),
  finish: z.enum(['all', 'holo', 'standard']).catch('all'),
  sort: z.enum(['ending', 'newest', 'price-low', 'price-high']).catch('ending'),
  card: z
    .string()
    .regex(/^KH-\d{3}$/)
    .catch(''),
  auction: z.uuid().catch(''),
});
export type MarketQuery = z.infer<typeof marketQuery>;
export const marketPageSize = 24;
