/**
 * Step config field registry — 步骤配置字段的声明式定义。
 *
 * 每种 stepType 定义一个字段列表，StepConfigDialog 据此动态渲染表单控件。
 * 新增字段只需在此处声明，无需修改 UI 组件。
 */

// ─── 类型定义 ───────────────────────────────────────────

export type FieldType = "text" | "combobox" | "select" | "textarea" | "checkbox";

/** 字段级帮助提示 */
interface FieldHelp {
  text: string;
  /** true = 使用 <code> 标签包裹 text 中的 {prev} 等占位符 */
  highlightPlaceholders?: boolean;
}

export interface OptionItem {
  label: string;
  value: string;
}

/**
 * 选项加载源
 * - `"schema-tables"`     → 获取当前 schema 下状态非 DRAFT 的表列表
 * - `"import-files"`      → 获取当前 schema 下的导入文件列表
 * - `"table-columns"`     → 获取某个表的列列表，表 ID 由 `dependsOnField` 指定
 * - `"prev-table-columns"`→ 获取 pipeline 上一步输出表的列列表
 */
export type OptionSource =
  | "schema-tables"
  | "import-files"
  | "table-columns"
  | "prev-table-columns";

export interface ConfigFieldDef {
  /** config 中的 key，支持点号嵌套，如 "authConfig.username" */
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  helperText?: string;

  /** Select 或 Combobox 的静态选项 */
  options?: OptionItem[];

  /** Combobox 动态选项来源 */
  optionSource?: OptionSource;

  /**
   * 当 optionSource 为 "schema-tables" 时，
   * 指定选项的 value 用表记录的哪个字段：
   * - "id" (默认): 表定义 UUID
   * - "physicalName": 物理表名，如 "mzan_tbl_xxx"
   */
  optionValueKey?: "id" | "physicalName";

  /**
   * 当 optionSource 为 "table-columns" 时，
   * 从哪个字段（表单中声明的其他 key）获取 tableId 或 physicalName。
   * 例如 "rightSource" 表示从 form 的 rightSource 字段取值。
   */
  dependsOnField?: string;

  /** 条件显示：仅当指定字段的值匹配时渲染 */
  showIf?: { field: string; value: string };

  /**
   * 特殊子类型标记
   * - "filter-config" → 使用 FilterForm 组件
   * - 留空则使用默认渲染
   */
  subType?: "filter-config";
}

// ─── 各步骤类型的字段定义 ───────────────────────────────

