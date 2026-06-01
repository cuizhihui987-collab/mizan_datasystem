# Mizan 数据管理系统

一套基于 Next.js 技术栈的可视化数据管理平台，支持从电子表格导入、数据库表结构设计、DDL 执行到数据浏览与图表分析的全流程操作。

---

## 实现功能

### 1. 电子表格导入

- 支持 **.xlsx、.xls、.csv** 格式文件上传（最大 50MB）
- 拖拽或点击选择文件，上传即创建导入任务
- 异步后台导入，导入过程不阻塞程序正常使用
- 导入进度实时跟踪（PENDING → PROCESSING → COMPLETED/FAILED）
- 导入完成/失败时弹出 toast 通知
- 导入历史记录查询

### 2. 智能表头解析

- 上传后可指定表头所在行号（支持非首行表头）
- 自动检测各列数据类型（INTEGER、FLOAT、BOOLEAN、DATE、DATETIME、STRING）
- 预览解析结果：列名、类型、示例数据行
- **字段映射**：解析后可自定义字段名称、数据类型、主键、非空约束

### 3. 可视化 DDL 设计器

- **列编辑**：添加、删除、拖拽排序列；配置列名、物理名、数据类型、长度、默认值
- 支持 11 种数据类型：STRING、TEXT、INTEGER、FLOAT、BOOLEAN、DATE、DATETIME、DECIMAL、BINARY、JSON、UUID
- **主键**：支持单列/复合主键
- **非空约束**、**唯一约束**、**自增** 开关
- **CHECK 约束**：自定义校验表达式（如 `price > 0`）
- **外键管理**：选择源列、引用表、引用列，配置 ON DELETE / ON UPDATE 策略（NO ACTION、CASCADE、SET NULL、RESTRICT）
- **索引管理**：多列索引、唯一索引
- **触发器管理**：BEFORE/AFTER/INSTEAD OF 触发器，支持 INSERT/UPDATE/DELETE 事件
- **SQL 预览**：实时生成 CREATE TABLE DDL 语句，支持一键复制

### 4. DDL 执行

- 提交 DDL 至后台执行，自动在 SQLite 中创建物理表
- 自动添加系统字段（`_id` 自增主键、`_created_at`、`_updated_at`）
- 执行安全校验：禁止 DROP DATABASE、CREATE USER、GRANT 等危险操作
- 重新执行时自动删除旧表重建（幂等操作）
- 执行成功后表状态更新为"已创建"

### 5. 数据浏览

- 动态数据表格：自动读取物理表元数据生成列头
- 客户端分页、按列排序（升序/降序）
- 按列搜索过滤（LIKE 查询）
- **高级筛选**：可视化筛选器，支持 11 种操作符（等于、包含、大于、为空等），AND/OR 逻辑组合，活跃筛选标签展示
- **单行数据插入**：对话框表单，支持所有数据类型
- **双击单元格编辑**：内联输入框，Enter 保存，Esc 取消
- **行级删除**：每行删除按钮 + 确认对话框
- **批量选择**：复选框选择行 + 表头全选，选中后底部固定操作栏
- **批量删除**：选中多行后批量删除
- **批量更新**：选中多行后统一更新指定字段的值
- **批量导入**：按货号匹配的批量导入，支持 CSV、Excel、JSON（字段名和逻辑名双重匹配）
- **数据导出**：支持导出为 Excel (.xlsx) 和 CSV (.csv)，带 BOM 中文支持
- **后台导入**：导入在后台执行，不影响其他操作

### 6. 数据可视化

- 支持 **8 种图表类型**：柱状图、折线图、面积图、饼图、散点图、组合图（柱+线双轴）、雷达图、热力图（SVG 色阶）
- 散点图支持按分类字段着色分组
- 组合图支持左右独立 Y 轴
- 雷达图自动使用所有数值字段
- 热力图基于 SVG 渲染，带色阶图例
- 自动识别文本列（X 轴）和数值列（Y 轴）
- 数据量自适应：散点/热力图取 500 行，其他图表取 50 行

