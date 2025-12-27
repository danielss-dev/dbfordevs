import type * as Monaco from "monaco-editor";
import type { TableInfo, TableSchema, ColumnInfo } from "@/types";

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
 * Get the full qualified name for a table, avoiding duplicate schema prefix
 */
function getTableDisplayName(table: TableInfo): string {
  // If the name already contains a dot, it likely already has the schema
  if (table.name.includes(".")) {
    return table.name;
  }
  // If there's a schema and it's not 'public' (default), prepend it
  // For public schema, just use the table name for cleaner SQL
  if (table.schema && table.schema.toLowerCase() !== "public") {
    return `${table.schema}.${table.name}`;
  }
  return table.name;
}

/**
 * Extract table names referenced in the SQL query (after FROM/JOIN clauses)
 */
function extractTableReferences(sql: string, availableTables: TableInfo[]): string[] {
  const tableNames = new Set<string>();
  // Match table names after FROM, JOIN keywords
  const tablePattern = /\b(?:FROM|JOIN)\s+([`"\[]?\w+[`"\]]?(?:\.[`"\[]?\w+[`"\]]?)?)/gi;
  let match;

  while ((match = tablePattern.exec(sql)) !== null) {
    // Remove quotes/brackets from table name
    const name = match[1].replace(/[`"\[\]]/g, "");
    // Verify it's a real table
    const exists = availableTables.some(
      (t) =>
        t.name.toLowerCase() === name.toLowerCase() ||
        getTableDisplayName(t).toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      tableNames.add(name);
    }
  }

  return Array.from(tableNames);
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
  const fetchName = table.schema ? `${table.schema}.${table.name}` : table.name;
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

      // Check if we're after a dot (table.column scenario)
      const dotMatch = textUntilPosition.match(/(\w+)\.\s*$/);
      if (dotMatch) {
        const tableName = dotMatch[1];
        const columns = getColumnsForTable(tableName, context);

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

      // Add columns from tables referenced in the query
      const referencedTables = extractTableReferences(textUntilPosition, tables);
      for (const tableName of referencedTables) {
        const columns = getColumnsForTable(tableName, context);
        columns.forEach((col) => {
          suggestions.push({
            label: col.name,
            kind: 5, // Monaco.languages.CompletionItemKind.Field
            insertText: col.name,
            detail: `${tableName}.${col.name}`,
            range,
          });
        });
      }

      return { suggestions };
    },
  };
}
