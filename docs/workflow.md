# 整体运作流程

## 系统流程总览

```
用户注册/登录
    │
    ▼
创建 Schema (数据模型)
    │
    ├──→ 方式一：手动建表
    │        │
    │        ├──→ DDL 设计器 (可视化配置列/约束/外键/索引/触发器)
    │        │       │
    │        │       └──→ 执行 DDL → SQLite 物理表 (CREATED)
    │        │
    │        └──→ 数据浏览/编辑/导入/导出
    │
    ├──→ 方式二：导入 Excel 建表
    │        │
    │        ├──→ 上传文件 (.xlsx/.xls/.csv)
    │        ├──→ 解析表头 → 预览数据
    │        ├──→ 字段映射 (列名/类型/主键)
    │        └──→ 创建表 → 执行 DDL → 异步导入数据 (IMPORTED)
    │
    ├──→ 方式三：数据收集工具
    │        │
    │        ├──→ 从文件管理选择已有文件
    │        ├──→ 在线预览 (Handsontable: 编辑/公式/合并/图片)
    │        ├──→ 选择导入列
    │        ├──→ DDL 分析 → 自动建表
    │        └──→ 写入数据
    │
    ├──→ ETL 工作流
    │        │
    │        ├──→ 可视化画布编辑 (React Flow)
    │        ├──→ 配置步骤: 数据源 → 转换 → 输出
    │        ├──→ DAG 拓扑排序执行
    │        └──→ 中间表管道
    │
    ├──→ 图表可视化
    │        │
    │        └──→ 选择表和列 → 配置图表 → 8 种图表类型
    │
    └──→ 看板
             │
             └──→ 组合多个图表 → 可拖拽布局
```

---

## 1. 用户认证

### 注册
```
访问 /register
  → 输入 邮箱 + 姓名 + 密码
  → POST /api/auth/register
  → bcrypt 加密密码 → 写入 User 表
  → 返回 201 → 跳转登录
```

### 登录
```
访问 /login
  → 输入 邮箱 + 密码
  → POST /api/auth/callback/credentials
  → Prisma 查询用户 → bcrypt 校验
  → JWT 签发 → Set-Cookie: next-auth.session-token
  → 302 跳转 /
```

### 鉴权
```
中间件 middleware.ts
  → 检查所有 /api/* / (dashboard) 路由
  → 无有效 Session → 302 /login
  → 有 Session → 正常放行
```

---

## 2. Schema 管理

### 创建 Schema
```
用户点击"新建数据模型"
  → 输入名称 + 描述
  → POST /api/schemas
  → 创建 Schema 记录 (status: ACTIVE)
  → 列表页可见
```

### Schema 详情
```
访问 /schemas/:schemaId
  → Tabs: 数据表 / 视图 / 脚本 / 导出模板 / API 文档 / ETL / 看板
  → 数据收集标签 → /schemas/:id/data-collection
```

---

## 3. 建表方式

### 方式一：手动建表 (DDL Designer)

```
1. 访问 /schemas/:schemaId/tables/new
   → 输入表名 → 创建 TableDefinition (DRAFT)
   → 跳转 DDL 设计器

2. DDL 设计器 (/schemas/:id/tables/:tableId/ddl-designer)
   │
   ├── 列管理
   │   ├── 添加列: 列名 + 类型 + 长度 + 默认值
   │   ├── 约束: 主键 / 非空 / 唯一 / 自增 / CHECK
   │   ├── 拖拽排序
   │   └── 删除
   │
   ├── 外键管理
   │   ├── 选择源列 → 引用表 → 引用列
   │   └── ON DELETE / ON UPDATE: NO ACTION / CASCADE / SET NULL / RESTRICT
   │
   ├── 索引管理
   │   ├── 多列索引 / 唯一索引
   │   └── 选择列
   │
   ├── 触发器管理
   │   ├── 时机: BEFORE / AFTER / INSTEAD OF
   │   ├── 事件: INSERT / UPDATE / DELETE
   │   └── SQL 逻辑
   │
   ├── SQL 预览 (实时生成 CREATE TABLE DDL)
   │
   └── 执行 DDL
       → POST /api/tables/:tableId/execute
       → 安全校验 (禁止 DROP DATABASE 等)
       → 物理表已存在 → ALTER TABLE ADD COLUMN
       → 物理表不存在 → CREATE TABLE
       → 状态更新为 CREATED
       → 自动添加系统字段: _id, _created_at, _updated_at
```

### 方式二：导入 Excel 建表 (导入向导)