### 7. 视图管理

- **创建视图**：保存 SELECT 查询为视图
- **执行视图**：自动执行 `CREATE VIEW` 到 SQLite
- **预览 SQL**：实时测试查询结果
- **编辑/删除**：支持修改视图定义和删除（含 DROP VIEW）

### 8. 自定义脚本

- **创建脚本**：保存 SQL 脚本（INSERT/UPDATE/DELETE/SELECT）
- **执行脚本**：按需执行，自动识别查询/变更类型
- **结果查看**：显示影响行数和返回数据集（限 100 行）
- **安全校验**：自动拦截 DROP DATABASE、CREATE USER 等危险操作

### 9. Schema 管理

- 多 Schema（数据模型）支持，每个 Schema 包含多张数据表
- Schema 级操作：创建、编辑、删除（含级联删除关联数据）
- 仪表盘概览：Schema 数量、数据表数量、导入任务统计

### 10. 用户认证

- 邮箱/密码注册与登录
- 基于 NextAuth.js + JWT 的凭证认证
- 路由保护：未登录自动跳转登录页

---

## 技术架构

### 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 框架 | Next.js 15 (App Router) | 全栈 React 框架，服务端渲染 + API 路由 |
| 运行时 | Node.js 24 | Serverless/Node 运行时 |
| 数据库 ORM | Prisma 6 + SQLite | 元数据存储与数据库迁移 |
| 认证 | NextAuth.js v4 + JWT | Credentials 凭证认证 |
| UI 组件 | shadcn/ui (Radix UI + Tailwind CSS) | 可访问性优先的组件库 |
| 样式 | Tailwind CSS 3 | 原子化 CSS |
| 状态管理 | Zustand | DDL 设计器表单状态 + 后台导入任务状态 |
| 服务端状态 | TanStack React Query | API 数据请求与缓存 |
| 表单 | react-hook-form + Zod | 表单验证与类型安全 |
| 图表 | Recharts | 数据可视化 |
| 电子表格 | xlsx (SheetJS) | Excel/CSV/JSON 解析 |
| 拖拽 | @dnd-kit | 列排序 |
| 文件上传 | busboy | 流式 multipart/form-data 解析 |
| 通知 | sonner | Toast 通知 |

### 核心数据流

```
用户上传 Excel/CSV/JSON
       │
       ▼
  ┌─────────────┐      ┌─────────────────┐
  │  文件上传     │ ──→ │  ImportJob      │
  │  (Busboy)    │      │  (PENDING)      │
  └─────────────┘      └────────┬────────┘
                                │
                                ▼
  ┌─────────────┐      ┌─────────────────┐
  │  解析表头     │ ←── │  ImportJob      │
  │  (xlsx)      │      │  (PROCESSING)   │
  └──────┬──────┘      └─────────────────┘
         │
         ▼
  ┌─────────────┐
  │  字段映射     │ ← 可编辑字段名、类型、主键
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐      ┌─────────────────┐
  │  DDL 设计器   │      │  列/索引/FK/触发 │
  │  (Zustand)   │      │  实时 SQL 预览   │
  └──────┬──────┘      └────────┬────────┘
         │                      │
         ▼                      ▼
  ┌─────────────┐      ┌─────────────────┐
  │  执行 DDL    │ ──→ │  创建物理表      │
  │  (安全校验)   │      │  (SQLite)       │
  └──────┬──────┘      └─────────────────┘
         │
         ├─────────────┬──────────────┬──────────────┬──────────────┐
         ▼             ▼              ▼              ▼              ▼
  ┌─────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
  │  数据浏览     │ │ 高级筛选 │ │ 图表可视化 │ │ 批量导入  │ │ 视图/脚本    │
  │ (编辑/删除)  │ │ 11种操作 │ │ 8种图表   │ │ 按货号   │ │ 创建/执行    │
  └─────────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘
```

### 数据库架构

**元数据层**（Prisma 管理的 SQLite）：

