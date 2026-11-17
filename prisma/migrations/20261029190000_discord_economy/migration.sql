CREATE TABLE "EconomyOperation" (
 "id" TEXT PRIMARY KEY,"playerId" TEXT NOT NULL REFERENCES "Player"("id"),"key" TEXT NOT NULL,"kind" TEXT NOT NULL,"delta" BIGINT NOT NULL,"request" JSONB NOT NULL,"result" JSONB NOT NULL,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE("playerId","key")
);
CREATE INDEX "EconomyOperation_playerId_createdAt_idx" ON "EconomyOperation"("playerId","createdAt");
CREATE TABLE "EconomyGame" (
 "id" TEXT PRIMARY KEY,"authorId" TEXT NOT NULL REFERENCES "Player"("id"),"opponentId" TEXT REFERENCES "Player"("id"),"kind" TEXT NOT NULL,"status" TEXT NOT NULL,"state" JSONB NOT NULL,"expiresAt" TIMESTAMPTZ,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "EconomyGame_status_expiresAt_idx" ON "EconomyGame"("status","expiresAt");
CREATE INDEX "EconomyGame_authorId_status_idx" ON "EconomyGame"("authorId","status");
CREATE INDEX "EconomyGame_opponentId_status_idx" ON "EconomyGame"("opponentId","status");
-- Preserve the last actual legacy daily claim, rather than resetting its cooldown.
UPDATE "Player" p SET state=jsonb_set(p.state,'{finance}',jsonb_build_object('claims',jsonb_build_object('daily',floor(extract(epoch FROM o.at)*1000)::bigint),'bank',jsonb_build_object('micros','0','at',floor(extract(epoch FROM NOW())*1000)::bigint),'reserved',0,'liability',0)) FROM (SELECT "playerId",MAX("createdAt") at FROM "Operation" WHERE kind='daily' GROUP BY "playerId") o WHERE p.id=o."playerId" AND NOT(p.state ? 'finance');
