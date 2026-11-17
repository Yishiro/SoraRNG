import type { PoolClient } from 'pg';

export async function walletAuditContext(
  db: PoolClient,
  context: { source: string; kind: string; actor?: string; reference?: string },
) {
  await db.query("SELECT set_config('sorarng.wallet_audit',$1,true)", [
    JSON.stringify(context),
  ]);
}