- `User` — 系统用户
- `Schema` — 数据模型/命名空间
- `TableDefinition` — 数据表元数据（逻辑名、物理名、状态）
- `ColumnDefinition` — 列定义（类型、约束、默认值）
- `IndexDefinition` — 索引定义
- `ForeignKeyDefinition` — 外键约束
- `TriggerDefinition` — 触发器定义
- `ViewDefinition` — 视图定义（SQL 查询、状态）
- `CustomScript` — 自定义脚本（SQL 脚本、描述）
- `ImportJob` — 导入任务记录

**数据层**（运行时动态创建的物理表）：

- 表名格式：`mzan_tbl_xxxxxxxxxx`
- 自动包含系统字段：`_id`、`_created_at`、`_updated_at`
- 由 `DDLGenerator` 生成 CREATE TABLE 语句，通过 `$executeRawUnsafe` 执行

### 关键设计

- **物理表与元数据分离**：Prisma Schema 仅存储表结构元数据，实际数据表由用户设计并动态创建
- **文件上传兼容性**：使用 `busboy` 替代标准 `req.formData()`，避免 Node.js 24 下的 multipart 解析兼容问题
- **异步导入**：上传即返回，导入在后台批处理（每批 500 行），支持进度跟踪
- **DDL 幂等性**：重新执行 DDL 时先 DROP 旧表再 CREATE，表状态在元数据中维护
- **分块批量导入**：大数据量导入时分块（每块 500 行）发送，避免请求体超限
- **物理表缺失自愈**：物理表被误删时自动回退状态为草稿，引导用户重建
- **查询安全**：视图和脚本执行均有安全校验，拦截危险操作

---

## 开发环境配置

### 前置要求

- Node.js >= 18
- npm >= 9

### 安装与运行

```bash
# 1. 克隆项目
git clone <repo-url>
cd mizan_datasystem

# 2. 安装依赖
npm install

# 3. 配置环境变量
# 编辑 .env 文件（已提供默认值，可直接使用）
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"

# 4. 初始化数据库
npx prisma db push

# 5. 启动开发服务器
npm run dev
# 访问 http://localhost:3000
```

### 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | ESLint 代码检查 |
| `npm run db:generate` | 重新生成 Prisma Client |
| `npm run db:migrate` | 运行数据库迁移 |
| `npm run db:push` | 推送 Schema 变更到数据库 |
| `npm run db:studio` | 打开 Prisma Studio 管理界面 |

### 使用流程

1. **注册账号** → 访问 `/register` 创建账号
2. **登录系统** → 使用邮箱和密码登录
3. **创建 Schema** → 在首页或 Schema 列表页创建数据模型
4. **导入文件** → 进入 Schema 详情，点击"导入数据"，上传电子表格
5. **字段映射** → 解析后重命名字段、设置数据类型和主键
6. **设计表结构** → 进入 DDL 设计器，配置列、约束、外键、索引、触发器
7. **执行 DDL** → 提交并创建物理数据表
8. **浏览数据** → 查看表数据，支持分页、排序、搜索、筛选、编辑、删除
9. **批量导入** → 按货号匹配批量更新/新增数据，后台运行不影响操作
10. **数据导出** → 将表数据导出为 Excel 或 CSV
11. **视图/脚本** → 创建 SQL 视图简化查询，编写脚本执行批量操作
12. **可视化分析** → 切换至图表页面，配置柱状图/折线图/面积图/饼图/散点图/组合图/雷达图/热力图

---

## 近期更新记录

### Session 1 — Bug 修复与功能增强

#### 修复的 Bug

