import type { Bookmark } from "@/types";

// Built-in SQL templates with common patterns
export const builtInTemplates: Bookmark[] = [
  {
    id: "builtin-select-join",
    name: "SELECT with JOIN",
    description: "Basic SELECT with INNER JOIN between two tables",
    sql: `SELECT {{columns}}
FROM {{table1}} t1
INNER JOIN {{table2}} t2 ON t1.{{join_column}} = t2.{{join_column}}
WHERE {{condition}}
ORDER BY {{order_column}};`,
    folderId: null,
    connectionId: null,
    isFavorite: false,
    isTemplate: true,
    variables: [
      { name: "columns", placeholder: "{{columns}}", defaultValue: "*" },
      { name: "table1", placeholder: "{{table1}}", defaultValue: "table1" },
      { name: "table2", placeholder: "{{table2}}", defaultValue: "table2" },
      { name: "join_column", placeholder: "{{join_column}}", defaultValue: "id" },
      { name: "condition", placeholder: "{{condition}}", defaultValue: "1=1" },
      { name: "order_column", placeholder: "{{order_column}}", defaultValue: "1" },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "builtin-select-left-join",
    name: "SELECT with LEFT JOIN",
    description: "SELECT with LEFT JOIN to include all records from the left table",
    sql: `SELECT {{columns}}
FROM {{table1}} t1
LEFT JOIN {{table2}} t2 ON t1.{{join_column}} = t2.{{join_column}}
WHERE {{condition}}
ORDER BY {{order_column}};`,
    folderId: null,
    connectionId: null,
    isFavorite: false,
    isTemplate: true,
    variables: [
      { name: "columns", placeholder: "{{columns}}", defaultValue: "*" },
      { name: "table1", placeholder: "{{table1}}", defaultValue: "table1" },
      { name: "table2", placeholder: "{{table2}}", defaultValue: "table2" },
      { name: "join_column", placeholder: "{{join_column}}", defaultValue: "id" },
      { name: "condition", placeholder: "{{condition}}", defaultValue: "1=1" },
      { name: "order_column", placeholder: "{{order_column}}", defaultValue: "1" },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "builtin-insert",
    name: "INSERT Statement",
    description: "Insert new rows into a table",
    sql: `INSERT INTO {{table_name}} ({{columns}})
VALUES ({{values}});`,
    folderId: null,
    connectionId: null,
    isFavorite: false,
    isTemplate: true,
    variables: [
      { name: "table_name", placeholder: "{{table_name}}", defaultValue: "table_name" },
      { name: "columns", placeholder: "{{columns}}", defaultValue: "column1, column2" },
      { name: "values", placeholder: "{{values}}", defaultValue: "'value1', 'value2'" },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "builtin-insert-select",
    name: "INSERT from SELECT",
    description: "Insert rows from another table using SELECT",
    sql: `INSERT INTO {{target_table}} ({{target_columns}})
SELECT {{source_columns}}
FROM {{source_table}}
WHERE {{condition}};`,
    folderId: null,
    connectionId: null,
    isFavorite: false,
    isTemplate: true,
    variables: [
      { name: "target_table", placeholder: "{{target_table}}", defaultValue: "target_table" },
      { name: "target_columns", placeholder: "{{target_columns}}", defaultValue: "col1, col2" },
      { name: "source_columns", placeholder: "{{source_columns}}", defaultValue: "col1, col2" },
      { name: "source_table", placeholder: "{{source_table}}", defaultValue: "source_table" },
      { name: "condition", placeholder: "{{condition}}", defaultValue: "1=1" },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "builtin-update",
    name: "UPDATE Statement",
    description: "Update existing rows in a table",
    sql: `UPDATE {{table_name}}
SET {{column}} = {{value}}
WHERE {{condition}};`,
    folderId: null,
    connectionId: null,
    isFavorite: false,
    isTemplate: true,
    variables: [
      { name: "table_name", placeholder: "{{table_name}}", defaultValue: "table_name" },
      { name: "column", placeholder: "{{column}}", defaultValue: "column_name" },
      { name: "value", placeholder: "{{value}}", defaultValue: "'new_value'" },
      { name: "condition", placeholder: "{{condition}}", defaultValue: "id = 1" },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "builtin-delete",
    name: "DELETE Statement",
    description: "Delete rows from a table with WHERE clause",
    sql: `DELETE FROM {{table_name}}
WHERE {{condition}};`,
    folderId: null,
    connectionId: null,
    isFavorite: false,
    isTemplate: true,
    variables: [
      { name: "table_name", placeholder: "{{table_name}}", defaultValue: "table_name" },
      { name: "condition", placeholder: "{{condition}}", defaultValue: "id = 1" },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "builtin-aggregation",
    name: "Aggregation with GROUP BY",
    description: "Aggregate data with COUNT, SUM, AVG and GROUP BY",
    sql: `SELECT {{group_column}},
       COUNT(*) AS count,
       SUM({{sum_column}}) AS total,
       AVG({{avg_column}}) AS average,
       MIN({{min_column}}) AS minimum,
       MAX({{max_column}}) AS maximum
FROM {{table_name}}
WHERE {{condition}}
GROUP BY {{group_column}}
HAVING {{having_condition}}
ORDER BY count DESC;`,
    folderId: null,
    connectionId: null,
    isFavorite: false,
    isTemplate: true,
    variables: [
      { name: "table_name", placeholder: "{{table_name}}", defaultValue: "table_name" },
      { name: "group_column", placeholder: "{{group_column}}", defaultValue: "category" },
      { name: "sum_column", placeholder: "{{sum_column}}", defaultValue: "amount" },
      { name: "avg_column", placeholder: "{{avg_column}}", defaultValue: "amount" },
      { name: "min_column", placeholder: "{{min_column}}", defaultValue: "amount" },
      { name: "max_column", placeholder: "{{max_column}}", defaultValue: "amount" },
      { name: "condition", placeholder: "{{condition}}", defaultValue: "1=1" },
      { name: "having_condition", placeholder: "{{having_condition}}", defaultValue: "COUNT(*) > 1" },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "builtin-cte",
    name: "Common Table Expression (CTE)",
    description: "Query using WITH clause for better readability",
    sql: `WITH {{cte_name}} AS (
    SELECT {{columns}}
    FROM {{table_name}}
    WHERE {{condition}}
)
SELECT *
FROM {{cte_name}}
ORDER BY {{order_column}};`,
    folderId: null,
    connectionId: null,
    isFavorite: false,
    isTemplate: true,
    variables: [
      { name: "cte_name", placeholder: "{{cte_name}}", defaultValue: "cte_data" },
      { name: "columns", placeholder: "{{columns}}", defaultValue: "*" },
      { name: "table_name", placeholder: "{{table_name}}", defaultValue: "table_name" },
      { name: "condition", placeholder: "{{condition}}", defaultValue: "1=1" },
      { name: "order_column", placeholder: "{{order_column}}", defaultValue: "1" },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "builtin-window-function",
    name: "Window Functions",
    description: "Use ROW_NUMBER, RANK, and other window functions",
    sql: `SELECT {{columns}},
       ROW_NUMBER() OVER (PARTITION BY {{partition_column}} ORDER BY {{order_column}}) AS row_num,
       RANK() OVER (PARTITION BY {{partition_column}} ORDER BY {{order_column}}) AS rank,
       SUM({{sum_column}}) OVER (PARTITION BY {{partition_column}}) AS partition_total
FROM {{table_name}}
ORDER BY {{partition_column}}, {{order_column}};`,
    folderId: null,
    connectionId: null,
    isFavorite: false,
    isTemplate: true,
    variables: [
      { name: "columns", placeholder: "{{columns}}", defaultValue: "*" },
      { name: "table_name", placeholder: "{{table_name}}", defaultValue: "table_name" },
      { name: "partition_column", placeholder: "{{partition_column}}", defaultValue: "category" },
      { name: "order_column", placeholder: "{{order_column}}", defaultValue: "created_at" },
      { name: "sum_column", placeholder: "{{sum_column}}", defaultValue: "amount" },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "builtin-create-index",
    name: "CREATE INDEX",
    description: "Create an index on a table column",
    sql: `CREATE INDEX {{index_name}}
ON {{table_name}} ({{columns}});`,
    folderId: null,
    connectionId: null,
    isFavorite: false,
    isTemplate: true,
    variables: [
      { name: "index_name", placeholder: "{{index_name}}", defaultValue: "idx_table_column" },
      { name: "table_name", placeholder: "{{table_name}}", defaultValue: "table_name" },
      { name: "columns", placeholder: "{{columns}}", defaultValue: "column_name" },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "builtin-create-unique-index",
    name: "CREATE UNIQUE INDEX",
    description: "Create a unique index on a table column",
    sql: `CREATE UNIQUE INDEX {{index_name}}
ON {{table_name}} ({{columns}});`,
    folderId: null,
    connectionId: null,
    isFavorite: false,
    isTemplate: true,
    variables: [
      { name: "index_name", placeholder: "{{index_name}}", defaultValue: "idx_table_column_unique" },
      { name: "table_name", placeholder: "{{table_name}}", defaultValue: "table_name" },
      { name: "columns", placeholder: "{{columns}}", defaultValue: "column_name" },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "builtin-subquery",
    name: "Subquery in WHERE",
    description: "Use a subquery in the WHERE clause",
    sql: `SELECT {{columns}}
FROM {{table_name}}
WHERE {{column}} IN (
    SELECT {{subquery_column}}
    FROM {{subquery_table}}
    WHERE {{subquery_condition}}
);`,
    folderId: null,
    connectionId: null,
    isFavorite: false,
    isTemplate: true,
    variables: [
      { name: "columns", placeholder: "{{columns}}", defaultValue: "*" },
      { name: "table_name", placeholder: "{{table_name}}", defaultValue: "table_name" },
      { name: "column", placeholder: "{{column}}", defaultValue: "id" },
      { name: "subquery_column", placeholder: "{{subquery_column}}", defaultValue: "foreign_id" },
      { name: "subquery_table", placeholder: "{{subquery_table}}", defaultValue: "other_table" },
      { name: "subquery_condition", placeholder: "{{subquery_condition}}", defaultValue: "active = true" },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "builtin-pagination",
    name: "Pagination Query",
    description: "SELECT with LIMIT and OFFSET for pagination",
    sql: `SELECT {{columns}}
FROM {{table_name}}
WHERE {{condition}}
ORDER BY {{order_column}}
LIMIT {{limit}} OFFSET {{offset}};`,
    folderId: null,
    connectionId: null,
    isFavorite: false,
    isTemplate: true,
    variables: [
      { name: "columns", placeholder: "{{columns}}", defaultValue: "*" },
      { name: "table_name", placeholder: "{{table_name}}", defaultValue: "table_name" },
      { name: "condition", placeholder: "{{condition}}", defaultValue: "1=1" },
      { name: "order_column", placeholder: "{{order_column}}", defaultValue: "id" },
      { name: "limit", placeholder: "{{limit}}", defaultValue: "10" },
      { name: "offset", placeholder: "{{offset}}", defaultValue: "0" },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "builtin-upsert",
    name: "UPSERT (INSERT ON CONFLICT)",
    description: "Insert or update on conflict (PostgreSQL syntax)",
    sql: `INSERT INTO {{table_name}} ({{columns}})
VALUES ({{values}})
ON CONFLICT ({{conflict_column}})
DO UPDATE SET {{update_column}} = EXCLUDED.{{update_column}};`,
    folderId: null,
    connectionId: null,
    databaseType: "postgresql",
    isFavorite: false,
    isTemplate: true,
    variables: [
      { name: "table_name", placeholder: "{{table_name}}", defaultValue: "table_name" },
      { name: "columns", placeholder: "{{columns}}", defaultValue: "id, name, value" },
      { name: "values", placeholder: "{{values}}", defaultValue: "1, 'name', 'value'" },
      { name: "conflict_column", placeholder: "{{conflict_column}}", defaultValue: "id" },
      { name: "update_column", placeholder: "{{update_column}}", defaultValue: "value" },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
];

// Helper function to apply template variables
export function applyTemplateVariables(
  sql: string,
  values: Record<string, string>
): string {
  let result = sql;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

// Helper function to extract variables from a SQL template
export function extractVariables(sql: string): string[] {
  const matches = sql.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

// Helper function to check if SQL contains template variables
export function hasTemplateVariables(sql: string): boolean {
  return /\{\{\w+\}\}/.test(sql);
}

// Validate bookmark export data
export function validateBookmarkExport(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Invalid data: expected an object"] };
  }

  const obj = data as Record<string, unknown>;

  if (obj.formatVersion !== 1) {
    errors.push(`Invalid formatVersion: expected 1, got ${String(obj.formatVersion)}`);
  }

  if (obj.appName !== "dbfordevs") {
    errors.push(`Invalid appName: expected "dbfordevs", got ${String(obj.appName)}`);
  }

  if (!Array.isArray(obj.bookmarks)) {
    errors.push("Missing or invalid bookmarks array");
  } else {
    for (let i = 0; i < obj.bookmarks.length; i++) {
      const b = obj.bookmarks[i] as Record<string, unknown>;
      if (!b || typeof b.name !== "string") {
        errors.push(`Bookmark at index ${i} is missing a valid "name" field`);
      }
      if (!b || typeof b.sql !== "string") {
        errors.push(`Bookmark at index ${i} is missing a valid "sql" field`);
      }
    }
  }

  if (!Array.isArray(obj.folders)) {
    errors.push("Missing or invalid folders array");
  }

  return { valid: errors.length === 0, errors };
}
