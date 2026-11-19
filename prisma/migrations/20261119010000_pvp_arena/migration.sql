-- Arène PvP : équipe de défense, classement Elo, combats et règlement mensuel.
CREATE TABLE "PvpTeam" (
  "playerId" TEXT PRIMARY KEY REFERENCES "Player"(id),
  "copyIds" JSONB NOT NULL,
  power INTEGER NOT NULL,
  league TEXT NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "PvpTeam_league" ON "PvpTeam" (league, power);

CREATE TABLE "PvpRating" (
  "playerId" TEXT PRIMARY KEY REFERENCES "Player"(id),
  rating INTEGER NOT NULL DEFAULT 1000,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  "attackDay" TEXT NOT NULL DEFAULT '',
  "attacksUsed" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "PvpBattle" (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  "attackerId" TEXT NOT NULL REFERENCES "Player"(id),
  "defenderId" TEXT NOT NULL REFERENCES "Player"(id),
  state JSONB NOT NULL,
  log JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  winner TEXT,
  result JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "PvpBattle_attacker" ON "PvpBattle" ("attackerId", status);
CREATE INDEX "PvpBattle_defender" ON "PvpBattle" ("defenderId", "createdAt");
CREATE INDEX "PvpBattle_finished" ON "PvpBattle" (status, "updatedAt");

CREATE TABLE "PvpSettlement" (
  id TEXT PRIMARY KEY,
  standings JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
