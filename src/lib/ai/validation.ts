/**
 * AI Query Validation
 *
 * Validates SQL queries for security, performance, and semantic issues.
 */

import type {
  TableInfo,
  ValidationConfig,
  ValidationResult,
  ValidationIssue,
  ValidationSeverity,
  ValidationCategory,
} from "./types";

/**
 * Security patterns to check for dangerous operations
 */
const SECURITY_PATTERNS: Array<{
  pattern: RegExp;
  message: string;
  suggestion: string;
  severity: ValidationSeverity;
}> = [
  {
    pattern: /\bDROP\s+(TABLE|DATABASE|SCHEMA)\b/i,
    message: "DROP statement detected - this will permanently delete data",
    suggestion: "Ensure you have a backup before executing this statement",
    severity: "error",
  },
  {
    pattern: /\bTRUNCATE\s+TABLE\b/i,
    message: "TRUNCATE statement detected - this will delete all rows",
    suggestion: "Consider using DELETE with a WHERE clause for more control",
    severity: "error",
  },
  // DELETE without WHERE and UPDATE without WHERE are checked explicitly in checkSecurity()
  {
    pattern: /\bALTER\s+TABLE\s+\w+\s+DROP\s+COLUMN\b/i,
    message: "Dropping a column will permanently remove data",
    suggestion: "Ensure you have a backup of the column data",
    severity: "warning",
  },
  {
    pattern: /\bGRANT\s+ALL\s+PRIVILEGES\b/i,
    message: "Granting all privileges is a security risk",
    suggestion: "Grant only the specific privileges needed",
    severity: "warning",
  },
];

/**
 * Performance patterns to check for potentially slow queries
 */
