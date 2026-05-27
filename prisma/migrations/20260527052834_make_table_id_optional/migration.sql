-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ImportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" TEXT,
    "schemaId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "headerRow" INTEGER NOT NULL DEFAULT 1,
    "totalRows" INTEGER,
    "processedRows" INTEGER,
    "errorRows" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorLog" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportJob_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ImportJob_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "Schema" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ImportJob" ("completedAt", "createdAt", "errorLog", "errorRows", "fileName", "filePath", "fileSize", "headerRow", "id", "processedRows", "schemaId", "startedAt", "status", "tableId", "totalRows", "updatedAt") SELECT "completedAt", "createdAt", "errorLog", "errorRows", "fileName", "filePath", "fileSize", "headerRow", "id", "processedRows", "schemaId", "startedAt", "status", "tableId", "totalRows", "updatedAt" FROM "ImportJob";
DROP TABLE "ImportJob";
ALTER TABLE "new_ImportJob" RENAME TO "ImportJob";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
