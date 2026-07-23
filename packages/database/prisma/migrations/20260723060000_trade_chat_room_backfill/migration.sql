-- Existing trade requests predate the invariant that every trade has a
-- buyer/seller product chat. Backfill one room per unique relationship.
INSERT INTO "ChatRoom" (
    "id",
    "productId",
    "buyerId",
    "sellerId",
    "createdAt",
    "updatedAt"
)
SELECT DISTINCT ON (trade."productId", trade."buyerId", trade."sellerId")
    'trade-chat-' || md5(trade."id"),
    trade."productId",
    trade."buyerId",
    trade."sellerId",
    trade."createdAt",
    CURRENT_TIMESTAMP
FROM "Trade" AS trade
ORDER BY trade."productId", trade."buyerId", trade."sellerId", trade."createdAt"
ON CONFLICT ("productId", "buyerId", "sellerId") DO NOTHING;

INSERT INTO "ChatParticipant" ("chatRoomId", "userId", "joinedAt")
SELECT room."id", room."buyerId", room."createdAt"
FROM "ChatRoom" AS room
ON CONFLICT ("chatRoomId", "userId") DO NOTHING;

INSERT INTO "ChatParticipant" ("chatRoomId", "userId", "joinedAt")
SELECT room."id", room."sellerId", room."createdAt"
FROM "ChatRoom" AS room
ON CONFLICT ("chatRoomId", "userId") DO NOTHING;
