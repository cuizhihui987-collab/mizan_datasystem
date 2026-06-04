import { PrismaClient } from "@prisma/client";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";

interface TestPrismaClientResult {
  prisma: PrismaClient;
  dbPath: string;
  cleanup: () => Promise<void>;
}

export async function createTestPrismaClient(
  schemaDir?: string
): Promise<TestPrismaClientResult> {
  const dbDir = path.join(process.cwd(), ".test-db");
  fs.mkdirSync(dbDir, { recursive: true });

  const dbName = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.db`;
  const dbPath = path.join(dbDir, dbName);

  const testDbUrl = `file:${dbPath}`;

  const prismaSchemaDir =
    schemaDir ||
    path.resolve(process.cwd(), "..", "..", "packages", "database");

  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: testDbUrl },
    cwd: prismaSchemaDir,
    stdio: "pipe",
  });

  const prisma = new PrismaClient({
    datasources: { db: { url: testDbUrl } },
  });

  await prisma.$connect();

  return {
    prisma,
    dbPath,
    cleanup: async () => {
      await prisma.$disconnect();
      try {
        fs.unlinkSync(dbPath);
        const journalPath = dbPath + "-journal";
        if (fs.existsSync(journalPath)) {
          fs.unlinkSync(journalPath);
        }
      } catch {
        // ignore cleanup errors
      }
    },
  };
}
