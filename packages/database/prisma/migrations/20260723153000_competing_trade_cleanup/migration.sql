-- A product can have only one selected buyer. Older data may contain pending
-- requests that remained open after another trade reserved or sold the item.
WITH conflicting_requests AS (
    SELECT pending."id"
    FROM "Trade" AS pending
    WHERE pending."status" = 'REQUESTED'
      AND EXISTS (
          SELECT 1
          FROM "Trade" AS selected
          WHERE selected."productId" = pending."productId"
            AND selected."id" <> pending."id"
            AND selected."status" IN ('ACCEPTED', 'DELIVERED', 'CONFIRMED', 'DISPUTED')
      )
),
rejected_requests AS (
    UPDATE "Trade" AS trade
    SET
        "status" = 'REJECTED',
        "rejectedAt" = CURRENT_TIMESTAMP,
        "reason" = 'PRODUCT_RESERVED_BY_ANOTHER_TRADE',
        "updatedAt" = CURRENT_TIMESTAMP
    FROM conflicting_requests
    WHERE trade."id" = conflicting_requests."id"
      AND trade."status" = 'REQUESTED'
    RETURNING trade."id"
)
INSERT INTO "TradeHistory" (
    "id",
    "tradeId",
    "fromStatus",
    "toStatus",
    "reason",
    "occurredAt"
)
SELECT
    'trade-cleanup-' || md5(rejected_requests."id"),
    rejected_requests."id",
    'REQUESTED',
    'REJECTED',
    'PRODUCT_RESERVED_BY_ANOTHER_TRADE',
    CURRENT_TIMESTAMP
FROM rejected_requests
ON CONFLICT ("id") DO NOTHING;
