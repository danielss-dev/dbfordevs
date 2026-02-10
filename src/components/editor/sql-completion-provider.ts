import type * as Monaco from "monaco-editor";
import type {
  ColumnInfo,
  FunctionInfo,
  ProcedureInfo,
  TableInfo,
  TableSchema,
  ViewInfo,
} from "@/types";
import { getTableFullName } from "@/lib/table-utils";

export const SQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "LIKE", "BETWEEN",
  "IS", "NULL", "AS", "ORDER", "BY", "ASC", "DESC", "LIMIT", "OFFSET",
  "GROUP", "HAVING", "DISTINCT", "ALL", "UNION", "INTERSECT", "EXCEPT",
  "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "OUTER", "CROSS", "ON", "USING",
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
  "CREATE", "ALTER", "DROP", "TABLE", "INDEX", "VIEW", "DATABASE", "SCHEMA",
  "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "CONSTRAINT", "UNIQUE",
  "DEFAULT", "AUTO_INCREMENT", "CHECK", "CASCADE", "RESTRICT",
  "INT", "INTEGER", "BIGINT", "SMALLINT", "TINYINT", "DECIMAL", "NUMERIC",
  "FLOAT", "REAL", "DOUBLE", "PRECISION", "VARCHAR", "CHAR", "TEXT", "BLOB",
  "DATE", "TIME", "TIMESTAMP", "DATETIME", "BOOLEAN", "BOOL", "JSON", "UUID",
  "COUNT", "SUM", "AVG", "MIN", "MAX", "COALESCE", "NULLIF",
  "CASE", "WHEN", "THEN", "ELSE", "END", "IF", "IFNULL",
  "CAST", "CONVERT", "CONCAT", "LENGTH", "SUBSTRING", "SUBSTR", "TRIM",
  "LTRIM", "RTRIM", "UPPER", "LOWER", "REPLACE", "REVERSE",
  "NOW", "CURRENT_DATE", "CURRENT_TIME", "CURRENT_TIMESTAMP",
  "DATE_ADD", "DATE_SUB", "DATEDIFF", "EXTRACT", "YEAR", "MONTH", "DAY",
  "BEGIN", "COMMIT", "ROLLBACK", "TRANSACTION", "SAVEPOINT",
  "EXISTS", "ANY", "SOME", "WITH", "RECURSIVE", "CTE",
  "OVER", "PARTITION", "ROW_NUMBER", "RANK", "DENSE_RANK",
  "LAG", "LEAD", "FIRST_VALUE", "LAST_VALUE", "NTILE",
  "TRUNCATE", "EXPLAIN", "ANALYZE", "GRANT", "REVOKE", "TOP",
];

export type SchemaFetcher = (tableName: string) => TableSchema | null;

type CompletionDbObjectKind = "table" | "view" | "procedure" | "function";

interface CompletionDbObject {
  kind: CompletionDbObjectKind;
  name: string;
  schema?: string;
  detail?: string;
  language?: string;
  returnType?: string;
}

interface FunctionSnippet {
  name: string;
  snippet: string;
  detail: string;
  documentation: string;
}

interface CompletionProviderContext {
  getTables: () => TableInfo[];
  getTableSchema: SchemaFetcher;
  getDatabaseType?: () => string | undefined;
  getViews?: () => ViewInfo[];
  getProcedures?: () => ProcedureInfo[];
  getFunctions?: () => FunctionInfo[];
}

interface ParsedSqlContext {
  version: number;
  tableFingerprint: string;
  aliases: Map<string, string>;
  referencedTables: string[];
  cteColumns: Map<string, string[]>;
}

const DEFAULT_SCHEMAS = new Set(["public", "dbo"]);