```
1. 访问 /schemas/:schemaId/import

2. Step 1: 上传文件
   → 拖拽或选择 .xlsx/.xls/.csv (最大 50MB)
   → Busboy 流式解析 → 保存到 public/uploads/
   → 创建 ImportJob (PENDING)
   → 返回 importId

3. Step 2: 解析数据
   → POST /api/imports/:importId/parse
   → xlsx 读取文件 → 提取表头行
   → 类型检测 (INTEGER/FLOAT/BOOLEAN/DATE/DATETIME/STRING)
   → 预览: 列名 + 类型徽章 + 5 行样本
   → 可调整表头行号并重新解析

4. Step 3: 字段映射
   → 编辑列名 / 数据类型 / 主键 / 非空
   → 拖拽排序 / 添加 / 删除列
   → 输入目标表名

5. Step 4: 完成
   → POST /api/schemas/:schemaId/tables (包含列定义)
   → 创建 TableDefinition + ColumnDefinition (DRAFT)
   → 跳转 DDL 设计器 → 执行 DDL 创建物理表
   → 跳转数据浏览页

6. 异步导入数据
   → POST /api/imports/:importId/process
   → QueueProcessor 排队 (并发上限 2)
   → DataImporter 以 500 行/批写入
   → 完成后状态: IMPORTED
```

### 方式三：数据收集工具

```
1. 访问 /schemas/:schemaId/data-collection

2. Step 1: 选择文件
   → 从文件管理浏览已上传的文件
   → 显示文件列表 + 搜索过滤
   → 选择目标文件

3. Step 2: 预览数据
   → POST /api/schemas/:id/data-collect (action: parse)
   → 解析文件、检测图片列、提取合并单元格
   → Handsontable 在线表格渲染
   │
   ├── 编辑模式
   │   ├── 输入公式 (=SUM, =XLOOKUP)
   │   ├── 增删行列 (右键菜单)
   │   ├── 合并单元格
   │   └── 快捷键 (Ctrl+Z/Y/C/V)
   │
   ├── 图片渲染
   │   ├── URL 图片 → 缩略图
   │   └── 嵌入图片 → ZIP 提取 → DataURL
   │
   └── 列选择
       ├── 点击列头勾选
       ├── 全选 / 取消全选 / 推荐列
       └── 已选 N 列

4. Step 3: 字段映射
   → POST /api/schemas/:id/data-collect (action: analyze)
   → DDL 分析: 类型推导 + 列名清洗
   → 编辑列名 / 类型 / 排序
   → 输入目标表名

5. Step 4: 创建并导入
   → POST /api/schemas/:id/data-collect (action: create-table)
   → 生成 DDL → CREATE TABLE + 列写入
   → 状态: IMPORTED
   → 跳转数据浏览
```

---

## 4. 数据浏览与操作

```
访问 /schemas/:schemaId/tables/:tableId/data
```

### 数据表格
```
加载流程:
  → GET /api/tables/:tableId/data?page=1&pageSize=50
  → DynamicQueryBuilder 构建 SQL
  → $queryRawUnsafe 执行分页查询
  → 返回: rows + total + page

功能:
  ├── 分页 (10/20/50/100/200 每页)
  ├── 排序 (点击列头)
  ├── 搜索 (全局 LIKE 查询)
  │
  ├── 高级筛选
  │   ├── 操作符: 等于/不等于/包含/大于/小于/为空/不为空...
  │   ├── AND/OR 逻辑组合
  │   └── 活跃筛选标签展示
  │
  ├── 行操作
  │   ├── 双击单元格内联编辑 → Enter 保存 / Esc 取消
  │   ├── 行级删除 → 确认对话框
  │   └── 外键 🔗 关联数据查看
  │
  ├── 批量操作
  │   ├── 复选框选择 → 全选
  │   ├── 批量删除
  │   └── 批量更新 (统一设置字段值)
  │
  ├── 批量导入
  │   ├── 上传 CSV/Excel/JSON
  │   ├── 匹配字段 (按货号 upsert)
  │   ├── 分块发送 (500 行/批)
  │   └── 后台执行 + 进度跟踪
  │
  └── 数据导出
      ├── Excel (.xlsx) — exceljs, 含样式
      ├── CSV (.csv) — UTF-8 BOM
      └── 导出模板 — 自定义列/样式/图片/公式
```

---

## 5. 图表可视化

```
访问 /schemas/:schemaId/tables/:tableId/visualize
```

