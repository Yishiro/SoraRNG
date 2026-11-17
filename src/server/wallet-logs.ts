import { z } from 'zod';
import { pool } from './postgres';
import { requireStaff } from './permissions';
export const walletLogQuery = z.object({
  q: z.string().max(80).default(''),
  player: z
    .string()
    .regex(/^\d{17,20}$/)
    .optional(),
  source: z
    .enum(['all', 'site', 'economy', 'market', 'admin', 'system'])
    .default('all'),
  direction: z.enum(['all', 'debit', 'credit']).default('all'),
  mode: z.enum(['ledger', 'legacy']).default('ledger'),
  from: z.iso.datetime({ offset: true }).optional(),
  until: z.iso.datetime({ offset: true }).optional(),
  cursor: z.string().max(300).optional(),
});
type Query = z.infer<typeof walletLogQuery>;
export type WalletAmounts = {
  wallet: number | null;
  bankMicros?: string;
  reserved?: number;
  liability?: number;
};
export type WalletLog = {
  id: string;
  playerId: string;
  playerName: string;
  source: string;
  kind: string;
  actorId: string | null;
  reference: string | null;
  before: WalletAmounts | null;
  after: WalletAmounts;
  createdAt: string;
  legacy?: boolean;
  detail?: Record<string, unknown>;
};
export type WalletLogs = {
  entries: WalletLog[];
  nextCursor: string | null;
  player: null | { id: string; name: string; amounts: WalletAmounts };
};
export async function walletLogs(
  actor: string,
  input: Query,
): Promise<WalletLogs> {
  requireStaff(actor);
  let cursor: { id: string; at?: string } | null = null;
  if (input.cursor) {
    cursor = z
      .object({ id: z.string().max(100), at: z.iso.datetime().optional() })
      .parse(JSON.parse(Buffer.from(input.cursor, 'base64url').toString()));
    if (input.mode === 'ledger')
      z.string()
        .regex(/^\d{1,20}$/)
        .parse(cursor.id);
    else if (!cursor.at) throw new Error('Curseur invalide');
  }
  const common = [
    `%${input.q}%`,
    input.player ?? null,
    input.source,
    input.direction,
    input.from ?? null,
    input.until ?? null,
  ];
  let rows;
  if (input.mode === 'ledger')
    rows = (
      await pool.query(
        `
    SELECT l.*,l.id::text AS id,COALESCE(p.name,l."playerId") AS "playerName"
    FROM "WalletLedger" l LEFT JOIN "Player" p ON p.id=l."playerId"
    WHERE (l."playerId" ILIKE $1 OR p.name ILIKE $1) AND ($2::text IS NULL OR l."playerId"=$2)
    AND ($3='all' OR source=$3)
    AND ($4='all' OR ($4='debit' AND (after->>'wallet')::numeric < (before->>'wallet')::numeric) OR ($4='credit' AND (after->>'wallet')::numeric > (before->>'wallet')::numeric))
    AND ($5::timestamptz IS NULL OR l."createdAt">=$5) AND ($6::timestamptz IS NULL OR l."createdAt"<$6)
    AND ($7::bigint IS NULL OR l.id<$7) ORDER BY l.id DESC LIMIT 51
  `,
        [...common, cursor?.id ?? null],
      )
    ).rows;
  else
    rows = (
      await pool.query(
        `
    WITH logs AS (
      SELECT 'site:'||id AS id,"playerId",CASE WHEN kind='admin.adjust' THEN 'admin' ELSE 'site' END AS source,kind,delta::numeric,request,result,"createdAt" FROM "Operation"
      UNION ALL SELECT 'economy:'||id,"playerId",'economy',kind,delta::numeric,request,result,"createdAt" FROM "EconomyOperation"
    ) SELECT l.id,l."playerId",p.name AS "playerName",source,kind,NULL AS "actorId",NULL AS reference,
      CASE WHEN result#>>'{resources,before,munny}' IS NOT NULL THEN jsonb_build_object('wallet',(result#>>'{resources,before,munny}')::numeric)
        WHEN result->>'wallet' IS NOT NULL THEN jsonb_build_object('wallet',(result->>'wallet')::numeric-delta) ELSE NULL END AS before,
      jsonb_build_object('wallet',COALESCE((result#>>'{resources,after,munny}')::numeric,(result->>'wallet')::numeric)) AS after,
      l."createdAt",to_char(l."createdAt" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorAt",
      jsonb_strip_nulls(jsonb_build_object('amount',request->'amount','bonus',request->'type','mode',request->'mode','item',request->'item','recipient',request->'recipient','resource',request->'resource','adjustment',request->'delta')) AS detail,true AS legacy
    FROM logs l JOIN "Player" p ON p.id=l."playerId"
    WHERE (l."playerId" ILIKE $1 OR p.name ILIKE $1) AND ($2::text IS NULL OR l."playerId"=$2)
      AND ($3='all' OR source=$3) AND ($4='all' OR ($4='debit' AND delta<0) OR ($4='credit' AND delta>0))
      AND ($5::timestamptz IS NULL OR l."createdAt">=$5) AND ($6::timestamptz IS NULL OR l."createdAt"<$6)
      AND ($7::timestamptz IS NULL OR (l."createdAt",l.id)<($7::timestamptz,$8::text))
    ORDER BY l."createdAt" DESC,l.id DESC LIMIT 51
  `,
        [...common, cursor?.at ?? null, cursor?.id ?? null],
      )
    ).rows;
  const entries = rows.slice(0, 50).map((row) => ({
    ...row,
    createdAt: new Date(row.createdAt).toISOString(),
  }));
  const last = entries.at(-1);
  const nextCursor =
    rows.length > 50 && last
      ? Buffer.from(
          JSON.stringify({
            id: last.id,
            ...(input.mode === 'legacy' ? { at: last.cursorAt } : {}),
          }),
        ).toString('base64url')
      : null;
  const player = input.player
    ? ((
        await pool.query(
          'SELECT id,name,wallet_audit_snapshot(state) AS amounts FROM "Player" WHERE id=$1',
          [input.player],
        )
      ).rows[0] ?? null)
    : null;
  return { entries, nextCursor, player };
}