| # | 问题 | 原因 | 修复 |
|---|------|------|------|
| 1 | Tailwind CSS 编译失败 `require is not defined` | `tailwind.config.ts` 在 ESM 环境下使用 `require()` | 改为 `import tailwindcssAnimate from "tailwindcss-animate"` |
| 2 | DDL 执行报错 `near ",": syntax error` | `lines.join(",\n")` 在 `CREATE TABLE ... (` 和 `);` 间添加了多余的逗号 | 将表头 `CREATE TABLE ... (` 和结尾 `);` 移出 join 范围 |
| 3 | DDL 执行报错 `has more than one primary key` | `_id` 列定义含 `PRIMARY KEY`，又额外添加 `PRIMARY KEY ("_id")` 约束 | 移除冗余的 `PRIMARY KEY ("_id")` |
| 4 | "新增行"按钮无反应 | 按钮缺少 `onClick` 事件绑定 | 实现 `AddRowDialog` 组件，包含表单输入和数据提交 |
| 5 | 页面无样式（CSS 404） | 旧 Node 进程残留占用端口，新进程使用其他端口 | 进程清理 + 端口释放 |
| 6 | 批量导入 `Unexpected end of form` | FormData + busboy multipart 上传在 Next.js App Router 下流处理兼容问题 | 改为客户端解析文件 + 分块 JSON 请求（每块 500 行） |
| 7 | 批量导入大文件 `Unterminated string in JSON` | JSON 请求体超过 Next.js body 大小限制 | 分块发送 + 实时进度显示 |

#### 新增功能

| 功能 | 文件 | 说明 |
|------|------|------|
| **Combobox 组件** | `src/components/ui/combobox.tsx` | 可输入的下拉选择器，基于 Popover + Input，支持搜索过滤和自定义输入 |
| **Popover 组件** | `src/components/ui/popover.tsx` | 弹出卡片容器，Combobox 的基础组件 |
| **字段映射步骤** | `src/components/import-wizard/step-column-mapping.tsx` | 导入向导中新增"字段映射"步骤，可编辑字段名、类型、主键、非空约束 |
| **批量导入 API** | `src/app/api/tables/[tableId]/batch-import/route.ts` | 按货号匹配的批量导入接口，支持新增和更新操作 |
| **批量导入对话框** | `src/components/data/batch-import-dialog.tsx` | 上传文件 → 预览 → 选择匹配字段 → 后台导入 |
| **后台导入状态管理** | `src/stores/batch-import-store.ts` | Zustand 全局状态管理，跟踪所有后台导入任务的进度和结果 |
| **浮动进度指示器** | `src/components/data/batch-import-progress.tsx` | 固定在右下角的导入进度卡片，包含进度条和统计数据 |
| **全局进度组件** | `src/components/layout/global-progress.tsx` | 将进度指示器挂载到 Dashboard 布局 |

#### 功能改进

| 改进 | 文件 | 说明 |
|------|------|------|
| 导入向导支持字段映射 | `src/components/import-wizard/index.tsx` | 向导从 3 步变为 4 步：上传 → 解析 → 映射 → 完成 |
| 表创建 API 支持列定义 | `src/app/api/schemas/[schemaId]/tables/route.ts` | 创建表时一并创建列定义，接受 `columns` 和 `sourceFile` 参数 |
| 对话框自适应滚动 | `src/components/ui/dialog.tsx` | 基础 DialogContent 增加 `max-h-[85vh] overflow-y-auto` |
| 数据工具栏响应式 | `src/components/data/dynamic-data-table.tsx` | 小屏幕时搜索框和按钮自适应布局 |

### Session 2 — 数据编辑、筛选、导出、图表增强、视图/脚本

#### 新增功能

