-- CreateTable
CREATE TABLE "ShopifyOrder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderedAt" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalShipping" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDiscounts" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "financialStatus" TEXT,
    "fulfillmentStatus" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "shipCountryCode" TEXT,
    "shipProvinceCode" TEXT,
    "shipCity" TEXT,
    "customerId" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopifyOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sku" TEXT,
    "title" TEXT NOT NULL,
    "variantTitle" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "productId" TEXT,
    "variantId" TEXT,

    CONSTRAINT "ShopifyOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopifyOrder_orderedAt_idx" ON "ShopifyOrder"("orderedAt");

-- CreateIndex
CREATE INDEX "ShopifyOrder_shipCountryCode_idx" ON "ShopifyOrder"("shipCountryCode");

-- CreateIndex
CREATE INDEX "ShopifyOrder_customerId_idx" ON "ShopifyOrder"("customerId");

-- CreateIndex
CREATE INDEX "ShopifyOrderLine_orderId_idx" ON "ShopifyOrderLine"("orderId");

-- CreateIndex
CREATE INDEX "ShopifyOrderLine_sku_idx" ON "ShopifyOrderLine"("sku");

-- AddForeignKey
ALTER TABLE "ShopifyOrderLine" ADD CONSTRAINT "ShopifyOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopifyOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

