import { pool } from '../../../src/server/postgres';
export async function GET() {
  try {
    return Response.json(
      (
        await pool.query(
          'SELECT id,title,description,"startsAt","endsAt",revision,published,"updatedAt" FROM "Event" WHERE published=TRUE ORDER BY "startsAt" DESC,id LIMIT 100',
        )
      ).rows,
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { error: 'Événements temporairement indisponibles' },
      { status: 503 },
    );
  }
}
