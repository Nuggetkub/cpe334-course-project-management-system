import { PrismaClient } from "@prisma/client";

// One client per process, created on first use so importing the app (e.g. in a
// test) does not open a connection, and DATABASE_URL is read after test setup.
let client: PrismaClient | undefined;

export function prisma(): PrismaClient {
  client ??= new PrismaClient();
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}
