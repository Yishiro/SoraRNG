import { pool } from './postgres';
import { initialPlayer } from '../game/core';
import { PlayerSuspended } from './permissions';
export async function ensurePlayer(id: string, name: string) {
  const result = await pool.query(
    "INSERT INTO \"Player\" (id,name,state) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name WHERE COALESCE(\"Player\".state#>>'{moderation,suspended}','false')<>'true' RETURNING id",
    [id, name, JSON.stringify(initialPlayer())],
  );
  if (!result.rowCount) throw new PlayerSuspended();
}
