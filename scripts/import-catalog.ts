import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { importCatalog } from '../src/server/catalog-import';
import { Pool } from 'pg';
const path = process.argv[2] ?? 'data/kingdom_hearts_catalogue_150.json';
const raw = await readFile(path, 'utf8');
const db = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  console.log(await importCatalog(db, raw));
} finally {
  await db.end();
}
