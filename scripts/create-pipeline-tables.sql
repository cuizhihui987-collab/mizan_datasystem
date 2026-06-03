-- SQLite migration: Add PipelineDefinition and PipelineStep tables
-- Run with: sqlite3 prisma/dev.db < scripts/create-pipeline-tables.sql

CREATE TABLE IF NOT EXISTS "PipelineDefinition" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  "schemaId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("schemaId") REFERENCES "Schema"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PipelineDefinition_schemaId_name_key" ON "PipelineDefinition"("schemaId", "name");

CREATE TABLE IF NOT EXISTS "PipelineStep" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  "pipelineId" TEXT NOT NULL,
  "stepOrder" INTEGER NOT NULL DEFAULT 0,
  "stepType" TEXT NOT NULL,
  "label" TEXT,
  "config" TEXT NOT NULL DEFAULT '{}',
  "sourceTableId" TEXT,
  "outputPhysicalName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "errorLog" TEXT,
  "startedAt" DATETIME,
  "completedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("pipelineId") REFERENCES "PipelineDefinition"("id") ON DELETE CASCADE,
  FOREIGN KEY ("sourceTableId") REFERENCES "TableDefinition"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PipelineStep_pipelineId_stepOrder_key" ON "PipelineStep"("pipelineId", "stepOrder");
