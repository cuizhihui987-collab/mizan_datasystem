-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT DEFAULT '',
    "access_token" TEXT DEFAULT '',
    "expires_at" INTEGER,
    "token_type" TEXT DEFAULT '',
    "scope" TEXT DEFAULT '',
    "id_token" TEXT DEFAULT '',
    "session_state" TEXT DEFAULT '',
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "image" TEXT,
    "password" TEXT
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Schema" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Schema_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TableDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemaId" TEXT NOT NULL,
    "logicalName" TEXT NOT NULL,
    "physicalName" TEXT NOT NULL,
    "description" TEXT,
    "headerRowNumber" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sourceFile" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TableDefinition_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "Schema" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ColumnDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" TEXT NOT NULL,
    "logicalName" TEXT NOT NULL,
    "physicalName" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "dataTypeArgs" TEXT,
    "isNullable" BOOLEAN NOT NULL DEFAULT true,
    "isPrimaryKey" BOOLEAN NOT NULL DEFAULT false,
    "isUnique" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,
    "autoIncrement" BOOLEAN NOT NULL DEFAULT false,
    "ordinalPosition" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "checkExpression" TEXT,
    "foreignKeyId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ColumnDefinition_foreignKeyId_fkey" FOREIGN KEY ("foreignKeyId") REFERENCES "ForeignKeyDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ColumnDefinition_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IndexDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" TEXT NOT NULL,
    "indexName" TEXT NOT NULL,
    "columnIds" TEXT NOT NULL,
    "isUnique" BOOLEAN NOT NULL DEFAULT false,
    "indexMethod" TEXT NOT NULL DEFAULT 'BTREE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IndexDefinition_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ForeignKeyDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" TEXT NOT NULL,
    "constraintName" TEXT NOT NULL,
    "sourceColumnIds" TEXT NOT NULL,
    "referencedTableId" TEXT NOT NULL,
    "refColumnIds" TEXT NOT NULL,
    "onDelete" TEXT NOT NULL DEFAULT 'NO ACTION',
    "onUpdate" TEXT NOT NULL DEFAULT 'NO ACTION',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ForeignKeyDefinition_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ForeignKeyDefinition_referencedTableId_fkey" FOREIGN KEY ("referencedTableId") REFERENCES "TableDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TriggerDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" TEXT NOT NULL,
    "triggerName" TEXT NOT NULL,
    "timing" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "forEach" TEXT NOT NULL DEFAULT 'ROW',
    "logic" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TriggerDefinition_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" TEXT NOT NULL,
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
    CONSTRAINT "ImportJob_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ImportJob_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "Schema" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Schema_userId_name_key" ON "Schema"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TableDefinition_physicalName_key" ON "TableDefinition"("physicalName");

-- CreateIndex
CREATE UNIQUE INDEX "TableDefinition_schemaId_logicalName_key" ON "TableDefinition"("schemaId", "logicalName");

-- CreateIndex
CREATE UNIQUE INDEX "ColumnDefinition_tableId_physicalName_key" ON "ColumnDefinition"("tableId", "physicalName");
