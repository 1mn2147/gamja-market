ALTER TYPE "TradeStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TABLE "Trade"
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "autoConfirmAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "reason" TEXT;

ALTER TABLE "Trade"
  ADD CONSTRAINT "Trade_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Trade_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Trade_status_autoConfirmAt_idx" ON "Trade"("status", "autoConfirmAt");

CREATE TABLE "TradeHistory" (
  "id" TEXT NOT NULL,
  "tradeId" TEXT NOT NULL,
  "actorId" TEXT,
  "fromStatus" "TradeStatus",
  "toStatus" "TradeStatus" NOT NULL,
  "reason" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TradeHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TradeHistory_tradeId_occurredAt_idx" ON "TradeHistory"("tradeId", "occurredAt");

ALTER TABLE "TradeHistory"
  ADD CONSTRAINT "TradeHistory_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
