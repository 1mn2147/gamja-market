CREATE TYPE "PaymentStatus" AS ENUM ('READY', 'APPROVED', 'UNCONFIRMED', 'FAILED', 'CANCEL_PENDING', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED');
CREATE TYPE "SettlementStatus" AS ENUM ('HOLD', 'PAUSED', 'READY', 'SANDBOX_SETTLED');
CREATE TYPE "PaymentAction" AS ENUM ('CREATE_ORDER', 'CONFIRM', 'CANCEL', 'REFUND');
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');
CREATE TYPE "LedgerEntryType" AS ENUM ('ESCROW_CAPTURE', 'CANCELLATION', 'REFUND', 'SETTLEMENT', 'ADJUSTMENT');

ALTER TABLE "LedgerEntry"
  ADD COLUMN "paymentId" TEXT,
  ADD COLUMN "tradeId" TEXT,
  ADD COLUMN "entryType" "LedgerEntryType" NOT NULL DEFAULT 'ADJUSTMENT';

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "tradeId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "paymentKey" TEXT,
  "amountKrw" BIGINT NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'READY',
  "settlementStatus" "SettlementStatus" NOT NULL DEFAULT 'HOLD',
  "methodMasked" TEXT,
  "lastWebhookSequence" INTEGER NOT NULL DEFAULT 0,
  "approvedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "refundedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentOperation" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "action" "PaymentAction" NOT NULL,
  "requestHash" TEXT NOT NULL,
  "responseStatus" INTEGER NOT NULL,
  "response" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentOperation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentWebhook" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT,
  "transmissionId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "eventStatus" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "rawBody" TEXT NOT NULL,
  "processingStatus" "WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
  "failureCode" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "PaymentWebhook_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_tradeId_key" ON "Payment"("tradeId");
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");
CREATE UNIQUE INDEX "Payment_paymentKey_key" ON "Payment"("paymentKey");
CREATE INDEX "Payment_status_updatedAt_idx" ON "Payment"("status", "updatedAt");
CREATE INDEX "Payment_settlementStatus_updatedAt_idx" ON "Payment"("settlementStatus", "updatedAt");
CREATE UNIQUE INDEX "PaymentOperation_idempotencyKey_key" ON "PaymentOperation"("idempotencyKey");
CREATE INDEX "PaymentOperation_paymentId_createdAt_idx" ON "PaymentOperation"("paymentId", "createdAt");
CREATE UNIQUE INDEX "PaymentWebhook_transmissionId_key" ON "PaymentWebhook"("transmissionId");
CREATE INDEX "PaymentWebhook_paymentId_sequence_idx" ON "PaymentWebhook"("paymentId", "sequence");
CREATE INDEX "PaymentWebhook_processingStatus_receivedAt_idx" ON "PaymentWebhook"("processingStatus", "receivedAt");
CREATE INDEX "LedgerEntry_tradeId_occurredAt_idx" ON "LedgerEntry"("tradeId", "occurredAt");
CREATE UNIQUE INDEX "LedgerEntry_paymentId_entryType_key" ON "LedgerEntry"("paymentId", "entryType");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentOperation" ADD CONSTRAINT "PaymentOperation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentWebhook" ADD CONSTRAINT "PaymentWebhook_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE FUNCTION prevent_ledger_entry_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'LedgerEntry is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "LedgerEntry_append_only_update"
  BEFORE UPDATE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_entry_mutation();

CREATE TRIGGER "LedgerEntry_append_only_delete"
  BEFORE DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_entry_mutation();
