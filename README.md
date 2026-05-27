# Mizan 数据管理系统

一套基于 Next.js 技术栈的可视化数据管理平台，支持从电子表格导入、数据库表结构设计、DDL 执行到数据浏览与图表分析的全流程操作。

---

## 实现功能

### 1. 电子表格导入

- 支持 **.xlsx、.xls、.csv** 格式文件上传（最大 50MB）
- 拖拽或点击选择文件，上传即创建导入任务
- 异步后台导入，导入过程不阻塞程序正常使用
- 导入进度实时跟踪（PENDING → PROCESSING → COMPLETED/FAILED）
- 导入历史记录查询

### 2. 智能表头解析

- 上传后可指定表头所在行号（支持非首行表头）
- 自动检测各列数据类型（INTEGER、FLOAT、BOOLEAN、DATE、DATETIME、STRING）
- 预览解析结果：列名、类型、示例数据行
- 解析完成后可自定义表名

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
- 单行数据插入

### 6. 数据可视化

- 支持四种图表类型：**柱状图、折线图、面积图、饼图**
- 自动识别文本列（X 轴）和数值列（Y 轴）
- 基于 Recharts 渲染，交互式图例

### 7. Schema 管理

- 多 Schema（数据模型）支持，每个 Schema 包含多张数据表
- Schema 级操作：创建、编辑、删除
- 仪表盘概览：Schema 数量、数据表数量、导入任务统计

### 8. 用户认证

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
| 状态管理 | Zustand | DDL 设计器表单状态 |
| 服务端状态 | TanStack React Query | API 数据请求与缓存 |
| 表单 | react-hook-form + Zod | 表单验证与类型安全 |
| 图表 | Recharts | 数据可视化 |
| 电子表格 | xlsx (SheetJS) | Excel/CSV 解析 |
| 拖拽 | @dnd-kit | 列排序 |
| 文件上传 | busboy | 流式 multipart/form-data 解析 |

### 核心数据流

```
用户上传 Excel/CSV
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
  └─────────────┘      └────────┬────────┘
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
  └─────────────┘      └─────────────────┘
         │
         ├──────────────────────┐
         ▼                      ▼
  ┌─────────────┐      ┌─────────────────┐
  │  数据浏览     │      │  图表可视化      │
  │  (分页/排序)  │      │  (Recharts)     │
  └─────────────┘      └─────────────────┘
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
5. **设计表结构** → 解析后进入 DDL 设计器，配置列、约束、外键、索引、触发器
6. **执行 DDL** → 提交并创建物理数据表
7. **浏览数据** → 查看表数据，支持分页、排序、搜索
8. **可视化分析** → 切换至图表页面，配置柱状图/折线图/面积图/饼图

---

## 后续优化计划

### 短期优化

- [ ] **注册验证码**：增加邮箱验证码或图形验证码
- [ ] **导入进度通知**：导入完成时 toast 或站内信通知
- [ ] **表数据编辑**：支持双击单元格编辑、批量更新、删除行
- [ ] **数据导出**：支持将表数据导出为 Excel/CSV
- [ ] **DDL 版本管理**：每次 DDL 执行保存版本历史，支持回滚

### 中期规划

- [ ] **多数据库支持**：除 SQLite 外支持 MySQL、PostgreSQL 作为数据源
- [ ] **数据表分区**：支持表分区定义（范围分区、列表分区等）
- [ ] **视图/存储过程**：支持创建自定义视图和存储过程
- [ ] **数据关联查询**：基于外键关系的跨表联查
- [ ] **高级图表**：散点图、热力图、组合图等
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

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DATABASE_URL` | SQLite 数据库路径 | `file:./dev.db` |
| `NEXTAUTH_URL` | NextAuth 回调 URL | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | JWT 加密密钥 | 需自定义 |
| `UPLOAD_DIR` | 上传文件存储目录 | `./public/uploads` |
