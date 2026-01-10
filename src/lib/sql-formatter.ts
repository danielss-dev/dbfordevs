import { format, type SqlLanguage, type FormatOptionsWithLanguage, type KeywordCase, type IndentStyle as SqlIndentStyle } from "sql-formatter";

export type SqlDialect = "postgresql" | "mysql" | "sqlite" | "mssql" | "mariadb" | "standard";
export type KeywordCaseOption = "upper" | "lower" | "preserve";
export type IndentStyle = "standard" | "tabularLeft" | "tabularRight";

export interface SqlFormatterOptions {
  dialect?: SqlDialect;
  keywordCase?: KeywordCaseOption;
  tabWidth?: number;
  useTabs?: boolean;
  indentStyle?: IndentStyle;
  logicalOperatorNewline?: "before" | "after";
  denseOperators?: boolean;
}

/**
 * Map our dialect names to sql-formatter's language names
 */
function mapDialectToLanguage(dialect: SqlDialect): SqlLanguage {
  const dialectMap: Record<SqlDialect, SqlLanguage> = {
    postgresql: "postgresql",
    mysql: "mysql",
    sqlite: "sqlite",
    mssql: "transactsql",
    mariadb: "mariadb",
    standard: "sql",
  };
  return dialectMap[dialect] || "sql";
}

/**
 * Map our database type to SQL dialect
 */
export function mapDatabaseTypeToDialect(databaseType?: string): SqlDialect {
  if (!databaseType) return "standard";

  const typeMap: Record<string, SqlDialect> = {
    postgres: "postgresql",
    postgresql: "postgresql",
    mysql: "mysql",
    sqlite: "sqlite",
    mssql: "mssql",
    sqlserver: "mssql",
    mariadb: "mariadb",
  };

  return typeMap[databaseType.toLowerCase()] || "standard";
}

/**
 * Format SQL code with the given options
 */
export function formatSql(sql: string, options: SqlFormatterOptions = {}): string {
  const {
    dialect = "standard",
    keywordCase = "upper",
    tabWidth = 2,
    useTabs = false,
    indentStyle = "standard",
    logicalOperatorNewline = "before",
    denseOperators = false,
  } = options;

  const formatOptions: FormatOptionsWithLanguage = {
    language: mapDialectToLanguage(dialect),
    keywordCase: keywordCase as KeywordCase,
    tabWidth,
    useTabs,
    linesBetweenQueries: 2,
    indentStyle: indentStyle as SqlIndentStyle,
    logicalOperatorNewline,
    denseOperators,
  };

  try {
    return format(sql, formatOptions);
  } catch (error) {
    // If formatting fails, return original SQL
    console.error("SQL formatting failed:", error);
    return sql;
  }
}

/**
 * Format only the selected text within the full SQL
 */
export function formatSqlSelection(
  fullSql: string,
  selection: { startLine: number; startColumn: number; endLine: number; endColumn: number },
  options: SqlFormatterOptions = {}
): { formatted: string; newSelection: { startLine: number; startColumn: number; endLine: number; endColumn: number } } {
  const lines = fullSql.split("\n");

  // Extract the selected text
  let selectedText = "";
  if (selection.startLine === selection.endLine) {
    selectedText = lines[selection.startLine - 1].substring(
      selection.startColumn - 1,
      selection.endColumn - 1
    );
  } else {
    // First line
    selectedText = lines[selection.startLine - 1].substring(selection.startColumn - 1);
    // Middle lines
    for (let i = selection.startLine; i < selection.endLine - 1; i++) {
      selectedText += "\n" + lines[i];
    }
    // Last line
    selectedText += "\n" + lines[selection.endLine - 1].substring(0, selection.endColumn - 1);
  }

  // Format the selected text
  const formattedSelection = formatSql(selectedText.trim(), options);

  // Build the new full text
  const beforeSelection = lines
    .slice(0, selection.startLine - 1)
    .join("\n") +
    (selection.startLine > 1 ? "\n" : "") +
    lines[selection.startLine - 1].substring(0, selection.startColumn - 1);

  const afterSelection = lines[selection.endLine - 1].substring(selection.endColumn - 1) +
    (selection.endLine < lines.length ? "\n" : "") +
    lines.slice(selection.endLine).join("\n");

  const formatted = beforeSelection + formattedSelection + afterSelection;

  // Calculate new selection bounds
  const formattedLines = formattedSelection.split("\n");
  const newEndLine = selection.startLine + formattedLines.length - 1;
  const newEndColumn = formattedLines.length === 1
    ? selection.startColumn + formattedLines[0].length
    : formattedLines[formattedLines.length - 1].length + 1;

  return {
    formatted,
    newSelection: {
      startLine: selection.startLine,
      startColumn: selection.startColumn,
      endLine: newEndLine,
      endColumn: newEndColumn,
    },
  };
}

/**
 * Default formatter settings
 */
export const defaultFormatterSettings: Required<SqlFormatterOptions> = {
  dialect: "standard",
  keywordCase: "upper",
  tabWidth: 2,
  useTabs: false,
  indentStyle: "standard",
  logicalOperatorNewline: "before",
  denseOperators: false,
};