const DIALECT_KEYWORD_EXTRAS: Record<string, string[]> = {
  postgresql: [
    "ILIKE", "RETURNING", "SERIAL", "BIGSERIAL", "JSONB", "UPSERT", "ON CONFLICT",
    "MATERIALIZED", "UNLOGGED", "VACUUM",
  ],
  cockroachdb: [
    "UPSERT", "RETURNING", "SHOW", "EXPERIMENTAL", "REGIONAL", "SURVIVE",
  ],
  mysql: [
    "ENGINE", "UNSIGNED", "REPLACE", "SHOW", "DESCRIBE", "LOCK", "UNLOCK",
  ],
  mariadb: [
    "ENGINE", "UNSIGNED", "REPLACE", "SHOW", "DESCRIBE", "LOCK", "UNLOCK",
  ],
  sqlite: [
    "WITHOUT", "ROWID", "AUTOINCREMENT", "PRAGMA", "GLOB",
  ],
  mssql: [
    "GO", "NVARCHAR", "IDENTITY", "MERGE", "OUTPUT", "TRY_CONVERT", "TRY_CAST",
  ],
  oracle: [
    "ROWNUM", "NVL", "SYSDATE", "SYSTIMESTAMP", "DUAL", "CONNECT", "START", "PRIOR",
  ],
};

const BASE_FUNCTION_SNIPPETS: FunctionSnippet[] = [
  {
    name: "COUNT",
    snippet: "COUNT(${1:*})",
    detail: "Aggregate",
    documentation: "Count rows or non-null values.",
  },
  {
    name: "SUM",
    snippet: "SUM(${1:column})",
    detail: "Aggregate",
    documentation: "Sum numeric values.",
  },
  {
    name: "AVG",
    snippet: "AVG(${1:column})",
    detail: "Aggregate",
    documentation: "Calculate average numeric value.",
  },
  {
    name: "COALESCE",
    snippet: "COALESCE(${1:expression}, ${2:fallback})",
    detail: "Conditional",
    documentation: "Return first non-null expression.",
  },
  {
    name: "NULLIF",
    snippet: "NULLIF(${1:expression}, ${2:expression})",
    detail: "Conditional",
    documentation: "Return null if expressions are equal.",
  },
  {
    name: "CAST",
    snippet: "CAST(${1:expression} AS ${2:type})",
    detail: "Conversion",
    documentation: "Convert value to a different data type.",
  },
];

const DIALECT_FUNCTION_SNIPPETS: Record<string, FunctionSnippet[]> = {
  postgresql: [
    {
      name: "DATE_TRUNC",
      snippet: "DATE_TRUNC('${1:month}', ${2:timestamp_column})",
      detail: "PostgreSQL",
      documentation: "Truncate timestamp to a specified precision.",
    },
    {
      name: "JSONB_EXTRACT_PATH_TEXT",
      snippet: "JSONB_EXTRACT_PATH_TEXT(${1:jsonb_column}, '${2:key}')",
      detail: "PostgreSQL",
      documentation: "Extract JSONB path text value.",
    },
  ],
  mysql: [
    {
      name: "DATE_FORMAT",
      snippet: "DATE_FORMAT(${1:date_column}, '${2:%Y-%m-%d}')",
      detail: "MySQL",
      documentation: "Format date/time values.",
    },
    {
      name: "IFNULL",
      snippet: "IFNULL(${1:expression}, ${2:fallback})",
      detail: "MySQL",
      documentation: "Return fallback when expression is null.",
    },
  ],
  mariadb: [
    {
      name: "DATE_FORMAT",
      snippet: "DATE_FORMAT(${1:date_column}, '${2:%Y-%m-%d}')",
      detail: "MariaDB",
      documentation: "Format date/time values.",
    },
  ],
  mssql: [
    {
      name: "ISNULL",
      snippet: "ISNULL(${1:expression}, ${2:fallback})",
      detail: "MSSQL",
      documentation: "Return fallback when expression is null.",
    },
    {
      name: "DATEADD",
      snippet: "DATEADD(${1:day}, ${2:1}, ${3:date_column})",
      detail: "MSSQL",
      documentation: "Add date part interval to a date value.",
    },
  ],
  oracle: [
    {
      name: "NVL",
      snippet: "NVL(${1:expression}, ${2:fallback})",
      detail: "Oracle",
      documentation: "Return fallback when expression is null.",
    },
    {
      name: "TRUNC",
      snippet: "TRUNC(${1:date_column})",
      detail: "Oracle",
      documentation: "Truncate date/time value.",
    },
  ],
  sqlite: [
    {
      name: "STRFTIME",
      snippet: "STRFTIME('${1:%Y-%m-%d}', ${2:date_column})",
      detail: "SQLite",
      documentation: "Format date/time value using format string.",
    },
  ],
};

