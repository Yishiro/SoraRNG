CREATE TABLE "Player" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "state" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE "Catalogue" (
  "id" TEXT PRIMARY KEY,
  "cards" JSONB NOT NULL,
  "version" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE "Operation" (
  "id" TEXT PRIMARY KEY,
  "playerId" TEXT NOT NULL REFERENCES "Player"("id"),
  "key" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "delta" INTEGER NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("playerId", "key")
);
CREATE INDEX "Operation_player_time" ON "Operation"("playerId", "createdAt");
