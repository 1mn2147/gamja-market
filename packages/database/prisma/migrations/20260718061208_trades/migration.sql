-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'DELIVERED', 'CONFIRMED', 'DISPUTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "priceKrw" BIGINT NOT NULL,
    "status" "TradeStatus" NOT NULL DEFAULT 'REQUESTED',
    "deliveredAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "disputedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Trade_buyerId_createdAt_idx" ON "Trade"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "Trade_sellerId_createdAt_idx" ON "Trade"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "Trade_productId_status_idx" ON "Trade"("productId", "status");

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
