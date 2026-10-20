import { PrismaClient } from "@prisma/client";

// Reuse one client across hot reloads in development; otherwise every reload
// opens a new connection to the SQLite file.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