### 流程
```
1. 选择图表类型
   ├── 柱状图 (Bar)
   ├── 折线图 (Line)
   ├── 面积图 (Area)
   ├── 饼图 (Pie)
   ├── 散点图 (Scatter) — 支持颜色分组
   ├── 组合图 (Composed) — 柱+线双轴
   ├── 雷达图 (Radar) — 自动使用数值字段
   └── 热力图 (Heatmap) — SVG 色阶

2. 配置
   ├── X 轴 (文本列)
   ├── Y 轴 (数值列, 可多选)
   ├── 分组字段 (散点图)
   ├── 聚合方式 (SUM/AVG/COUNT)
   └── 排序

3. 渲染
   → Recharts 渲染
   → 自适应数据量: 散点/热力图 500 行, 其他 50 行
```

---

## 6. ETL 工作流

```
访问 /schemas/:schemaId/pipelines/:pipelineId
```

### 编辑器
```
画布操作:
  ├── 从右侧面板拖拽节点到画布
  ├── 连接节点 (输出端口 → 输入端口)
  ├── 双击节点 → 配置步骤
  ├── 拖拽节点调整位置
  ├── 滚轮缩放 / 拖拽平移
  └── 右键 → 配置/删除

步骤类型:
  ├── 数据源
  │   ├── source_table — 使用已有数据表
  │   ├── source_import — 导入文件
  │   └── source_api — 外部 API
  │
  ├── 转换
  │   ├── transform_sql — SQL 转换 ({prev} 引用上一步)
  │   ├── transform_merge — JOIN 合并
  │   └── transform_filter — WHERE 筛选
  │
  └── 输出
      └── output_table — 持久化到表
```

### 执行引擎
```
PipelineEngine.executeDAG(pipelineId):
  1. 加载 pipeline + steps + edges
  2. 拓扑排序 (Kahn 算法)
  3. 按序执行每个步骤
  4. 步骤间通过中间表 (mzan_pipe_*) 传递数据
  5. 输出到目标表
```

---

## 7. 文件管理

```
访问 /files
```

```
功能:
  ├── 文件列表 (分页)
  ├── 上传文件 (.xlsx/.xls/.csv/.json)
  ├── 文件夹管理
  │   ├── 创建文件夹 / 子文件夹
  │   ├── 面包屑导航
  │   └── 删除空文件夹
  ├── 标签管理 (增删标签)
  ├── 搜索过滤
  ├── 文件分享 (选择用户)
  ├── 文件预览
  │   ├── Excel → 表格预览 (多 Sheet)
  │   ├── CSV → 表格预览
  │   ├── JSON → 格式化展示
  │   └── 图片 → 行内展示
  └── 存储类型
      ├── 本地文件系统
      └── S3 兼容云存储 (MinIO/AWS S3)
```

---

## 8. 权限管理

### 层级结构
```
超级管理员 (ADMIN)
  └── 访问所有 Schema / Table / Data
      └── Schema Owner (创建者)
          ├── 全权限 (SELECT/INSERT/UPDATE/DELETE)
          └── 可授权其他用户
              └── TablePermission
                  ├── SELECT / INSERT / UPDATE / DELETE
                  └── ColumnPermission
                      ├── READ (可读列)
                      └── WRITE (可写列)
```

### RBAC 角色管理
```
访问 /settings/roles
  → 创建角色 (如: 数据分析师)
  → 分配权限 (Permission codes)
  → 关联用户
```

---

## 9. 看板

```
访问 /schemas/:schemaId/dashboards/:dashboardId
```

```
流程:
  1. 创建看板
  2. 添加小部件
     ├── 选择数据表
     ├── 选择图表类型
     └── 配置 X/Y 轴
  3. 拖拽布局 (react-grid-layout)
  4. 多 Tab 看板
```

---

## 文件夹导航

```
apps/
├── core/          # 主应用: 认证 / Schema / 表 / 数据 / 图表 / 导入 / 看板
├── data/          # 数据管理: 文件管理 / 数据收集
├── pipelines/     # ETL 工作流: 画布编辑 / 执行引擎
└── admin/         # 管理后台: 用户 / 角色 / 权限 / 存储 / 同步
```

## 数据库关系

```
Schema 1:N TableDefinition
TableDefinition 1:N ColumnDefinition / IndexDefinition / ForeignKeyDefinition / TriggerDefinition
User 1:N Schema / TablePermission
Schema 1:N ViewDefinition / CustomScript / ExportTemplate / ImportJob / PipelineDefinition / Dashboard
```
