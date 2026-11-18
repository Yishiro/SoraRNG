-- Contributions de guilde conservées durablement : chaque ouverture est
-- attribuée, au moment où elle a lieu, à la seule guilde du joueur.
-- Un départ ou une exclusion ne retire plus rien aux compteurs.
CREATE TABLE "GuildContribution" (
  "guildId" TEXT NOT NULL REFERENCES "Guild"(id) ON DELETE CASCADE,
  "playerId" TEXT NOT NULL REFERENCES "Player"(id),
  week TEXT NOT NULL,
  boosters INTEGER NOT NULL DEFAULT 0 CHECK (boosters >= 0),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("guildId", "playerId", week)
);
CREATE INDEX "GuildContribution_week" ON "GuildContribution" ("guildId", week);

-- Reprise de l'existant : seules les ouvertures des membres actuels, faites
-- depuis leur arrivée, peuvent être reconstituées. Les contributions d'anciens
-- membres partis avant cette migration ne sont pas récupérables (aucun
-- historique d'adhésion n'était conservé).
INSERT INTO "GuildContribution" ("guildId", "playerId", week, boosters)
SELECT m."guildId", o."playerId",
       to_char(date_trunc('week', o."createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD'),
       SUM(COALESCE((o.result->>'boosterCount')::int, 1))
  FROM "Operation" o
  JOIN "GuildMember" m ON m."playerId" = o."playerId"
 WHERE o.kind = 'summon' AND o."createdAt" >= m."joinedAt"
 GROUP BY 1, 2, 3
ON CONFLICT DO NOTHING;
