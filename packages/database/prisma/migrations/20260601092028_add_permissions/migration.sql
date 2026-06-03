-- CreateTable
CREATE TABLE "ViewDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemaId" TEXT NOT NULL,
    "viewName" TEXT NOT NULL,
    "sql" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ViewDefinition_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "Schema" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomScript" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemaId" TEXT NOT NULL,
    "scriptName" TEXT NOT NULL,
    "sql" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomScript_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "Schema" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExportTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemaId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExportTemplate_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "Schema" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TablePermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canSelect" BOOLEAN NOT NULL DEFAULT true,
    "canInsert" BOOLEAN NOT NULL DEFAULT true,
    "canUpdate" BOOLEAN NOT NULL DEFAULT true,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TablePermission_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TablePermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ColumnPermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tablePermissionId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "canRead" BOOLEAN NOT NULL DEFAULT true,
    "canWrite" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ColumnPermission_tablePermissionId_fkey" FOREIGN KEY ("tablePermissionId") REFERENCES "TablePermission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ColumnPermission_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "ColumnDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ViewDefinition_schemaId_viewName_key" ON "ViewDefinition"("schemaId", "viewName");

-- CreateIndex
CREATE UNIQUE INDEX "CustomScript_schemaId_scriptName_key" ON "CustomScript"("schemaId", "scriptName");

-- CreateIndex
CREATE UNIQUE INDEX "ExportTemplate_schemaId_templateName_key" ON "ExportTemplate"("schemaId", "templateName");

-- CreateIndex
CREATE UNIQUE INDEX "TablePermission_tableId_userId_key" ON "TablePermission"("tableId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ColumnPermission_tablePermissionId_columnId_key" ON "ColumnPermission"("tablePermissionId", "columnId");
