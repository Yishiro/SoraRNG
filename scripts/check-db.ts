import { createDatabase } from '../src/server/db';
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const db = createDatabase(url);
try {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1`;
  });
  console.log('Prisma PostgreSQL connection and atomic transaction OK');
} finally {
  await db.$disconnect();
}
