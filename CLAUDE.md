# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mizan 数据管理系统 — a Next.js application for importing Excel/CSV spreadsheets, designing database schemas via a visual DDL designer, and managing data through CRUD interfaces with charting. Users upload spreadsheets, define table structures, execute DDL to create physical tables in SQLite, then browse/visualize the data.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database ORM**: Prisma 6 + SQLite
- **Auth**: NextAuth.js v4 (Credentials provider, JWT strategy)
- **UI**: shadcn/ui (Radix primitives + Tailwind CSS)
- **State**: Zustand (DDL Designer), TanStack React Query (server state)
- **Charts**: Recharts
- **Spreadsheet**: xlsx (SheetJS)
- **Validation**: Zod (form/API validation), react-hook-form
- **DnD**: @dnd-kit (column reordering)

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint check
npm run db:generate  # Regenerate Prisma client
npm run db:migrate   # Run Prisma migrations
npm run db:push      # Push schema changes to DB (dev)
npm run db:studio    # Open Prisma Studio GUI
```

## Project Architecture

### Data Flow

1. **Upload** → User uploads .xlsx/.xls/.csv → saved to `public/uploads/` → `ImportJob` record created
2. **Parse** → Server reads file via `xlsx` library, detects column names/types from header row
3. **Design** → User defines columns, PKs, FKs, indexes, triggers in DDL Designer (UI state in Zustand store)
4. **Execute** → `DDLGenerator` produces SQLite CREATE TABLE DDL → executed against the SQLite DB → `TableDefinition` status becomes "CREATED"
5. **CRUD** → `DynamicQueryBuilder` generates parameterized SELECT/INSERT queries for runtime data access
6. **Visualize** → Recharts renders configurable bar/line/area/pie charts from queried data

### Directory Structure

```
src/
├── app/
│   ├── (dashboard)/           # Protected routes (require auth)
│   │   ├── page.tsx           # Home with stats
│   │   ├── imports/           # Import job history
│   │   ├── schemas/           # Schema list, detail, import wizard
│   │   │   └── [schemaId]/
│   │   │       ├── import/    # 3-step import wizard
│   │   │       └── tables/
│   │   │           ├── new/   # Create table
│   │   │           └── [tableId]/
│   │   │               ├── page.tsx          # Table overview
│   │   │               ├── ddl-designer/     # Visual schema designer
│   │   │               ├── data/             # Data browser
│   │   │               └── visualize/        # Charts
│   │   └── settings/
│   ├── api/
│   │   ├── auth/             # NextAuth + register
│   │   ├── upload/           # File upload (busboy multipart)
│   │   ├── imports/          # Import job CRUD, parse, process
│   │   ├── schemas/          # Schema CRUD
│   │   └── tables/           # Table CRUD, data queries, DDL execution
│   ├── login/
│   └── register/
├── components/
│   ├── ui/                   # shadcn primitives (button, card, dialog, etc.)
│   ├── layout/               # Sidebar + Header
│   ├── import-wizard/        # Upload → Parse → Done flow
│   ├── ddl-designer/         # Column/FK/Index/Trigger editors + SQL preview
│   ├── data/                 # Dynamic data table (paginated, sortable)
│   └── charts/               # Recharts bar/line/area/pie wrapper
├── lib/
│   ├── auth/auth-options.ts  # NextAuth config
│   ├── db/prisma.ts          # PrismaClient singleton
│   ├── ddl/ddl-generator.ts  # Creates SQLite DDL from designer state
│   ├── ddl/type-mapper.ts    # Maps generic types to SQLite types
│   ├── import/spreadsheet-parser.ts  # xlsx parsing with type detection
│   ├── import/data-importer.ts       # Batch async import pipeline
│   └── query/dynamic-query-builder.ts # Dynamic SQL query generation
├── stores/
│   └── ddl-designer-store.ts # Zustand store for DDL Designer form state
├── hooks/
│   ├── use-import-status.ts  # Poll import job progress
│   └── use-table-data.ts     # Paginated table data with sorting/search
└── types/
    └── next-auth.d.ts        # Session type augmentation
```

### Prisma Schema (Key Models)

- **User** — auth users, linked to schemas
- **Schema** — logical namespace/container for tables (user-scoped)
- **TableDefinition** — metadata table tracking logical name, physical DB name, status (DRAFT → CREATED → IMPORTED/MODIFIED)
- **ColumnDefinition** — column metadata: data type, PK/nullable/unique, FK refs, defaults, CHECK expressions
- **IndexDefinition** — indexes with column selection
- **ForeignKeyDefinition** — FK constraints with source/target columns, ON DELETE/UPDATE actions
- **TriggerDefinition** — SQL triggers with timing (BEFORE/AFTER), event (INSERT/UPDATE/DELETE)
- **ImportJob** — tracks file import lifecycle: PENDING → PROCESSING → COMPLETED/FAILED

### Auth

- NextAuth.js v4 with Credentials provider + JWT strategy
- Middleware protects all routes except `/api/auth`, `/login`, `/register`
- PrismaAdapter for user persistence
- bcryptjs for password hashing
- Session user ID is embedded via JWT callback and accessible as `session.user.id`

### Key Design Decisions

- **File uploads** use `busboy` (not `req.formData()`) for multipart parsing due to Node.js v24 compatibility
- **Physical tables** are created dynamically via raw SQL (executed through Prisma's `$executeRawUnsafe`), not managed by Prisma migrations — the Prisma schema only stores metadata
- **Physical table naming**: `mzan_tbl_` + 10 random alphanumeric chars
- **Import process** is async: file is saved immediately, then `/api/imports/[importId]/process` triggers batch processing in the background
- **DDL execution** is idempotent: drops the existing physical table if re-executing before creating
- **SQLite** is used as the runtime database for dynamically created tables (same as the metadata DB)
