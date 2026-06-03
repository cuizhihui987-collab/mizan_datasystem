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
- **Spreadsheet**: Handsontable (inline editing), xlsx / exceljs (parsing)
- **Validation**: Zod (form/API validation), react-hook-form
- **DnD**: @dnd-kit (column reordering), @xyflow/react (ETL pipeline canvas)
- **Monorepo**: pnpm workspaces + Turborepo

## Commands

```bash
pnpm dev             # Start dev server (http://localhost:3000)
pnpm build           # Production build (via Turbo)
pnpm start           # Start production server
pnpm lint            # ESLint check (via Turbo)
pnpm db:generate     # Regenerate Prisma client (in packages/database)
pnpm db:migrate      # Run Prisma migrations (in packages/database)
pnpm db:push         # Push schema changes to DB (in packages/database)
pnpm db:studio       # Open Prisma Studio GUI
```

Prisma commands run inside `packages/database/` — scripts automatically `cd` there. The root `.env` is for dev convenience; additional config may be in `packages/database/.env`.

## Project Architecture

### Monorepo Structure (pnpm workspace + Turbo)

```
apps/                   # Sub-applications (separate Next.js apps)
├── admin/              # Admin panel
├── core/               # Core application
├── data/               # Data browser
└── pipelines/          # ETL pipelines
packages/               # Shared workspace packages
├── database/           # Prisma schema + client (@mizan/database)
├── shared-lib/         # Utilities, auth helpers (@mizan/shared-lib)
└── shared-ui/          # Reusable shadcn UI components (@mizan/shared-ui)
src/                    # Main Next.js application (App Router)
```

### Data Flow

1. **Upload** → User uploads .xlsx/.xls/.csv → saved to storage (local or S3) → `StoredFile` + `ImportJob` records created
2. **Parse** → Server reads file via `xlsx`/`exceljs`, detects column names/types from header row
3. **Design** → User defines columns, PKs, FKs, indexes, triggers in DDL Designer (UI state in Zustand store)
4. **Execute** → `DDLGenerator` produces SQLite CREATE TABLE DDL → executed via `$executeRawUnsafe` → `TableDefinition` status becomes `CREATED`
5. **CRUD** → `DynamicQueryBuilder` generates parameterized SELECT/INSERT queries for runtime data access; Handsontable for inline editing
6. **Visualize** → Recharts renders configurable bar/line/area/pie/scatter/combo/radar/heatmap charts
7. **ETL** → Visual pipeline editor (React Flow) builds DAG workflows with 7 step types, executed via topological sort

### src/ Directory Structure

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
├── middleware.ts             # NextAuth route protection
└── types/
    └── next-auth.d.ts        # Session type augmentation
```

### Prisma Schema (Key Models — defined in packages/database/prisma/)

- **User** / **Account** / **Session** / **VerificationToken** — NextAuth models; User has role field (USER|ADMIN)
- **Schema** — logical namespace/container for tables (user-scoped, `@@unique([userId, name])`)
- **TableDefinition** — metadata: logical name, physical DB name (`mzan_tbl_<cuid>`), status (DRAFT → CREATED → IMPORTED/MODIFIED), optional color labeling
- **ColumnDefinition** — column metadata: 7 base types (STRING, INTEGER, FLOAT, BOOLEAN, DATE, DATETIME, TEXT) + dataTypeArgs for ENUM/length, PK/nullable/unique/autoIncrement, FK refs, defaults, CHECK expressions
- **IndexDefinition** — indexes with JSON array of columnIds, unique flag
- **ForeignKeyDefinition** — FK constraints with JSON source/ref column IDs, ON DELETE/UPDATE actions
- **TriggerDefinition** — SQL triggers with timing (BEFORE/AFTER/INSTEAD OF), event (INSERT/UPDATE/DELETE)
- **ViewDefinition** — saved SQL views (DRAFT → CREATED status)
- **CustomScript** — saved SQL scripts for ad-hoc execution
- **ExportTemplate** — saved export configs (format, columns, filters, sort)
- **ImportJob** — tracks file import lifecycle: PENDING → QUEUED → PROCESSING → COMPLETED/FAILED/CANCELLED; 500-row batch processing
- **TablePermission** / **ColumnPermission** — table-level (SELECT/INSERT/UPDATE/DELETE) and column-level (READ/WRITE) access control
- **Role** / **UserRole** / **Permission** / **RolePermission** — RBAC system with named roles, system-level permission codes grouped by category
- **PipelineDefinition** / **PipelineStep** — ETL workflows (DAG via React Flow), steps produce intermediate tables (`mzan_pipe_<cuid>`)
- **Dashboard** / **DashboardWidget** — dashboards with configurable chart widgets (recharts); widget config includes xAxis, yAxis, aggregation, grid position
- **SyncConnection** / **SyncJob** — data sync with external APIs (pull/push/bidirectional), field mapping, scheduling
- **StoredFile** — file storage tracking (local or S3), with folder, tags, sharing
- **Notification** — user notifications for file/table sharing events

### Auth

- NextAuth.js v4 with Credentials provider + JWT strategy
- Middleware protects all routes except `/api/auth`, `/login`, `/register`
- PrismaAdapter for user persistence
- bcryptjs for password hashing
- Session user ID is embedded via JWT callback and accessible as `session.user.id`

### Workspace Packages

| Package | Path | Exports | Purpose |
|---------|------|---------|---------|
| `@mizan/database` | `packages/database/` | PrismaClient singleton | DB client init |
| `@mizan/shared-lib` | `packages/shared-lib/` | `utils/cn`, `auth/permissions` | Utilities, permission helpers |
| `@mizan/shared-ui` | `packages/shared-ui/` | 16 shadcn components (button, dialog, input, select, etc.) | Reusable UI primitives |

### Key Design Decisions

- **File uploads** use `busboy` (not `req.formData()`) for multipart parsing due to Node.js v24 compatibility
- **Physical tables** are created dynamically via raw SQL (`$executeRawUnsafe`), not managed by Prisma migrations — the Prisma schema only stores metadata
- **Physical table naming**: `mzan_tbl_` + cuid (10-char); pipeline intermediate tables: `mzan_pipe_` + cuid
- **System columns**: `_id` (autoIncrement PK), `_created_at`, `_updated_at` added to every physical table
- **DDL execution** is idempotent: ALTER TABLE ADD COLUMN if table exists, CREATE TABLE if not
- **Import process** is async: file saved immediately, then `/api/imports/[importId]/process` triggers batch processing (500 rows/batch) with concurrent job control
- **SQLite** used as the runtime database for dynamically created tables (same as the metadata DB)
- **Storage**: supports both local filesystem and S3-compatible object storage (configured via `STORAGE_TYPE`)
