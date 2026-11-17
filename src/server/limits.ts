import { pool } from './game';
export async function rateLimit(id: string, scope: string, maximum: number) {
  const row = (
    await pool.query(
      `INSERT INTO "RequestLimit" (id,count,"resetsAt") VALUES ($1,1,NOW()+INTERVAL '1 minute') ON CONFLICT(id) DO UPDATE SET count=CASE WHEN "RequestLimit"."resetsAt"<=NOW() THEN 1 ELSE "RequestLimit".count+1 END,"resetsAt"=CASE WHEN "RequestLimit"."resetsAt"<=NOW() THEN NOW()+INTERVAL '1 minute' ELSE "RequestLimit"."resetsAt" END RETURNING count`,
      [`${scope}:${id}`],
    )
  ).rows[0];
  return row.count <= maximum;
}
