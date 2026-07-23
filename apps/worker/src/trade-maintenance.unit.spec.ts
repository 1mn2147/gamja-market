import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findDue: vi.fn(),
  queryRaw: vi.fn(),
  findLocked: vi.fn(),
  updateTrade: vi.fn(),
  updateProduct: vi.fn(),
  createHistory: vi.fn(),
}));

const transactionClient = {
  $queryRaw: mocks.queryRaw,
  trade: {
    findFirst: mocks.findLocked,
    update: mocks.updateTrade,
  },
  product: { updateMany: mocks.updateProduct },
  tradeHistory: { create: mocks.createHistory },
};

vi.mock('@gamja/database', () => ({
  ProductStatus: { ACTIVE: 'ACTIVE', RESERVED: 'RESERVED', SOLD: 'SOLD' },
  TradeStatus: {
    ACCEPTED: 'ACCEPTED',
    CANCELLED: 'CANCELLED',
    CONFIRMED: 'CONFIRMED',
    DELIVERED: 'DELIVERED',
  },
  prisma: {
    trade: { findMany: mocks.findDue },
    $transaction: vi.fn(async (operation: (tx: typeof transactionClient) => unknown) => operation(transactionClient)),
  },
}));

import { cancelExpiredUnpaidTrades } from './trade-maintenance.js';

describe('unpaid accepted trade maintenance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cancels an accepted trade without a payment after seven days and releases the product', async () => {
    const now = new Date('2026-07-23T15:00:00.000Z');
    mocks.findDue.mockResolvedValue([{ id: 'trade-expired' }]);
    mocks.findLocked.mockResolvedValue({ id: 'trade-expired', productId: 'product-reserved' });
    mocks.updateTrade.mockResolvedValue({});
    mocks.updateProduct.mockResolvedValue({ count: 1 });
    mocks.createHistory.mockResolvedValue({});

    await expect(cancelExpiredUnpaidTrades(now)).resolves.toEqual({ cancelled: 1 });
    expect(mocks.updateTrade).toHaveBeenCalledWith({
      where: { id: 'trade-expired' },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        reason: 'AUTO_CANCELLED_UNPAID_AFTER_7_DAYS',
      },
    });
    expect(mocks.updateProduct).toHaveBeenCalledWith({
      where: { id: 'product-reserved', status: 'RESERVED' },
      data: { status: 'ACTIVE' },
    });
    expect(mocks.createHistory).toHaveBeenCalledWith({
      data: {
        tradeId: 'trade-expired',
        fromStatus: 'ACCEPTED',
        toStatus: 'CANCELLED',
        reason: 'AUTO_CANCELLED_UNPAID_AFTER_7_DAYS',
      },
    });
  });

  it('does nothing when the locked trade gained a payment before expiry processing', async () => {
    mocks.findDue.mockResolvedValue([{ id: 'trade-raced' }]);
    mocks.findLocked.mockResolvedValue(null);

    await expect(cancelExpiredUnpaidTrades(new Date())).resolves.toEqual({ cancelled: 0 });
    expect(mocks.updateTrade).not.toHaveBeenCalled();
    expect(mocks.updateProduct).not.toHaveBeenCalled();
    expect(mocks.createHistory).not.toHaveBeenCalled();
  });
});
