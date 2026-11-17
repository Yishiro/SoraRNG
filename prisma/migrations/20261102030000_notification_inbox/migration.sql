ALTER TABLE "AuctionNotification" ADD COLUMN "readAt" TIMESTAMPTZ;
CREATE INDEX "AuctionNotification_player_time" ON "AuctionNotification"("playerId","createdAt" DESC);