| 功能 | 核心文件 | 说明 |
|------|----------|------|
| **表数据编辑** | `dynamic-data-table.tsx` | 双击单元格内联编辑，Enter 保存/Esc 取消 |
| **行级删除** | `dynamic-data-table.tsx` | 每行删除按钮 + 确认对话框 |
| **批量选择与操作** | `dynamic-data-table.tsx` | 复选框选择行 + 全选，底部固定操作栏（批量删除/批量更新） |
| **高级数据筛选** | `filter-dialog.tsx` | 可视化筛选器：11 种操作符，AND/OR 逻辑，活跃筛选标签条 |
| **数据导出** | `export/route.ts` | 导出 Excel (.xlsx) 和 CSV (.csv)，含 BOM、自动列宽、逻辑名列头 |
| **导入进度通知** | `sonner.tsx` + `batch-import-progress.tsx` | sonner toast，完成/失败时弹出，含统计信息 |
| **高级图表** | `chart-container.tsx` | 散点图（颜色分组）、组合图（双轴）、雷达图、热力图（SVG 色阶） |
| **视图管理** | `view-editor.tsx` + views API | 保存 SELECT 为视图，执行 CREATE VIEW，支持预览/编辑/删除 |
| **自定义脚本** | `script-editor.tsx` + scripts API | 保存 SQL 脚本按需执行，自动识别查询/变更，显示结果集 |
| **物理表缺失自愈** | `data/route.ts` | 物理表被误删时自动回退状态为 DRAFT + 引导重建 |

#### 新增文件

| 文件 | 说明 |
|------|------|
| `src/components/ui/sonner.tsx` | Toast 通知组件 |
| `src/components/ui/alert-dialog.tsx` | 确认对话框组件 |
| `src/components/ui/textarea.tsx` | 多行文本输入组件 |
| `src/components/data/filter-dialog.tsx` | 数据筛选对话框 + 筛选标签条 |
| `src/components/schema/view-editor.tsx` | 视图编辑器（增/删/改/执行/预览） |
| `src/components/schema/script-editor.tsx` | 脚本编辑器（增/删/改/执行/结果） |
| `src/app/api/query/route.ts` | 通用查询 API（仅 SELECT） |
| `src/app/api/schemas/[id]/views/route.ts` | 视图列表/创建 API |
| `src/app/api/schemas/[id]/views/[vid]/route.ts` | 视图详情/更新/删除 API |
| `src/app/api/schemas/[id]/views/[vid]/execute/route.ts` | 视图执行 API（CREATE VIEW） |
| `src/app/api/schemas/[id]/scripts/route.ts` | 脚本列表/创建 API |
| `src/app/api/schemas/[id]/scripts/[sid]/route.ts` | 脚本详情/更新/删除 API |
| `src/app/api/schemas/[id]/scripts/[sid]/execute/route.ts` | 脚本执行 API |
| `src/app/api/tables/[id]/export/route.ts` | 数据导出 API |

#### 修复的 Bug

| 问题 | 原因 | 修复 |
|------|------|------|
| 批量导入字段不匹配 | 匹配时只查物理名不查逻辑名 | 同时匹配 `physicalName` 和 `logicalName` |
| 删除 Schema 外键约束失败 | Schema 表的关联缺少 `onDelete: Cascade` | 手动级联删除 FK/ImportJob/TableDefinition |
| 批量更新列名为空 | 纯中文列名被正则 `[^a-z0-9_]` 过滤为空 | CJK 字符保留 + 空列名校验 |

#### 新增依赖

- `sonner` — Toast 通知库

### Session 3 — DDL 执行优化、导出模板增强

#### 修复的 Bug

| 问题 | 原因 | 修复 |
|------|------|------|
| DDL 执行导致数据丢失 | 每次执行 DROP TABLE + CREATE TABLE，销毁所有数据 | 物理表存在时改用 `ALTER TABLE ADD COLUMN` 追加新字段，保留数据 |
| DDL 新增字段不显示 | API 只保存执行前从 DB 读取的旧字段元数据，新增字段未被持久化 | 将完整列定义从设计器发送到 API，全量替换元数据 |
| 按模板导出 `{col:仓库名称}` 未识别 | 变量解析只查物理名，用户输入的是逻辑名 | 同时匹配物理名和逻辑名 |
| 导出文件名未使用自定义模板 | `Content-Disposition` 使用非标准编码，浏览器降级为默认名 | 改为 RFC 5987 标准格式 `filename*=UTF-8''` |

#### 新增功能

