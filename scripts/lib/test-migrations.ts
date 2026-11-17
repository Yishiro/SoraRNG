import { readdir, readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
export async function applyTestMigrations(db: Pool) {
  const entries = await readdir('prisma/migrations', { withFileTypes: true });
  for (const name of entries
    .filter((e) => e.isDirectory() && /^\d+_/.test(e.name))
    .map((e) => e.name)
    .sort())
    await db.query(
      await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'),
    );
}
