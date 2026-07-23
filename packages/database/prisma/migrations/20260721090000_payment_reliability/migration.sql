ALTER TYPE "OutboxStatus" ADD VALUE IF NOT EXISTS 'DEAD_LETTER';

ALTER TYPE "SettlementStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "SettlementStatus" ADD VALUE IF NOT EXISTS 'SETTLED';
ALTER TYPE "SettlementStatus" ADD VALUE IF NOT EXISTS 'FAILED';

ALTER TABLE "OutboxEvent"
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "claimedAt" TIMESTAMP(3),
  ADD COLUMN "lastError" TEXT;

DROP INDEX IF EXISTS "OutboxEvent_status_occurredAt_idx";
CREATE INDEX "OutboxEvent_status_availableAt_occurredAt_idx"
  ON "OutboxEvent"("status", "availableAt", "occurredAt");

ALTER TABLE "Payment"
  ADD COLUMN "settlementAvailableAt" TIMESTAMP(3),
  ADD COLUMN "settledAt" TIMESTAMP(3),
  ADD COLUMN "reconciliationCheckedAt" TIMESTAMP(3),
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'TOSS',
  ADD COLUMN "failureCode" TEXT;
