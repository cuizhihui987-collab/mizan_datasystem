-- CreateTable: PipelineDefinition
CREATE TABLE "PipelineDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PipelineDefinition_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "Schema" ("id") ON DELETE CASCADE
);

-- CreateTable: PipelineStep
CREATE TABLE "PipelineStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PipelineStep_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "PipelineDefinition" ("id") ON DELETE CASCADE,
    CONSTRAINT "PipelineStep_sourceTableId_fkey" FOREIGN KEY ("sourceTableId") REFERENCES "TableDefinition" ("id") ON DELETE SET NULL
);

-- CreateIndex: @@unique([schemaId, name])
CREATE UNIQUE INDEX "PipelineDefinition_schemaId_name_key" ON "PipelineDefinition"("schemaId", "name");

-- CreateIndex: @@unique([pipelineId, stepOrder])
CREATE UNIQUE INDEX "PipelineStep_pipelineId_stepOrder_key" ON "PipelineStep"("pipelineId", "stepOrder");
