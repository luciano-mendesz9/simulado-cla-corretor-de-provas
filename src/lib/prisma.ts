import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export function getPrisma() {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada");
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  globalForPrisma.prisma = client;
  return client;
}