| 功能 | 文件 | 说明 |
|------|------|------|
| **导出模板样式配置** | `export-template-editor.tsx` | 表头位置（顶部/左侧）、公司 Logo 上传（base64 存储）、工作表名自定义 |
| **导出文件名字段变量** | `export/route.ts` | `{col:字段名}` 变量从数据第一行取值，支持物理名和逻辑名 |
| **导出数据源选择** | `export-template-editor.tsx` | 导出向导可选任意数据表，不再限定当前表 |
| **导出数据筛选** | `export/route.ts` + `export-template-editor.tsx` | 导出前可按 11 种操作符过滤数据 |
| **exceljs 集成** | `export/route.ts` | 替代 xlsx 生成 Excel，支持样式（字体/填充/边框）、图片嵌入、自动筛选 |
| **DDL 智能执行** | `execute/route.ts` | 物理表存在时自动检测并 ALTER TABLE ADD COLUMN，保留数据 |

#### 修改文件

| 文件 | 改动 |
|------|------|
| `src/app/api/tables/[tableId]/execute/route.ts` | 重写：ALTER TABLE 替代 DROP+CREATE，全量替换列元数据 |
| `src/components/ddl-designer/index.tsx` | DDL 执行请求增加 columns/indexes/foreignKeys/triggers 完整定义 |
| `src/app/api/schemas/[schemaId]/templates/[templateId]/export/route.ts` | 改用 exceljs 生成 Excel，`{col:xxx}` 双名匹配，RFC 5987 文件名编码 |
| `src/components/schema/export-template-editor.tsx` | 新增样式配置、Logo 上传、数据源选择、筛选面板 |
| `src/app/api/tables/[tableId]/export/route.ts` | Content-Disposition 改为 RFC 5987 标准 |

---

## 后续优化计划

### 短期优化

- [ ] **注册验证码**：增加邮箱验证码或图形验证码
- [ ] **DDL 版本管理**：每次 DDL 执行保存版本历史，支持回滚
- [ ] **设定导出模版**: 按照数据模型数据源，自定义高自由的导出模板，导出路径和名称，可以添加图片，导出类型等，并且可以对模板进行修改和保存，之后选择数据愿支持按照模板导出

### 中期规划

- [ ] **多数据库支持**：除 SQLite 外支持 MySQL、PostgreSQL 作为数据源
- [ ] **数据表分区**：支持表分区定义（范围分区、列表分区等）
- [ ] **数据关联查询**：基于外键关系的跨表联查
- [ ] **权限管理**：表级、列级的细粒度访问控制
- [ ] **API 文档自动生成**：基于表结构自动生成 RESTful API

### 长期愿景

- [ ] **AI 辅助设计**：自然语言描述需求，AI 自动生成表结构和 DDL
- [ ] **数据同步**：支持与外部数据库/API 双向数据同步
- [ ] **数据质量监控**：设置数据质量规则，异常数据自动告警
- [ ] **协作编辑**：多人同时对同一个 Schema 进行设计
- [ ] **插件生态**：提供插件 API，支持社区扩展
- [ ] **部署模板**：提供 Docker Compose / 云原生一键部署方案

---

## 技术备注

### 已知注意事项

- 系统使用 SQLite 作为元数据存储和数据存储的数据库，适合单机/小团队使用
- 文件上传基于 `busboy` 流式解析，避免大文件内存溢出
- DDL 生成器当前仅支持 SQLite 方言，扩展其他数据库需修改 `ddl-generator.ts` 和 `type-mapper.ts`
- 动态数据查询使用 `DynamicQueryBuilder` 生成参数化 SQL，防止 SQL 注入
- 所有 API 路由均进行用户身份验证和 Schema/Table 归属权校验
- 批量导入采用分块策略（每块 500 行），避免单个请求体过大
- 后台导入状态存储在客户端 Zustand store 中，页面切换不丢失
- 物理表缺失时会自动检测并引导用户重新执行 DDL

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DATABASE_URL` | SQLite 数据库路径 | `file:./dev.db` |
| `NEXTAUTH_URL` | NextAuth 回调 URL | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | JWT 加密密钥 | 需自定义 |
| `UPLOAD_DIR` | 上传文件存储目录 | `./public/uploads` |