const SQL_KEYWORDS_SET = new Set(SQL_KEYWORDS.map((keyword) => keyword.toLowerCase()));
const CLAUSE_ALIAS_STOP_WORDS = new Set([
  "on", "where", "set", "and", "or", "order", "group", "having", "limit",
  "offset", "union", "into", "left", "right", "inner", "full", "cross",
  "join", "by", "using",
]);

function normalizeDatabaseType(databaseType?: string): string {
  if (!databaseType) return "generic";
  const normalized = databaseType.toLowerCase();
  if (normalized === "postgres") return "postgresql";
  return normalized;
}

function getActiveKeywords(databaseType?: string): string[] {
  const normalized = normalizeDatabaseType(databaseType);
  const extras = DIALECT_KEYWORD_EXTRAS[normalized] ?? [];
  return Array.from(new Set([...SQL_KEYWORDS, ...extras]));
}

function getActiveFunctionSnippets(databaseType?: string): FunctionSnippet[] {
  const normalized = normalizeDatabaseType(databaseType);
  return [...BASE_FUNCTION_SNIPPETS, ...(DIALECT_FUNCTION_SNIPPETS[normalized] ?? [])];
}

function getTableDisplayName(table: TableInfo): string {
  if (table.schema && !DEFAULT_SCHEMAS.has(table.schema.toLowerCase())) {
    return `${table.schema}.${table.name}`;
  }
  return table.name;
}

function getSchemaTableName(schemaName: string, tableName: string): string {
  return `${schemaName}.${tableName}`;
}

function splitCommaSeparated(input: string): string[] {
  const chunks: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      chunks.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) {
    chunks.push(current.trim());
  }
  return chunks;
}

function parseSelectColumns(selectSql: string): string[] {
  const selectMatch = selectSql.match(/\bSELECT\b([\s\S]*?)\bFROM\b/i);
  if (!selectMatch) return [];
  const columnsPart = selectMatch[1] ?? "";
  if (!columnsPart.trim()) return [];

  const expressions = splitCommaSeparated(columnsPart);
  const columns = new Set<string>();
  for (const expression of expressions) {
    const normalizedExpr = expression.trim();
    if (!normalizedExpr || normalizedExpr === "*") continue;

    const aliasMatch = normalizedExpr.match(/\bAS\s+([a-zA-Z_]\w*)$/i)
      ?? normalizedExpr.match(/\s+([a-zA-Z_]\w*)$/i);
    if (aliasMatch) {
      columns.add(aliasMatch[1]);
      continue;
    }

    const qualifiedNameMatch = normalizedExpr.match(/([a-zA-Z_]\w*)(?:\s*)$/);
    if (qualifiedNameMatch) {
      const rawName = qualifiedNameMatch[1];
      if (rawName) {
        columns.add(rawName);
      }
    }
  }

  return Array.from(columns);
}

