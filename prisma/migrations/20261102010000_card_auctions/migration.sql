CREATE TABLE "CardAuction" (
 id TEXT PRIMARY KEY,
 "sellerId" TEXT NOT NULL REFERENCES "Player"(id),
 copy JSONB NOT NULL,
 "startPrice" DOUBLE PRECISION NOT NULL CHECK ("startPrice" >= 1 AND "startPrice" <= 9007199254740991 AND "startPrice" = floor("startPrice")),
 bid DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (bid >= 0 AND bid <= 9007199254740991 AND bid = floor(bid)),
 "bidderId" TEXT REFERENCES "Player"(id),
 status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','sold','unsold','cancelled')),
 "endsAt" TIMESTAMPTZ NOT NULL,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK (("bidderId" IS NULL AND bid=0) OR ("bidderId" IS NOT NULL AND bid >= "startPrice" AND "bidderId" <> "sellerId"))
);
CREATE INDEX "CardAuction_pending" ON "CardAuction"(status,"endsAt");
CREATE TABLE "AuctionRequest" (
 "playerId" TEXT NOT NULL REFERENCES "Player"(id),
 key TEXT NOT NULL,
 request JSONB NOT NULL,
 result JSONB NOT NULL,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY ("playerId",key)
);
