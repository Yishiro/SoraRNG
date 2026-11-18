-- Guildes : un joueur appartient à une seule guilde.
CREATE TABLE "Guild" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "ownerId" TEXT NOT NULL REFERENCES "Player"(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "Guild_name_key" ON "Guild" (lower(name));
CREATE TABLE "GuildMember" (
  "playerId" TEXT PRIMARY KEY REFERENCES "Player"(id),
  "guildId" TEXT NOT NULL REFERENCES "Guild"(id) ON DELETE CASCADE,
  "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "GuildMember_guild" ON "GuildMember" ("guildId");

-- Tableau d'annonces payantes, visibles 24 h.
CREATE TABLE "Announcement" (
  id TEXT PRIMARY KEY,
  "playerId" TEXT NOT NULL REFERENCES "Player"(id),
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  "cardIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "expiresAt" TIMESTAMPTZ NOT NULL
);
CREATE INDEX "Announcement_active" ON "Announcement" (status, "expiresAt");
CREATE INDEX "Announcement_player" ON "Announcement" ("playerId", status);