export const stepConfigFields: Record<string, ConfigFieldDef[]> = {
  // ── 数据源：已有表 ──
  source_table: [
    {
      key: "sourceTableId",
      label: "选择源数据表",
      type: "combobox",
      required: true,
      placeholder: "搜索或选择数据表...",
      optionSource: "schema-tables",
    },
  ],

  // ── 数据源：导入文件 ──
  source_import: [
    {
      key: "fileId",
      label: "选择已上传的文件",
      type: "combobox",
      placeholder: "文件 ID",
      helperText: "需要先通过导入功能上传文件，然后在此选择文件",
      optionSource: "import-files",
    },
    {
      key: "headerRow",
      label: "表头行号",
      type: "text",
      placeholder: "1",
    },
  ],

  // ── 数据源：外部 API ──
  source_api: [
    {
      key: "endpoint",
      label: "API 端点 URL",
      type: "text",
      placeholder: "https://api.example.com/data",
      required: true,
    },
    {
      key: "method",
      label: "请求方法",
      type: "select",
      options: [
        { label: "GET", value: "GET" },
        { label: "POST", value: "POST" },
      ],
    },
    {
      key: "authType",
      label: "认证方式",
      type: "select",
      options: [
        { label: "无认证", value: "none" },
        { label: "Basic Auth", value: "basic" },
        { label: "Bearer Token", value: "token" },
      ],
    },
    {
      key: "authConfig.username",
      label: "用户名",
      type: "text",
      placeholder: "用户名",
      showIf: { field: "authType", value: "basic" },
    },
    {
      key: "authConfig.password",
      label: "密码",
      type: "text",
      placeholder: "密码",
      showIf: { field: "authType", value: "basic" },
    },
    {
      key: "authConfig.token",
      label: "Token",
      type: "text",
      placeholder: "Bearer Token",
      showIf: { field: "authType", value: "token" },
    },
  ],

  // ── 转换：SQL ──
  transform_sql: [
    {
      key: "sql",
      label: "SQL 查询",
      type: "textarea",
      required: true,
      placeholder: "SELECT * FROM {prev} WHERE ...",
      helperText: "使用 {prev} 引用上一步的数据表",
    },
  ],

  // ── 转换：合并 ──
  transform_merge: [
    {
      key: "joinType",
      label: "合并方式",
      type: "select",
      options: [
        { label: "INNER JOIN（内连接）", value: "INNER" },
        { label: "LEFT JOIN（左连接）", value: "LEFT" },
        { label: "RIGHT JOIN（右连接）", value: "RIGHT" },
        { label: "FULL JOIN（全连接）", value: "FULL" },
      ],
    },
    {
      key: "rightSource",
      label: "关联的右表",
      type: "combobox",
      placeholder: "搜索或选择关联表...",
      optionSource: "schema-tables",
      optionValueKey: "physicalName",
    },
    {
      key: "leftOn",
      label: "左表关联字段",
      type: "combobox",
      placeholder: "输入或选择字段名",
      optionSource: "prev-table-columns",
    },
    {
      key: "rightOn",
      label: "右表关联字段",
      type: "combobox",
      placeholder: "输入或选择字段名",
      optionSource: "table-columns",
      dependsOnField: "rightSource",
    },
  ],

  // ── 转换：筛选 ──
  transform_filter: [],

  // ── 转换：聚合 ──
  transform_aggregate: [
    {
      key: "groupBy",
      label: "分组字段",
      type: "text",
      placeholder: "例如: category, region",
      required: true,
    },
    {
      key: "aggregations",
      label: "聚合配置 (JSON)",
      type: "textarea",
      placeholder: '[{"function":"SUM","column":"amount","alias":"total"}]',
    },
  ],

  // ── 转换：去重 ──
  transform_deduplicate: [
    {
      key: "keys",
      label: "去重依据字段",
      type: "text",
      placeholder: "留空按所有列去重",
      helperText: "多个字段用逗号分隔",
    },
  ],

  // ── 转换：排序 ──
  transform_sort: [
    {
      key: "sortBy",
      label: "排序字段",
      type: "text",
      placeholder: "例如: created_at",
      required: true,
    },
    {
      key: "sortOrder",
      label: "排序方式",
      type: "select",
      options: [
        { label: "升序 (ASC)", value: "ASC" },
        { label: "降序 (DESC)", value: "DESC" },
      ],
    },
  ],

  // ── 转换：行列转置 ──
  transform_pivot: [
    {
      key: "pivotType",
      label: "转置方式",
      type: "select",
      options: [
        { label: "行转列 (PIVOT)", value: "pivot" },
        { label: "列转行 (UNPIVOT)", value: "unpivot" },
      ],
    },
    {
      key: "pivotColumn",
      label: "转置依据列",
      type: "text",
      placeholder: "例如: category",
    },
  ],

  // ── 转换：自定义脚本 ──
  transform_custom_script: [
    {
      key: "scriptType",
      label: "脚本类型",
      type: "select",
      options: [
        { label: "Python", value: "python" },
        { label: "JavaScript", value: "javascript" },
      ],
    },
    {
      key: "script",
      label: "脚本代码",
      type: "textarea",
      required: true,
      placeholder: "编写自定义转换逻辑...",
    },
  ],

  // ── 流程控制 ──
  flow_branch: [
    {
      key: "condition",
      label: "分支条件表达式",
      type: "text",
      placeholder: "例如: amount > 1000",
      helperText: '满足条件走"是"分支，否则走"否"分支',
    },
  ],
  flow_switch: [
    {
      key: "switchField",
      label: "判断字段",
      type: "text",
      placeholder: "例如: status",
      required: true,
    },
    {
      key: "cases",
      label: "分支映射 (JSON)",
      type: "textarea",
      placeholder: '{"active":"路径1","archived":"路径2"}',
    },
  ],
  flow_parallel: [],
  flow_loop: [
    {
      key: "loopType",
      label: "循环方式",
      type: "select",
      options: [
        { label: "按行循环", value: "rows" },
        { label: "固定次数", value: "times" },
      ],
    },
    {
      key: "times",
      label: "循环次数",
      type: "text",
      placeholder: "例如: 10",
      showIf: { field: "loopType", value: "times" },
    },
  ],
  flow_merge_all: [],

  // ── 新数据源 ──
  source_database: [
    {
      key: "dbType",
      label: "数据库类型",
      type: "select",
      options: [
        { label: "MySQL", value: "mysql" },
        { label: "PostgreSQL", value: "postgresql" },
      ],
    },
    {
      key: "connectionString",
      label: "连接字符串",
      type: "text",
      placeholder: "mysql://user:pass@host:3306/db",
      required: true,
    },
    {
      key: "query",
      label: "查询 SQL",
      type: "textarea",
      placeholder: "SELECT * FROM table_name",
    },
  ],
  source_stream: [
    {
      key: "streamType",
      label: "流类型",
      type: "select",
      options: [
        { label: "Kafka", value: "kafka" },
        { label: "Redis", value: "redis" },
      ],
    },
    {
      key: "connection",
      label: "连接配置 (JSON)",
      type: "textarea",
      placeholder: '{"host":"localhost","port":9092,"topic":"data"}',
    },
  ],
  source_webhook: [
    {
      key: "endpoint",
      label: "Webhook 路径",
      type: "text",
      placeholder: "/webhook/my-endpoint",
      helperText: "系统自动生成接收 URL",
    },
    {
      key: "authToken",
      label: "验证 Token",
      type: "text",
      placeholder: "可选：用于验证请求来源",
    },
  ],

  // ── 新输出 ──
  output_api: [
    {
      key: "endpoint",
      label: "目标 API URL",
      type: "text",
      placeholder: "https://api.example.com/data",
      required: true,
    },
    {
      key: "method",
      label: "请求方法",
      type: "select",
      options: [
        { label: "POST", value: "POST" },
        { label: "PUT", value: "PUT" },
        { label: "PATCH", value: "PATCH" },
      ],
    },
  ],
  output_file: [
    {
      key: "format",
      label: "导出格式",
      type: "select",
      options: [
        { label: "Excel (.xlsx)", value: "xlsx" },
        { label: "CSV (.csv)", value: "csv" },
      ],
    },
    {
      key: "fileName",
      label: "文件名",
      type: "text",
      placeholder: "例如: 导出数据",
    },
  ],
  output_notification: [
    {
      key: "notifyType",
      label: "通知方式",
      type: "select",
      options: [
        { label: "邮件", value: "email" },
        { label: "Webhook", value: "webhook" },
      ],
    },
    {
      key: "recipient",
      label: "收件人 / URL",
      type: "text",
      placeholder: "email@example.com 或 https://hook.example.com/notify",
    },
    {
      key: "message",
      label: "通知内容",
      type: "textarea",
      placeholder: "Pipeline 执行完成: {rows} 行已处理",
    },
  ],

  // ── 输出 ──
  output_table: [
    {
      key: "tableName",
      label: "输出表名",
      type: "text",
      required: true,
      placeholder: "例如：清洗后商品数据",
    },
    {
      key: "overwriteIfExists",
      label: "如果表已存在则覆盖",
      type: "checkbox",
    },
  ],
};

