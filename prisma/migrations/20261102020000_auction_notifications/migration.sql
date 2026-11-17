CREATE TABLE "AuctionNotification" (
 id TEXT PRIMARY KEY,
 "playerId" TEXT NOT NULL REFERENCES "Player"(id),
 "auctionId" TEXT NOT NULL REFERENCES "CardAuction"(id),
 kind TEXT NOT NULL CHECK (kind IN ('outbid','won','sold','unsold')),
 payload JSONB NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','blocked','ignored','failed')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts>=0),
 "nextAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
 "deliveredAt" TIMESTAMPTZ,
 "messageId" TEXT
);
CREATE INDEX "AuctionNotification_pending" ON "AuctionNotification"(status,"nextAt");
CREATE INDEX "CardAuction_sales" ON "CardAuction"((copy->>'cardId'),"endsAt" DESC) WHERE status='sold';
