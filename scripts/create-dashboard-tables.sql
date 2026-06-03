-- SQLite migration: Add Dashboard and DashboardWidget tables
-- Run with: sqlite3 prisma/dev.db < scripts/create-dashboard-tables.sql

CREATE TABLE IF NOT EXISTS "Dashboard" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  "schemaId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("schemaId") REFERENCES "Schema"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "DashboardWidget" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  "dashboardId" TEXT NOT NULL,
  "title" TEXT,
  "tableId" TEXT,
  "chartType" TEXT NOT NULL DEFAULT 'bar',
  "config" TEXT NOT NULL DEFAULT '{}',
  "positionX" INTEGER NOT NULL DEFAULT 0,
  "positionY" INTEGER NOT NULL DEFAULT 1,
  "width" INTEGER NOT NULL DEFAULT 6,
  "height" INTEGER NOT NULL DEFAULT 4,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE CASCADE,
  FOREIGN KEY ("tableId") REFERENCES "TableDefinition"("id")
);