// ── 步骤类型元信息 ──────────────────────────────────────

export interface StepTypeMeta {
  label: string;
  description: string;
  group: "source" | "transform" | "output" | "flow";
}

export const stepTypeMeta: Record<string, StepTypeMeta> = {
  source_table: {
    label: "已有数据表",
    description: "从当前数据模型中选择一个已有表作为数据源",
    group: "source",
  },
  source_import: {
    label: "导入文件",
    description: "从已上传的 Excel/CSV 文件中读取数据",
    group: "source",
  },
  source_api: {
    label: "外部 API",
    description: "从外部 API 接口拉取数据",
    group: "source",
  },
  transform_sql: {
    label: "SQL 转换",
    description: "通过 SQL 查询对上一步数据进行处理",
    group: "transform",
  },
  transform_merge: {
    label: "合并数据",
    description: "将上一步数据与另一个表进行合并（JOIN）",
    group: "transform",
  },
  transform_filter: {
    label: "筛选数据",
    description: "按条件对上一步数据进行过滤",
    group: "transform",
  },
  output_table: {
    label: "输出到表",
    description: "将处理结果保存为数据模型中的持久表",
    group: "output",
  },

  // ── 新增流程控制 ──
  flow_branch: {
    label: "条件分支",
    description: "根据条件将数据路由到不同的下游路径",
    group: "flow",
  },
  flow_switch: {
    label: "多路分支",
    description: "根据多个条件匹配将数据分发到不同路径",
    group: "flow",
  },
  flow_parallel: {
    label: "并行分发",
    description: "将数据同时分发到多条下游路径并行处理",
    group: "flow",
  },
  flow_loop: {
    label: "循环",
    description: "对数据迭代执行相同的处理逻辑",
    group: "flow",
  },
  flow_merge_all: {
    label: "合并流",
    description: "将多条输入流合并为一条（UNION ALL）",
    group: "flow",
  },

  // ── 新增数据源 ──
  source_database: {
    label: "外部数据库",
    description: "从外部 MySQL/PostgreSQL 数据库拉取数据",
    group: "source",
  },
  source_stream: {
    label: "流式数据",
    description: "从 Kafka/Redis 等流式数据源读取数据",
    group: "source",
  },
  source_webhook: {
    label: "Webhook",
    description: "通过 Webhook 接收外部系统推送的数据",
    group: "source",
  },

  // ── 新增转换 ──
  transform_filter: {
    label: "筛选数据",
    description: "按条件对上一步数据进行过滤",
    group: "transform",
  },
  transform_aggregate: {
    label: "聚合计算",
    description: "对数据进行分组聚合（GROUP BY）",
    group: "transform",
  },
  transform_pivot: {
    label: "行列转置",
    description: "将行转为列（PIVOT）或将列转为行（UNPIVOT）",
    group: "transform",
  },
  transform_deduplicate: {
    label: "去重",
    description: "根据指定列去除重复行",
    group: "transform",
  },
  transform_sort: {
    label: "排序",
    description: "按指定字段对数据进行排序",
    group: "transform",
  },
  transform_union: {
    label: "UNION 合并",
    description: "将多个数据源合并为一张表",
    group: "transform",
  },
  transform_custom_script: {
    label: "自定义脚本",
    description: "通过 Python/JS 脚本实现自定义转换逻辑",
    group: "transform",
  },
  transform_custom_script: {
    label: "自定义脚本",
    description: "通过 Python/JS 脚本实现自定义转换逻辑",
    group: "transform",
  },

  // ── 新增输出 ──
  output_api: {
    label: "推送到 API",
    description: "将处理结果发送到外部 API 接口",
    group: "output",
  },
  output_file: {
    label: "导出文件",
    description: "将处理结果导出为 Excel/CSV 文件",
    group: "output",
  },
  output_notification: {
    label: "通知",
    description: "发送邮件或 Webhook 通知",
    group: "output",
  },
};

// ── 辅助函数 ────────────────────────────────────────────

/** 获取指定步骤类型的字段定义（只返回在当前条件下应该显示的字段） */
export function getVisibleFields(defs: ConfigFieldDef[], formValues: Record<string, unknown>): ConfigFieldDef[] {
  return defs.filter((f) => {
    if (!f.showIf) return true;
    const currentVal = getNestedValue(formValues, f.showIf.field);
    return String(currentVal ?? "") === f.showIf.value;
  });
}

/** 按点号路径获取嵌套值，如 getNestedValue({ authConfig: { token: "x" } }, "authConfig.token") */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

/** 按点号路径设置嵌套值 */
export function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split(".");
  const result = { ...obj };
  let current = result;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (!(k in current) || typeof current[k] !== "object" || current[k] === null) {
      current[k] = {};
    }
    current[k] = { ...(current[k] as Record<string, unknown>) };
    current = current[k] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
  return result;
}
