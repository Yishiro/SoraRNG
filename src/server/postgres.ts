import { Pool } from 'pg';
const globalDb = globalThis as unknown as { gamePool?: Pool };
export const pool = (globalDb.gamePool ??= new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 8,
}));
