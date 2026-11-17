CREATE TABLE "Trade" (
  id TEXT PRIMARY KEY,
  a TEXT NOT NULL REFERENCES "Player"(id),
  b TEXT NOT NULL REFERENCES "Player"(id),
  state JSONB NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 minutes',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (a <> b)
);
CREATE INDEX "Trade_members" ON "Trade"(a,b);
