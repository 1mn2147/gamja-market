-- Older application versions could cancel an accepted trade without closing
-- its unapproved local payment order. No provider reversal or ledger movement
-- is required because these states never captured money.
UPDATE "Payment" AS payment
SET
    "status" = 'CANCELLED',
    "settlementStatus" = 'PAUSED',
    "cancelledAt" = COALESCE(trade."cancelledAt", CURRENT_TIMESTAMP),
    "updatedAt" = CURRENT_TIMESTAMP
FROM "Trade" AS trade
WHERE trade."id" = payment."tradeId"
  AND trade."status" = 'CANCELLED'
  AND payment."status" IN ('READY', 'UNCONFIRMED', 'FAILED');
