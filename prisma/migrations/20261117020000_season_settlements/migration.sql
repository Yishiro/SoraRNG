-- Une ligne par saison mensuelle réglée : empêche tout double versement du top 3.
CREATE TABLE "SeasonSettlement" (
  id TEXT PRIMARY KEY,
  standings JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