function parseCteDefinitions(sql: string): Map<string, string[]> {
  const cteMap = new Map<string, string[]>();
  const withMatch = /\bWITH\b/i.exec(sql);
  if (!withMatch) return cteMap;

  let cursor = withMatch.index + withMatch[0].length;
  const text = sql;

  if (/^\s+RECURSIVE\b/i.test(text.slice(cursor))) {
    const recursiveMatch = /^\s+RECURSIVE\b/i.exec(text.slice(cursor));
    if (recursiveMatch) {
      cursor += recursiveMatch[0].length;
    }
  }

  while (cursor < text.length) {
    const startSlice = text.slice(cursor);
    const nameMatch = /^\s*([a-zA-Z_]\w*)/.exec(startSlice);
    if (!nameMatch) break;

    const cteName = nameMatch[1];
    cursor += nameMatch[0].length;

    let explicitColumns: string[] = [];
    const afterName = text.slice(cursor);
    const columnListStartMatch = /^\s*\(/.exec(afterName);
    if (columnListStartMatch) {
      cursor += columnListStartMatch[0].length;
      let depth = 1;
      let columnList = "";
      while (cursor < text.length && depth > 0) {
        const char = text[cursor];
        if (char === "(") depth += 1;
        if (char === ")") depth -= 1;
        if (depth > 0) {
          columnList += char;
        }
        cursor += 1;
      }
      explicitColumns = splitCommaSeparated(columnList)
        .map((value) => value.replace(/[`"\[\]]/g, "").trim())
        .filter(Boolean);
    }

    const asMatch = /^\s*AS\s*\(/i.exec(text.slice(cursor));
    if (!asMatch) break;
    cursor += asMatch[0].length;

    let depth = 1;
    let body = "";
    while (cursor < text.length && depth > 0) {
      const char = text[cursor];
      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;
      if (depth > 0) {
        body += char;
      }
      cursor += 1;
    }

    const inferredColumns = parseSelectColumns(body);
    cteMap.set(
      cteName.toLowerCase(),
      explicitColumns.length > 0 ? explicitColumns : inferredColumns
    );

    const separatorMatch = /^\s*,/.exec(text.slice(cursor));
    if (separatorMatch) {
      cursor += separatorMatch[0].length;
      continue;
    }
    break;
  }

  return cteMap;
}

function extractTableReferences(sql: string, availableTables: TableInfo[]): string[] {
  const tableNames = new Set<string>();
  const tablePattern = /\b(?:FROM|JOIN|INTO|UPDATE)\s+([`"\[]?\w+[`"\]]?(?:\.[`"\[]?\w+[`"\]]?)?)/gi;
  let match: RegExpExecArray | null;

  while ((match = tablePattern.exec(sql)) !== null) {
    const name = match[1].replace(/[`"\[\]]/g, "");
    const exists = availableTables.some(
      (table) =>
        table.name.toLowerCase() === name.toLowerCase()
        || getTableDisplayName(table).toLowerCase() === name.toLowerCase()
        || getTableFullName(table).toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      tableNames.add(name);
    }
  }

  const commaPattern = /\b(?:FROM|JOIN|INTO|UPDATE)\s+([`"\[]?\w+[`"\]]?(?:\.[`"\[]?\w+[`"\]]?)?)(?:\s+\w+)?(?:\s*,\s*([`"\[]?\w+[`"\]]?(?:\.[`"\[]?\w+[`"\]]?)?)(?:\s+\w+)?)+/gi;
  while ((match = commaPattern.exec(sql)) !== null) {
    const fullMatch = match[0];
    const commaTables = fullMatch.split(",").slice(1);
    for (const part of commaTables) {
      const tableMatch = part.trim().match(/^([`"\[]?\w+[`"\]]?(?:\.[`"\[]?\w+[`"\]]?)?)/);
      if (!tableMatch) continue;
      const name = tableMatch[1].replace(/[`"\[\]]/g, "");
      const exists = availableTables.some(
        (table) =>
          table.name.toLowerCase() === name.toLowerCase()
          || getTableDisplayName(table).toLowerCase() === name.toLowerCase()
          || getTableFullName(table).toLowerCase() === name.toLowerCase()
      );
      if (exists) {
        tableNames.add(name);
      }
    }
  }

  return Array.from(tableNames);
}

function extractTableAliases(
  sql: string,
  availableTables: TableInfo[],
  cteColumns: Map<string, string[]>
): Map<string, string> {
  const aliases = new Map<string, string>();
  const aliasPattern = /\b(?:FROM|JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|FULL\s+JOIN|INNER\s+JOIN|CROSS\s+JOIN)\s+([`"\[]?\w+[`"\]]?(?:\.[`"\[]?\w+[`"\]]?)?)\s+(?:AS\s+)?([a-zA-Z_]\w*)/gi;

  let match: RegExpExecArray | null;
  while ((match = aliasPattern.exec(sql)) !== null) {
    const tableName = match[1].replace(/[`"\[\]]/g, "");
    const alias = match[2];
    const aliasLower = alias.toLowerCase();

    if (SQL_KEYWORDS_SET.has(aliasLower) || CLAUSE_ALIAS_STOP_WORDS.has(aliasLower)) {
      continue;
    }

    const tableExists = availableTables.some(
      (table) =>
        table.name.toLowerCase() === tableName.toLowerCase()
        || getTableDisplayName(table).toLowerCase() === tableName.toLowerCase()
        || getTableFullName(table).toLowerCase() === tableName.toLowerCase()
    );
    const cteExists = cteColumns.has(tableName.toLowerCase());

    if (tableExists || cteExists) {
      aliases.set(aliasLower, tableName);
    }
  }

  for (const cteName of cteColumns.keys()) {
    aliases.set(cteName, cteName);
  }

  return aliases;
}

function getColumnsForTable(tableName: string, context: CompletionProviderContext): ColumnInfo[] {
  const { getTables, getTableSchema } = context;

  const directSchema = getTableSchema(tableName);
  if (directSchema) return directSchema.columns;

  const tables = getTables();
  const table = tables.find(
    (candidate) =>
      candidate.name.toLowerCase() === tableName.toLowerCase()
      || getTableDisplayName(candidate).toLowerCase() === tableName.toLowerCase()
      || getTableFullName(candidate).toLowerCase() === tableName.toLowerCase()
  );
  if (!table) return [];

  const prefixedSchema = getTableSchema(getTableFullName(table));
  if (prefixedSchema) return prefixedSchema.columns;

  return [];
}

function getColumnsForSource(
  sourceName: string,
  context: CompletionProviderContext,
  parsedContext: ParsedSqlContext
): ColumnInfo[] {
  const cteColumns = parsedContext.cteColumns.get(sourceName.toLowerCase());
  if (cteColumns && cteColumns.length > 0) {
    return cteColumns.map((name) => ({
      name,
      dataType: "CTE column",
      nullable: true,
      isPrimaryKey: false,
    }));
  }
  return getColumnsForTable(sourceName, context);
}

function getAllDatabaseObjects(context: CompletionProviderContext): CompletionDbObject[] {
  const tables = context.getTables();
  const views = context.getViews?.() ?? [];
  const procedures = context.getProcedures?.() ?? [];
  const functions = context.getFunctions?.() ?? [];

  const objects: CompletionDbObject[] = [];
  for (const table of tables) {
    objects.push({
      kind: "table",
      name: table.name,
      schema: table.schema,
      detail: table.tableType || "TABLE",
    });
  }
  for (const view of views) {
    objects.push({
      kind: "view",
      name: view.name,
      schema: view.schema,
      detail: "VIEW",
    });
  }
  for (const procedure of procedures) {
    objects.push({
      kind: "procedure",
      name: procedure.name,
      schema: procedure.schema,
      detail: "PROCEDURE",
      language: procedure.language,
    });
  }
  for (const fn of functions) {
    objects.push({
      kind: "function",
      name: fn.name,
      schema: fn.schema,
      detail: "FUNCTION",
      language: fn.language,
      returnType: fn.returnType,
    });
  }
  return objects;
}

function getDisplayNameForObject(object: CompletionDbObject): string {
  if (object.schema && !DEFAULT_SCHEMAS.has(object.schema.toLowerCase())) {
    return `${object.schema}.${object.name}`;
  }
  return object.name;
}

function getTablesBySchema(tables: TableInfo[]): Map<string, TableInfo[]> {
  const schemaMap = new Map<string, TableInfo[]>();
  for (const table of tables) {
    if (!table.schema) continue;
    const key = table.schema.toLowerCase();
    const existing = schemaMap.get(key) ?? [];
    existing.push(table);
    schemaMap.set(key, existing);
  }
  return schemaMap;
}

function matchesPrefix(label: string, prefix: string, extraFilterText?: string): boolean {
  if (!prefix) return true;
  const normalizedPrefix = prefix.toLowerCase();
  const candidate = label.toLowerCase();
  if (candidate.startsWith(normalizedPrefix)) return true;

  const segments = candidate.split(".");
  if (segments.some((segment) => segment.startsWith(normalizedPrefix))) {
    return true;
  }

  if (extraFilterText) {
    return extraFilterText.toLowerCase().includes(normalizedPrefix);
  }
  return false;
}

function getObjectSuggestionKind(kind: CompletionDbObjectKind): Monaco.languages.CompletionItemKind {
  switch (kind) {
    case "table":
      return 6; // Class
    case "view":
      return 7; // Interface
    case "procedure":
      return 3; // Function
    case "function":
      return 3; // Function
    default:
      return 18; // Reference
  }
}

function toSortText(bucket: string, label: string): string {
  return `${bucket}_${label.toLowerCase()}`;
}

function createTableFingerprint(tables: TableInfo[]): string {
  return tables
    .map((table) => `${table.schema ?? ""}.${table.name}`.toLowerCase())
    .sort()
    .join("|");
}

function buildParsedSqlContext(
  model: Monaco.editor.ITextModel,
  context: CompletionProviderContext,
  cache: WeakMap<Monaco.editor.ITextModel, ParsedSqlContext>
): ParsedSqlContext {
  const tables = context.getTables();
  const tableFingerprint = createTableFingerprint(tables);
  const currentVersion = model.getVersionId();

  const cached = cache.get(model);
  if (cached && cached.version === currentVersion && cached.tableFingerprint === tableFingerprint) {
    return cached;
  }

  const fullText = model.getValue();
  const cteColumns = parseCteDefinitions(fullText);
  const parsed: ParsedSqlContext = {
    version: currentVersion,
    tableFingerprint,
    aliases: extractTableAliases(fullText, tables, cteColumns),
    referencedTables: extractTableReferences(fullText, tables),
    cteColumns,
  };
  cache.set(model, parsed);
  return parsed;
}

interface ColumnDocData {
  type: "column";
  tableName: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  dataType: string;
}

interface ObjectDocData {
  type: "object";
  objectKind: CompletionDbObjectKind;
  schema?: string;
  detail?: string;
  language?: string;
  returnType?: string;
}

interface FunctionDocData {
  type: "function-snippet";
  documentation: string;
  detail: string;
}

type CompletionDocData = ColumnDocData | ObjectDocData | FunctionDocData;
type CompletionItemWithDocData = Monaco.languages.CompletionItem & { __docData?: CompletionDocData };

export function createSqlCompletionProvider(
  context: CompletionProviderContext
): Monaco.languages.CompletionItemProvider {
  const parseCache = new WeakMap<Monaco.editor.ITextModel, ParsedSqlContext>();

  return {
    triggerCharacters: [".", " ", "("],

    provideCompletionItems: (model, position) => {
      const tables = context.getTables();
      const dbObjects = getAllDatabaseObjects(context);
      const parsedContext = buildParsedSqlContext(model, context, parseCache);
      const activeKeywords = getActiveKeywords(context.getDatabaseType?.());
      const activeFunctionSnippets = getActiveFunctionSnippets(context.getDatabaseType?.());

      const textUntilPosition = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const word = model.getWordUntilPosition(position);
      const range: Monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const prefix = (word.word ?? "").toLowerCase();

      const suggestions: Monaco.languages.CompletionItem[] = [];
      const dedupe = new Set<string>();
      const withDocData = (
        item: Monaco.languages.CompletionItem,
        docData?: CompletionDocData
      ): Monaco.languages.CompletionItem => {
        if (docData) {
          (item as CompletionItemWithDocData).__docData = docData;
        }
        return item;
      };
      const addSuggestion = (item: Monaco.languages.CompletionItem) => {
        const insertText = typeof item.insertText === "string" ? item.insertText : item.label.toString();
        const key = `${item.kind}:${item.label}:${insertText}`;
        if (dedupe.has(key)) return;
        dedupe.add(key);
        suggestions.push(item);
      };

      const schemaTables = getTablesBySchema(tables);

      const schemaTableDotMatch = textUntilPosition.match(/(\w+)\.(\w+)\.\s*$/);
      if (schemaTableDotMatch) {
        const schemaName = schemaTableDotMatch[1];
        const tableName = schemaTableDotMatch[2];
        const fullName = getSchemaTableName(schemaName, tableName);
        const columns = getColumnsForTable(fullName, context);
        for (const column of columns) {
          addSuggestion(withDocData({
            label: column.name,
            kind: 5, // Field
            insertText: column.name,
            detail: `${column.dataType}${column.isPrimaryKey ? " (PK)" : ""}`,
            documentation: `${column.nullable ? "Nullable" : "NOT NULL"}${column.isPrimaryKey ? " | Primary Key" : ""}`,
            range,
            sortText: toSortText("10_column", column.name),
          }, {
            type: "column",
            tableName: fullName,
            nullable: column.nullable,
            isPrimaryKey: column.isPrimaryKey,
            dataType: column.dataType,
          }));
        }
        return { suggestions };
      }

      const dotMatch = textUntilPosition.match(/(\w+)\.\s*$/);
      if (dotMatch) {
        const rawPrefix = dotMatch[1];
        const rawPrefixLower = rawPrefix.toLowerCase();
        const schemaMatches = schemaTables.get(rawPrefixLower);

        if (schemaMatches && schemaMatches.length > 0) {
          for (const table of schemaMatches) {
            const insertText = table.name;
            if (!matchesPrefix(insertText, prefix, table.schema)) continue;
            addSuggestion(withDocData({
              label: table.name,
              kind: 6, // Class
              insertText,
              detail: table.tableType || "TABLE",
              documentation: `Schema: ${table.schema}`,
              range,
              sortText: toSortText("00_table", table.name),
              filterText: `${table.schema ?? ""}.${table.name}`,
            }, {
              type: "object",
              objectKind: "table",
              schema: table.schema,
              detail: table.tableType,
            }));
          }
          return { suggestions };
        }

        let sourceName = rawPrefix;
        let columns = getColumnsForSource(sourceName, context, parsedContext);
        if (columns.length === 0) {
          const aliasTarget = parsedContext.aliases.get(rawPrefixLower);
          if (aliasTarget) {
            sourceName = aliasTarget;
            columns = getColumnsForSource(aliasTarget, context, parsedContext);
          }
        }

        for (const column of columns) {
          addSuggestion(withDocData({
            label: column.name,
            kind: 5, // Field
            insertText: column.name,
            detail: `${column.dataType}${column.isPrimaryKey ? " (PK)" : ""}`,
            documentation: `${column.nullable ? "Nullable" : "NOT NULL"}${column.isPrimaryKey ? " | Primary Key" : ""}`,
            range,
            sortText: toSortText("00_column", column.name),
          }, {
            type: "column",
            tableName: sourceName,
            nullable: column.nullable,
            isPrimaryKey: column.isPrimaryKey,
            dataType: column.dataType,
          }));
        }

        return { suggestions };
      }

      const tableContextMatch = textUntilPosition.match(/\b(FROM|JOIN|INTO|UPDATE|TABLE)\s+(\w*)$/i);
      if (tableContextMatch) {
        for (const cteName of parsedContext.cteColumns.keys()) {
          if (!matchesPrefix(cteName, prefix)) continue;
          addSuggestion(withDocData({
            label: cteName,
            kind: 6, // Class
            insertText: cteName,
            detail: "CTE",
            documentation: "Common Table Expression in current query.",
            range,
            sortText: toSortText("00_cte", cteName),
          }, {
            type: "object",
            objectKind: "table",
            detail: "CTE",
          }));
        }

        for (const object of dbObjects) {
          if (object.kind !== "table" && object.kind !== "view") continue;
          const displayName = getDisplayNameForObject(object);
          const extraFilterText = `${object.schema ?? ""}.${object.name}`;
          if (!matchesPrefix(displayName, prefix, extraFilterText)) continue;

          addSuggestion(withDocData({
            label: displayName,
            kind: getObjectSuggestionKind(object.kind),
            insertText: displayName,
            detail: object.detail ?? object.kind.toUpperCase(),
            documentation: object.schema ? `Schema: ${object.schema}` : undefined,
            range,
            sortText: toSortText(object.kind === "table" ? "10_table" : "11_view", displayName),
            filterText: extraFilterText,
          }, {
            type: "object",
            objectKind: object.kind,
            schema: object.schema,
            detail: object.detail,
          }));
        }

        return {
          suggestions,
          incomplete: suggestions.length > 150,
        };
      }

      for (const snippet of activeFunctionSnippets) {
        if (!matchesPrefix(snippet.name, prefix)) continue;
        addSuggestion(withDocData({
          label: snippet.name,
          kind: 27, // Snippet
          insertText: snippet.snippet,
          insertTextRules: 4, // InsertAsSnippet
          detail: snippet.detail,
          documentation: snippet.documentation,
          range,
          sortText: toSortText("00_snippet", snippet.name),
        }, {
          type: "function-snippet",
          documentation: snippet.documentation,
          detail: snippet.detail,
        }));
      }

      for (const object of dbObjects) {
        const displayName = getDisplayNameForObject(object);
        const extraFilterText = `${object.schema ?? ""}.${object.name}`;
        if (!matchesPrefix(displayName, prefix, extraFilterText)) continue;

        const isFunctionLike = object.kind === "function" || object.kind === "procedure";
        const insertText = isFunctionLike ? `${displayName}(${object.kind === "function" ? "${1}" : ""})` : displayName;
        addSuggestion(withDocData({
          label: displayName,
          kind: getObjectSuggestionKind(object.kind),
          insertText,
          insertTextRules: isFunctionLike ? 4 : undefined,
          detail: object.detail ?? object.kind.toUpperCase(),
          documentation: object.schema ? `Schema: ${object.schema}` : undefined,
          range,
          sortText: toSortText(
            object.kind === "table"
              ? "20_table"
              : object.kind === "view"
                ? "21_view"
                : object.kind === "function"
                  ? "22_function"
                  : "23_procedure",
            displayName
          ),
          filterText: extraFilterText,
        }, {
          type: "object",
          objectKind: object.kind,
          schema: object.schema,
          detail: object.detail,
          language: object.language,
          returnType: object.returnType,
        }));
      }

      const seenColumnSource = new Set<string>();
      for (const tableName of parsedContext.referencedTables) {
        const columns = getColumnsForTable(tableName, context);
        for (const column of columns) {
          const dedupeKey = `${tableName}:${column.name}`.toLowerCase();
          if (seenColumnSource.has(dedupeKey)) continue;
          seenColumnSource.add(dedupeKey);

          if (!matchesPrefix(column.name, prefix)) continue;
          addSuggestion(withDocData({
            label: column.name,
            kind: 5, // Field
            insertText: column.name,
            detail: `${tableName}.${column.name} (${column.dataType})`,
            documentation: `${column.nullable ? "Nullable" : "NOT NULL"}${column.isPrimaryKey ? " | Primary Key" : ""}`,
            range,
            sortText: toSortText("10_column", column.name),
          }, {
            type: "column",
            tableName,
            nullable: column.nullable,
            isPrimaryKey: column.isPrimaryKey,
            dataType: column.dataType,
          }));
        }
      }

      for (const keyword of activeKeywords) {
        if (!matchesPrefix(keyword, prefix)) continue;
        addSuggestion({
          label: keyword,
          kind: 17, // Keyword
          insertText: keyword,
          range,
          sortText: toSortText("90_keyword", keyword),
        });
      }

      return {
        suggestions,
        incomplete: suggestions.length > 200,
      };
    },

    resolveCompletionItem: (item) => {
      const data = (item as CompletionItemWithDocData).__docData;
      if (!data) return item;

      if (data.type === "column") {
        const parts = [
          `Table: ${data.tableName}`,
          `Type: ${data.dataType}`,
          data.nullable ? "Nullable: yes" : "Nullable: no",
          data.isPrimaryKey ? "Primary key: yes" : "Primary key: no",
        ];
        item.documentation = {
          value: parts.join("\n\n"),
        };
      } else if (data.type === "object") {
        const lines = [
          `Type: ${data.objectKind}`,
          data.schema ? `Schema: ${data.schema}` : "",
          data.detail ? `Detail: ${data.detail}` : "",
          data.language ? `Language: ${data.language}` : "",
          data.returnType ? `Returns: ${data.returnType}` : "",
        ].filter(Boolean);
        item.documentation = {
          value: lines.join("\n\n"),
        };
      } else if (data.type === "function-snippet") {
        item.documentation = {
          value: `${data.detail}\n\n${data.documentation}`,
        };
      }

      return item;
    },
  };
}

export const __testing = {
  parseCteDefinitions,
  parseSelectColumns,
  extractTableAliases,
  extractTableReferences,
  getActiveKeywords,
  getActiveFunctionSnippets,
  buildParsedSqlContext,
};
