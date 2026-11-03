import { testDatabaseUrl } from "./test-database.js";

// Runs in every worker before the test file is imported, so the lazy
// PrismaClient in src/prisma.ts connects to the isolated test schema.
process.env.DATABASE_URL = testDatabaseUrl();
