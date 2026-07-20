import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prisma/generated/client.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "postgresql://gamja:gamja@localhost:5432/gamja_market?schema=public" });
export {
  LedgerEntryType,
  PaymentAction,
  PaymentStatus,
  Prisma,
  ProductStatus,
  ReportTargetType,
  SettlementStatus,
  TradeStatus,
  UserRole,
  UserStatus,
  VerificationPurpose,
  WebhookProcessingStatus,
} from "../prisma/generated/client.js";

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
