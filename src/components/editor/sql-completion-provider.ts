import type * as Monaco from "monaco-editor";
import type { TableInfo, TableSchema, ColumnInfo } from "@/types";
import { getTableFullName } from "@/lib/table-utils";

// Comprehensive SQL keywords list
export const SQL_KEYWORDS = [
  // DML - Data Manipulation Language
  "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "LIKE", "BETWEEN",
  "IS", "NULL", "AS", "ORDER", "BY", "ASC", "DESC", "LIMIT", "OFFSET",
  "GROUP", "HAVING", "DISTINCT", "ALL", "UNION", "INTERSECT", "EXCEPT",
  // Joins
  "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "OUTER", "CROSS", "ON", "USING",
  // Insert/Update/Delete
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
  // DDL - Data Definition Language
  "CREATE", "ALTER", "DROP", "TABLE", "INDEX", "VIEW", "DATABASE", "SCHEMA",
  "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "CONSTRAINT", "UNIQUE",
  "DEFAULT", "AUTO_INCREMENT", "CHECK", "CASCADE", "RESTRICT",
  // Data types
  "INT", "INTEGER", "BIGINT", "SMALLINT", "TINYINT", "DECIMAL", "NUMERIC",
  "FLOAT", "REAL", "DOUBLE", "PRECISION", "VARCHAR", "CHAR", "TEXT", "BLOB",
  "DATE", "TIME", "TIMESTAMP", "DATETIME", "BOOLEAN", "BOOL", "JSON", "UUID",
  // Aggregate functions
  "COUNT", "SUM", "AVG", "MIN", "MAX", "COALESCE", "NULLIF",
  // Conditional
  "CASE", "WHEN", "THEN", "ELSE", "END", "IF", "IFNULL",
  // String functions
  "CAST", "CONVERT", "CONCAT", "LENGTH", "SUBSTRING", "SUBSTR", "TRIM",
  "LTRIM", "RTRIM", "UPPER", "LOWER", "REPLACE", "REVERSE",
  // Date functions
  "NOW", "CURRENT_DATE", "CURRENT_TIME", "CURRENT_TIMESTAMP",
  "DATE_ADD", "DATE_SUB", "DATEDIFF", "EXTRACT", "YEAR", "MONTH", "DAY",
  // Transaction
  "BEGIN", "COMMIT", "ROLLBACK", "TRANSACTION", "SAVEPOINT",
  // Subqueries & CTEs
  "EXISTS", "ANY", "SOME", "WITH", "RECURSIVE", "CTE",
  // Window functions
  "OVER", "PARTITION", "ROW_NUMBER", "RANK", "DENSE_RANK",
  "LAG", "LEAD", "FIRST_VALUE", "LAST_VALUE", "NTILE",
  // Other
  "TRUNCATE", "EXPLAIN", "ANALYZE", "GRANT", "REVOKE", "TOP",
];

export type SchemaFetcher = (tableName: string) => TableSchema | null;

interface CompletionProviderContext {
  getTables: () => TableInfo[];
  getTableSchema: SchemaFetcher;
}

/**
 * Default schemas for different databases - these are omitted for cleaner SQL
 */
const DEFAULT_SCHEMAS = ["public", "dbo"]; // PostgreSQL and MSSQL defaults

/**
 * Get the full qualified name for a table for SQL completion.
 * For default schemas (public/dbo), just use the bare table name for cleaner SQL.
 */
function getTableDisplayName(table: TableInfo): string {
  if (table.schema && !DEFAULT_SCHEMAS.includes(table.schema.toLowerCase())) {
    return `${table.schema}.${table.name}`;
  }
  return table.name;
}

/**
 * Extract table names referenced in the SQL query (after FROM/JOIN/INTO/UPDATE clauses)
 * Uses the full query text to find all table references regardless of cursor position.
 */