const PERFORMANCE_PATTERNS: Array<{
  pattern: RegExp;
  message: string;
  suggestion: string;
}> = [
  {
    pattern: /\bSELECT\s+\*\s+FROM\b/i,
    message: "SELECT * returns all columns which may be inefficient",
    suggestion: "Specify only the columns you need",
  },
  {
    pattern: /\bLIKE\s+['"]%[^'"]+['"]/i,
    message: "Leading wildcard in LIKE prevents index usage",
    suggestion: "Avoid leading wildcards when possible for better performance",
  },
  {
    pattern: /\bNOT\s+IN\s*\(/i,
    message: "NOT IN can be slow with large result sets",
    suggestion: "Consider using NOT EXISTS or LEFT JOIN with NULL check",
  },
  {
    pattern: /\bOR\s+\w+\s*=\s*\w+/gi,
    message: "Multiple OR conditions may prevent index usage",
    suggestion: "Consider using UNION or IN clause instead",
  },
  {
    pattern: /\bSELECT\b(?:(?!\bLIMIT\b).)*$/is,
    message: "Query without LIMIT may return large result sets",
    suggestion: "Add a LIMIT clause for better performance",
  },
  {
    pattern: /\bORDER\s+BY\b(?:(?!\bLIMIT\b).)*$/is,
    message: "ORDER BY without LIMIT requires sorting entire result set",
    suggestion: "Add a LIMIT clause when using ORDER BY",
  },
];

/**
 * Create a validation issue
 */
function createIssue(
  category: ValidationCategory,
  severity: ValidationSeverity,
  message: string,
  suggestion?: string
): ValidationIssue {
  return {
    id: crypto.randomUUID(),
    category,
    severity,
    message,
    suggestion,
  };
}

/**
 * Check security issues in the query
 */
function checkSecurity(
  sql: string,
  config: ValidationConfig
): ValidationIssue[] {
  if (!config.enableSecurityWarnings) return [];

  const issues: ValidationIssue[] = [];
  const upperSql = sql.toUpperCase();

  // Check for DELETE without WHERE
  if (/\bDELETE\s+FROM\b/i.test(sql) && !upperSql.includes("WHERE")) {
    issues.push(
      createIssue(
        "security",
        "error",
        "DELETE without WHERE clause - this will delete all rows",
        "Add a WHERE clause to limit the rows affected"
      )
    );
  }

  // Check for UPDATE without WHERE
  if (/\bUPDATE\s+\S+\s+SET\b/i.test(sql) && !upperSql.includes("WHERE")) {
    issues.push(
      createIssue(
        "security",
        "error",
        "UPDATE without WHERE clause - this will update all rows",
        "Add a WHERE clause to limit the rows affected"
      )
    );
  }

  // Check other security patterns
  for (const { pattern, message, suggestion, severity } of SECURITY_PATTERNS) {
    if (pattern.test(sql)) {
      issues.push(createIssue("security", severity, message, suggestion));
    }
  }

  return issues;
}

/**
 * Check performance issues in the query
 */
function checkPerformance(
  sql: string,
  config: ValidationConfig
): ValidationIssue[] {
  if (!config.enablePerformanceWarnings) return [];

  const issues: ValidationIssue[] = [];

  for (const { pattern, message, suggestion } of PERFORMANCE_PATTERNS) {
    if (pattern.test(sql)) {
      issues.push(createIssue("performance", "warning", message, suggestion));
    }
  }

  return issues;
}

/**
 * Check semantic issues against table schema
 */
function checkSemantic(
  sql: string,
  tables: TableInfo[],
  config: ValidationConfig
): ValidationIssue[] {
  if (!config.enableSemanticCheck || tables.length === 0) return [];

  const issues: ValidationIssue[] = [];

  // Extract table references from query
  const tablePattern = /\b(?:FROM|JOIN|INTO|UPDATE)\s+([`"\[]?\w+[`"\]]?(?:\.[`"\[]?\w+[`"\]]?)?)/gi;
  const referencedTables: string[] = [];
  let match;

  while ((match = tablePattern.exec(sql)) !== null) {
    const tableName = match[1].replace(/[`"\[\]]/g, "").toLowerCase();
    referencedTables.push(tableName);
  }

  // Check if referenced tables exist in context
  const knownTableNames = tables.map((t) =>
    (t.schema ? `${t.schema}.${t.name}` : t.name).toLowerCase()
  );
  const knownTableNamesWithoutSchema = tables.map((t) => t.name.toLowerCase());

  for (const refTable of referencedTables) {
    const tableExists =
      knownTableNames.includes(refTable) ||
      knownTableNamesWithoutSchema.includes(refTable) ||
      knownTableNames.some((t) => t.endsWith(`.${refTable}`));

    if (!tableExists && knownTableNames.length > 0) {
      issues.push(
        createIssue(
          "semantic",
          "warning",
          `Table "${refTable}" not found in current context`,
          "Ensure the table exists or refresh your schema"
        )
      );
    }
  }

  // Check for column references against schema
  for (const refTable of referencedTables) {
    const table = tables.find((t) => {
      const fullName = (t.schema ? `${t.schema}.${t.name}` : t.name).toLowerCase();
      return (
        fullName === refTable ||
        t.name.toLowerCase() === refTable ||
        fullName.endsWith(`.${refTable}`)
      );
    });

    if (table && table.columns && table.columns.length > 0) {
      // Extract column references for this table
      const columnNames = table.columns.map((c) => c.name.toLowerCase());

      // Simple pattern to find potential column references
      const columnPattern = /(?:SELECT|SET|WHERE|AND|OR|ON)\s+[^,;]+/gi;
      let colMatch;

      while ((colMatch = columnPattern.exec(sql)) !== null) {
        const clause = colMatch[0];
        // Extract identifiers that might be columns
        const identifiers = clause.match(/\b([a-z_]\w*)\b/gi) || [];

        for (const identifier of identifiers) {
          const id = identifier.toLowerCase();
          // Skip SQL keywords
          const sqlKeywords = [
            "select", "from", "where", "and", "or", "on", "set", "as",
            "join", "left", "right", "inner", "outer", "null", "not",
            "in", "like", "between", "is", "order", "by", "group",
            "having", "limit", "offset", "asc", "desc", "distinct",
          ];
          if (sqlKeywords.includes(id)) continue;

          // Check if it might be a column that doesn't exist
          if (
            !columnNames.includes(id) &&
            columnNames.length > 0 &&
            // Only warn if it looks like it should be a column reference
            !tables.some((t) => t.name.toLowerCase() === id)
          ) {
            // Check if this identifier appears after a table alias
            const aliasPattern = new RegExp(`\\b${id}\\s*\\.`, "i");
            if (!aliasPattern.test(sql)) {
              // Could be a column reference - don't warn to avoid false positives
            }
          }
        }
      }
    }
  }

  return issues;
}

/**
 * Basic syntax check (pattern-based, not a full parser)
 */
function checkSyntax(
  sql: string,
  config: ValidationConfig
): ValidationIssue[] {
  if (!config.enableSyntaxCheck) return [];

  const issues: ValidationIssue[] = [];

  // Check for common syntax issues
  const syntaxPatterns: Array<{
    pattern: RegExp;
    message: string;
    suggestion: string;
  }> = [
    {
      pattern: /,\s*FROM\b/i,
      message: "Trailing comma before FROM clause",
      suggestion: "Remove the trailing comma in your column list",
    },
    {
      pattern: /\bFROM\s+,/i,
      message: "Invalid comma after FROM",
      suggestion: "Check your FROM clause syntax",
    },
    {
      pattern: /\bWHERE\s+AND\b/i,
      message: "WHERE followed directly by AND",
      suggestion: "Add a condition between WHERE and AND",
    },
    {
      pattern: /\bGROUP\s+(?!BY\b)/i,
      message: "GROUP keyword not followed by BY",
      suggestion: "Use 'GROUP BY' for grouping",
    },
    {
      pattern: /\bORDER\s+(?!BY\b)/i,
      message: "ORDER keyword not followed by BY",
      suggestion: "Use 'ORDER BY' for ordering",
    },
  ];

  for (const { pattern, message, suggestion } of syntaxPatterns) {
    if (pattern.test(sql)) {
      issues.push(createIssue("syntax", "error", message, suggestion));
    }
  }

  // Check for unbalanced parentheses
  const openParens = (sql.match(/\(/g) || []).length;
  const closeParens = (sql.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    issues.push(
      createIssue(
        "syntax",
        "error",
        `Unbalanced parentheses: ${openParens} opening, ${closeParens} closing`,
        "Check your query for missing or extra parentheses"
      )
    );
  }

  // Check for unbalanced quotes
  const singleQuotes = (sql.match(/'/g) || []).length;
  if (singleQuotes % 2 !== 0) {
    issues.push(
      createIssue(
        "syntax",
        "error",
        "Unbalanced single quotes",
        "Check your string literals for missing quotes"
      )
    );
  }

  return issues;
}

/**
 * Validate a SQL query
 */
export function validateQuery(
  sql: string,
  tables: TableInfo[],
  config: ValidationConfig
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Trim and check for empty query
  const trimmedSql = sql.trim();
  if (!trimmedSql) {
    return { isValid: true, issues: [] };
  }

  // Run all checks
  issues.push(...checkSyntax(trimmedSql, config));
  issues.push(...checkSecurity(trimmedSql, config));
  issues.push(...checkPerformance(trimmedSql, config));
  issues.push(...checkSemantic(trimmedSql, tables, config));

  // Determine if valid (no errors)
  const hasErrors = issues.some((i) => i.severity === "error");
  const isValid = !hasErrors || !config.blockDangerousQueries;

  return { isValid, issues };
}

/**
 * Get the most severe issue from a validation result
 */
export function getMostSevereIssue(
  result: ValidationResult
): ValidationIssue | null {
  if (result.issues.length === 0) return null;

  const severityOrder: Record<ValidationSeverity, number> = {
    error: 0,
    warning: 1,
    info: 2,
  };

  return result.issues.reduce((most, current) =>
    severityOrder[current.severity] < severityOrder[most.severity]
      ? current
      : most
  );
}

/**
 * Count issues by severity
 */
export function countIssuesBySeverity(
  result: ValidationResult
): Record<ValidationSeverity, number> {
  return {
    error: result.issues.filter((i) => i.severity === "error").length,
    warning: result.issues.filter((i) => i.severity === "warning").length,
    info: result.issues.filter((i) => i.severity === "info").length,
  };
}
