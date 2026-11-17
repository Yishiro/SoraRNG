CREATE TABLE "AdminAudit" (
  id TEXT PRIMARY KEY,
  "actorId" TEXT NOT NULL,
  key TEXT NOT NULL,
  action TEXT NOT NULL,
  "targetId" TEXT,
  reason TEXT NOT NULL,
  request JSONB NOT NULL,
  result JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("actorId",key)
);
CREATE INDEX "AdminAudit_time" ON "AdminAudit"("createdAt");
CREATE TABLE "Event" (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  "startsAt" TIMESTAMPTZ NOT NULL,
  "endsAt" TIMESTAMPTZ NOT NULL,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  revision INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ("endsAt">"startsAt")
);