function extractTableReferences(sql: string, availableTables: TableInfo[]): string[] {
  const tableNames = new Set<string>();

  // Match table names after FROM, JOIN, INTO, UPDATE keywords
  const tablePattern = /\b(?:FROM|JOIN|INTO|UPDATE)\s+([`"\[]?\w+[`"\]]?(?:\.[`"\[]?\w+[`"\]]?)?)/gi;
  let match;

  while ((match = tablePattern.exec(sql)) !== null) {
    const name = match[1].replace(/[`"\[\]]/g, "");
    const exists = availableTables.some(
      (t) =>
        t.name.toLowerCase() === name.toLowerCase() ||
        getTableDisplayName(t).toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      tableNames.add(name);
    }
  }

  // Also match comma-separated tables: FROM table1, table2, table3
  const commaPattern = /\b(?:FROM|JOIN|INTO|UPDATE)\s+([`"\[]?\w+[`"\]]?(?:\.[`"\[]?\w+[`"\]]?)?)(?:\s+\w+)?(?:\s*,\s*([`"\[]?\w+[`"\]]?(?:\.[`"\[]?\w+[`"\]]?)?)(?:\s+\w+)?)+/gi;
  while ((match = commaPattern.exec(sql)) !== null) {
    // Extract all comma-separated table names from the full match
    const fullMatch = match[0];
    const commaTables = fullMatch.split(",").slice(1); // Skip first (already matched above)
    for (const part of commaTables) {
      const tableMatch = part.trim().match(/^([`"\[]?\w+[`"\]]?(?:\.[`"\[]?\w+[`"\]]?)?)/);
      if (tableMatch) {
        const name = tableMatch[1].replace(/[`"\[\]]/g, "");
        const exists = availableTables.some(
          (t) =>
            t.name.toLowerCase() === name.toLowerCase() ||
            getTableDisplayName(t).toLowerCase() === name.toLowerCase()
        );
        if (exists) {
          tableNames.add(name);
        }
      }
    }
  }

  return Array.from(tableNames);
}

/**
 * SQL keywords set for fast lookup (used to filter out false alias matches)
 */
const SQL_KEYWORDS_SET = new Set(SQL_KEYWORDS.map((k) => k.toLowerCase()));

/**
 * Extract table aliases from the SQL query.
 * Handles: FROM table alias, FROM table AS alias, JOIN table alias, JOIN table AS alias
 * Returns a map of lowercase alias -> original table name
 */
function extractTableAliases(
  sql: string,
  availableTables: TableInfo[]
): Map<string, string> {
  const aliases = new Map<string, string>();

  // Match: FROM/JOIN table_name [AS] alias
  const aliasPattern =
    /\b(?:FROM|JOIN)\s+([`"\[]?\w+[`"\]]?(?:\.[`"\[]?\w+[`"\]]?)?)\s+(?:AS\s+)?([a-zA-Z_]\w*)/gi;

  let match;
  while ((match = aliasPattern.exec(sql)) !== null) {
    const tableName = match[1].replace(/[`"\[\]]/g, "");
    const alias = match[2];

    // Skip if alias is a SQL keyword (WHERE, ON, SET, INNER, LEFT, etc.)
    if (SQL_KEYWORDS_SET.has(alias.toLowerCase())) continue;
    // Skip common clause starters that aren't in the keywords list
    if (/^(on|where|set|and|or|order|group|having|limit|offset|union|into)$/i.test(alias)) continue;

    // Verify it's a known table
    const exists = availableTables.some(
      (t) =>
        t.name.toLowerCase() === tableName.toLowerCase() ||
        getTableDisplayName(t).toLowerCase() === tableName.toLowerCase()
    );

    if (exists) {
      aliases.set(alias.toLowerCase(), tableName);
    }
  }

  return aliases;
}

/**
 * Get columns for a table, using cache if available
 */
function getColumnsForTable(
  tableName: string,
  context: CompletionProviderContext
): ColumnInfo[] {
  const { getTables, getTableSchema } = context;

  // Try to get schema from pre-fetched cache
  const schema = getTableSchema(tableName);
  if (schema) {
    return schema.columns;
  }

  // Fallback: Find the table in available tables
  const tables = getTables();
  const table = tables.find(
    (t) =>
      t.name.toLowerCase() === tableName.toLowerCase() ||
      getTableDisplayName(t).toLowerCase() === tableName.toLowerCase()
  );

  if (!table) return [];

  // Try to get schema for table with schema prefix
  const fetchName = getTableFullName(table);
  const schemaWithPrefix = getTableSchema(fetchName);

  if (schemaWithPrefix) {
    return schemaWithPrefix.columns;
  }

  return [];
}

/**
 * Create Monaco completion provider for SQL with table/column awareness
 */
export function createSqlCompletionProvider(
  context: CompletionProviderContext
): Monaco.languages.CompletionItemProvider {
  return {
    triggerCharacters: [".", " "],

    provideCompletionItems: (model, position) => {
      const { getTables } = context;

      // Get text from start of document to cursor position
      const textUntilPosition = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      // Get the current word being typed
      const word = model.getWordUntilPosition(position);
      const range: Monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: Monaco.languages.CompletionItem[] = [];

      // Check if we're after a dot (table.column or alias.column scenario)
      const dotMatch = textUntilPosition.match(/(\w+)\.\s*$/);
      if (dotMatch) {
        const prefix = dotMatch[1];

        // First try as a direct table name
        let columns = getColumnsForTable(prefix, context);

        // If no columns found, try as an alias
        if (columns.length === 0) {
          const fullText = model.getValue();
          const tables = getTables();
          const aliases = extractTableAliases(fullText, tables);
          const realTable = aliases.get(prefix.toLowerCase());
          if (realTable) {
            columns = getColumnsForTable(realTable, context);
          }
        }

        columns.forEach((col) => {
          suggestions.push({
            label: col.name,
            kind: 5, // Monaco.languages.CompletionItemKind.Field
            insertText: col.name,
            detail: col.dataType + (col.isPrimaryKey ? " (PK)" : ""),
            documentation: `${col.nullable ? "Nullable" : "NOT NULL"}${col.isPrimaryKey ? " | Primary Key" : ""}`,
            range,
          });
        });

        return { suggestions };
      }

      // Check if we're in a table context (after FROM, JOIN, INTO, UPDATE, TABLE)
      const tableContextMatch = textUntilPosition.match(
        /\b(FROM|JOIN|INTO|UPDATE|TABLE)\s+(\w*)$/i
      );
      if (tableContextMatch) {
        const tables = getTables();

        tables.forEach((table) => {
          const displayName = getTableDisplayName(table);
          suggestions.push({
            label: displayName,
            kind: 6, // Monaco.languages.CompletionItemKind.Class (represents tables)
            insertText: displayName,
            detail: table.tableType || "TABLE",
            documentation: table.schema ? `Schema: ${table.schema}` : undefined,
            range,
          });
        });

        return { suggestions };
      }

      // Default: suggest keywords + tables + columns from referenced tables
      // Add SQL keywords
      SQL_KEYWORDS.forEach((keyword) => {
        suggestions.push({
          label: keyword,
          kind: 17, // Monaco.languages.CompletionItemKind.Keyword
          insertText: keyword,
          range,
        });
      });

      // Add table names
      const tables = getTables();
      tables.forEach((table) => {
        const displayName = getTableDisplayName(table);
        suggestions.push({
          label: displayName,
          kind: 6, // Monaco.languages.CompletionItemKind.Class
          insertText: displayName,
          detail: table.tableType || "Table",
          range,
        });
      });

      // Add columns from tables referenced in the FULL query
      // (not just text before cursor, so columns are available when editing SELECT before FROM)
      const fullText = model.getValue();
      const referencedTables = extractTableReferences(fullText, tables);
      const seenColumns = new Set<string>();
      for (const tableName of referencedTables) {
        const columns = getColumnsForTable(tableName, context);
        columns.forEach((col) => {
          // Avoid duplicate column suggestions when multiple tables have the same column name
          const key = `${col.name}:${tableName}`;
          if (seenColumns.has(key)) return;
          seenColumns.add(key);
          suggestions.push({
            label: col.name,
            kind: 5, // Monaco.languages.CompletionItemKind.Field
            insertText: col.name,
            detail: `${tableName}.${col.name} (${col.dataType})`,
            range,
            sortText: `0_${col.name}`, // Sort columns before keywords
          });
        });
      }

      return { suggestions };
    },
  };
}
