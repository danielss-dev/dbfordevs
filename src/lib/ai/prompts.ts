/**
 * AI System Prompts
 *
 * System prompts for SQL generation, explanation, and optimization.
 * Includes support for MongoDB and Redis query generation.
 * Ported from crates/ai-assistant/src/prompts.rs
 */

import type { TableInfo, EnhancedTableInfo, AIContextConfig } from "./types";
import { mongoQueryPrompt, redisCommandPrompt } from "./nosql-prompts";

export interface QueryContext {
  databaseType?: string;
  databaseName?: string;
  schemaName?: string;
  tables: TableInfo[];
  selectedTable?: string;
  /** Current query from the editor (if any) */
  currentQuery?: string;
  /** Enhanced tables with relationships and indexes */
  enhancedTables?: EnhancedTableInfo[];
  /** Context configuration */
  contextConfig?: AIContextConfig;
  /** Manual context entries */
  manualContext?: string;
}

/**
 * Generate the system prompt for SQL generation
 * Also handles MongoDB and Redis contexts when databaseType indicates NoSQL
 */
export function sqlGenerationPrompt(context: QueryContext): string {
  // Check for MongoDB context
  if (context.databaseType?.toLowerCase() === "mongodb") {
    return mongoQueryPrompt({
      database: context.databaseName || "",
      collections: context.tables.map(t => ({
        name: t.name,
        sampleDoc: undefined, // Sample docs would need to be fetched separately
      })),
      selectedCollection: context.selectedTable,
    });
  }

  // Check for Redis context
  if (context.databaseType?.toLowerCase() === "redis") {
    return redisCommandPrompt({
      keyPatterns: context.tables.map(t => t.name), // Redis keys treated as "tables"
      dataTypes: {},
      selectedKey: context.selectedTable ? { key: context.selectedTable, type: "string" } : undefined,
    });
  }

  let prompt = `You are an expert SQL developer assistant for dbfordevs, a database management tool.
Your task is to generate accurate, efficient SQL queries based on natural language descriptions.

IMPORTANT RULES:
1. Generate ONLY valid SQL that can be executed directly
2. Use proper quoting for identifiers when necessary
3. Prefer explicit column names over SELECT *
4. Include appropriate WHERE clauses to prevent accidental data modification
5. For destructive operations (DELETE, UPDATE, DROP), always include safety measures
6. Return ONLY the SQL query without any explanation or markdown formatting
7. If the request is ambiguous, generate the most likely interpretation
8. **CRITICAL**: When table schemas are provided below, you MUST use ONLY the exact column names listed. DO NOT invent or assume column names that don't exist in the schema.

`;

  // Add database-specific context
  if (context.databaseType) {
    prompt += `DATABASE TYPE: ${context.databaseType}\n`;

    // Add database-specific hints
    const dbType = context.databaseType.toLowerCase();
    if (dbType === "postgresql" || dbType === "postgres") {
      prompt +=
        "- Use PostgreSQL syntax (ILIKE for case-insensitive, :: for casting)\n";
      prompt += "- Use SERIAL or IDENTITY for auto-increment\n";
    } else if (dbType === "mysql" || dbType === "mariadb") {
      prompt +=
        "- Use MySQL syntax (backticks for identifiers, LIMIT for pagination)\n";
      prompt += "- Use AUTO_INCREMENT for auto-increment columns\n";
    } else if (dbType === "sqlite") {
      prompt +=
        "- Use SQLite syntax (AUTOINCREMENT, || for concatenation)\n";
      prompt += "- Remember SQLite has limited ALTER TABLE support\n";
    } else if (dbType === "mssql" || dbType === "sqlserver") {
      prompt +=
        "- Use T-SQL syntax (TOP for limiting, square brackets for identifiers)\n";
      prompt += "- Use IDENTITY for auto-increment columns\n";
    }
    prompt += "\n";
  }

  // Add schema context
  if (context.tables.length > 0) {
    prompt += "AVAILABLE TABLES AND THEIR COLUMNS:\n";
    prompt += "=".repeat(50) + "\n";
    const tablesWithSchema: TableInfo[] = [];
    const tablesWithoutSchema: string[] = [];

    for (const table of context.tables) {
      if (!table.columns || table.columns.length === 0) {
        tablesWithoutSchema.push(table.name);
      } else {
        tablesWithSchema.push(table);
      }
    }

    // Tables with full schema
    for (const table of tablesWithSchema) {
      // Build display name for the table
      // Different databases use different naming conventions:
      // - PostgreSQL: schema.table (e.g., "public.accounts")
      // - MySQL: just table name (e.g., "users") - database is implicit
      // - SQLite: just table name
      const tableNameIncludesSchema = table.name.includes('.');

      let displayTableName: string;
      const dbType = context.databaseType?.toLowerCase();
      const isMySQLOrSQLite = dbType === 'mysql' || dbType === 'mariadb' || dbType === 'sqlite';

      if (isMySQLOrSQLite) {
        // For MySQL/SQLite: show just the table name (no database prefix in queries)
        displayTableName = tableNameIncludesSchema ? table.name.split('.').pop()! : table.name;
        // Optionally add database info in comment
        if (table.schema) {
          displayTableName = `${displayTableName}  /* database: ${table.schema} */`;
        }
      } else {
        // For PostgreSQL: use schema.table format
        displayTableName = tableNameIncludesSchema
          ? table.name
          : (table.schema ? `${table.schema}.${table.name}` : table.name);
      }

      prompt += `\nTable: ${displayTableName}\n`;
      prompt += `Columns (USE THESE EXACT NAMES ONLY):\n`;
      for (const col of table.columns || []) {
        const pk = col.isPrimaryKey ? " (PRIMARY KEY)" : "";
        const nullable = col.isNullable ? " NULL" : " NOT NULL";
        prompt += `  - ${col.name} : ${col.dataType}${nullable}${pk}\n`;
      }
    }

    // Tables without schema (just names)
    if (tablesWithoutSchema.length > 0) {
      prompt += `\nOther available tables (schema not loaded): ${tablesWithoutSchema.join(", ")}\n`;
      prompt += "Note: For tables without loaded schemas, you may need to ask the user to specify column names.\n";
    }

    prompt += "=".repeat(50) + "\n\n";

    if (tablesWithSchema.length > 0) {
      prompt += "⚠️ IMPORTANT: The columns listed above are the ONLY columns that exist in these tables.\n";
      prompt += "You MUST use the exact column names as shown. DO NOT assume or invent column names.\n";
      prompt += "For example, if you see 'USERNAME' in the schema, use 'USERNAME' not 'name' or 'user_name'.\n\n";
    }
  }

  // Add enhanced context if available
  if (context.enhancedTables && context.enhancedTables.length > 0) {
    const config = context.contextConfig;

    // Add foreign key relationships
    if (config?.includeForeignKeys) {
      const tablesWithRelationships = context.enhancedTables.filter(
        (t) => t.relationships && t.relationships.length > 0
      );

      if (tablesWithRelationships.length > 0) {
        prompt += "FOREIGN KEY RELATIONSHIPS:\n";
        prompt += "-".repeat(30) + "\n";

        for (const table of tablesWithRelationships) {
          const tableName = table.schema ? `${table.schema}.${table.name}` : table.name;
          for (const rel of table.relationships || []) {
            const direction = rel.type === "outgoing" ? "->" : "<-";
            prompt += `${tableName}.${rel.foreignKeyColumn} ${direction} ${rel.referencedTable}.${rel.referencedColumn}`;
            if (rel.constraintName) {
              prompt += ` (${rel.constraintName})`;
            }
            prompt += "\n";
          }
        }
        prompt += "\n";
      }
    }

    // Add indexes
    if (config?.includeIndexes) {
      const tablesWithIndexes = context.enhancedTables.filter(
        (t) => t.indexes && t.indexes.length > 0
      );

      if (tablesWithIndexes.length > 0) {
        prompt += "INDEXES:\n";
        prompt += "-".repeat(30) + "\n";

        for (const table of tablesWithIndexes) {
          const tableName = table.schema ? `${table.schema}.${table.name}` : table.name;
          for (const idx of table.indexes || []) {
            const type = idx.isPrimary ? "PRIMARY" : idx.isUnique ? "UNIQUE" : "INDEX";
            prompt += `${tableName}: ${type} ${idx.name} (${idx.columns.join(", ")})\n`;
          }
        }
        prompt += "\n";
      }
    }

    // Add sample data
    if (config?.includeSampleData) {
      const tablesWithSampleData = context.enhancedTables.filter(
        (t) => t.sampleData && t.sampleData.length > 0
      );

      if (tablesWithSampleData.length > 0) {
        prompt += "SAMPLE DATA:\n";
        prompt += "-".repeat(30) + "\n";
        prompt += "Note: This is representative data from the database to help understand the data format.\n\n";

        for (const table of tablesWithSampleData) {
          const tableName = table.schema ? `${table.schema}.${table.name}` : table.name;
          prompt += `Table ${tableName}:\n`;
          for (const row of table.sampleData || []) {
            const values = Object.entries(row)
              .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
              .join(", ");
            prompt += `  { ${values} }\n`;
          }
          prompt += "\n";
        }
      }
    }
  }

  // Add manual context if provided
  if (context.manualContext && context.manualContext.trim()) {
    prompt += "ADDITIONAL CONTEXT:\n";
    prompt += "-".repeat(30) + "\n";
    prompt += context.manualContext.trim() + "\n\n";
  }

  // Add selected table context
  if (context.selectedTable) {
    prompt += `CURRENTLY SELECTED TABLE: ${context.selectedTable}\n\n`;
  }

  // Add current query context if available
  if (context.currentQuery && context.currentQuery.trim()) {
    prompt += `CURRENT QUERY IN EDITOR:
The user currently has the following SQL query in their editor. They may ask you to modify, explain, or improve it:
\`\`\`sql
${context.currentQuery}
\`\`\`

If the user asks about "this query", "my query", "the current query", or similar, they are referring to the query above.
You can reference this query when generating new queries or providing explanations.

`;
  }

  // Debug logging
  console.log("[AI Prompt] Generated system prompt with", context.tables.length, "tables");
  console.log("[AI Prompt] Tables with columns:", context.tables.filter(t => t.columns && t.columns.length > 0).map(t => `${t.schema}.${t.name} (${t.columns?.length} columns)`));

  return prompt;
}

/**
 * Generate the system prompt for query explanation
 */
export function queryExplanationPrompt(context: QueryContext): string {
  let prompt = `You are an expert SQL developer assistant. Your task is to explain SQL queries in clear,
understandable terms for developers of varying experience levels.

EXPLANATION GUIDELINES:
1. Start with a one-sentence summary of what the query does
2. Break down the query into logical steps
3. Explain any complex operations (JOINs, subqueries, window functions)
4. Highlight potential performance considerations
5. Note any potential issues or edge cases
6. Use clear, jargon-free language where possible

FORMAT YOUR RESPONSE AS:
**Summary:** [One sentence summary]

**Step-by-step breakdown:**
1. [First operation]
2. [Second operation]
...

**Performance notes:** [Any relevant performance considerations]

**Potential issues:** [Any edge cases or concerns]

`;

  if (context.databaseType) {
    prompt += `DATABASE TYPE: ${context.databaseType}\n`;
  }

  return prompt;
}

/**
 * Generate the system prompt for query optimization
 */
export function optimizationPrompt(context: QueryContext): string {
  let prompt = `You are an expert database performance engineer. Your task is to analyze SQL queries
and suggest optimizations to improve their performance.

OPTIMIZATION AREAS TO CONSIDER:
1. Index usage - Are there missing indexes that could help?
2. Query structure - Can the query be rewritten more efficiently?
3. JOIN optimization - Are JOINs in the optimal order?
4. Subquery optimization - Can subqueries be converted to JOINs?
5. Predicate pushdown - Are WHERE clauses applied as early as possible?
6. Unnecessary operations - Are there redundant operations?
7. Data type considerations - Are there implicit type conversions?

FORMAT YOUR RESPONSE AS:
**Analysis Summary:** [Brief overview of the query's efficiency]

**Suggestions:**
1. [First optimization suggestion]
   - Impact: [Low/Medium/High]
   - Change: [What to modify]

2. [Second optimization suggestion]
   ...

**Optimized Query (if applicable):**
\`\`\`sql
[Optimized SQL]
\`\`\`

**Recommended Indexes:**
- [Index suggestion 1]
- [Index suggestion 2]

`;

  if (context.databaseType) {
    prompt += `\nDATABASE TYPE: ${context.databaseType}\n`;

    // Add database-specific optimization hints
    const dbType = context.databaseType.toLowerCase();
    if (dbType === "postgresql" || dbType === "postgres") {
      prompt += "- Consider using EXPLAIN ANALYZE for query plans\n";
      prompt +=
        "- PostgreSQL supports partial indexes and expression indexes\n";
    } else if (dbType === "mysql" || dbType === "mariadb") {
      prompt += "- Use EXPLAIN to analyze query execution\n";
      prompt +=
        "- Consider covering indexes for frequently queried columns\n";
    }
  }

  // Add schema context for optimization suggestions
  if (context.tables.length > 0) {
    prompt += "\nAVAILABLE TABLES:\n";
    for (const table of context.tables) {
      prompt += `- ${table.name}`;
      const pks = (table.columns || [])
        .filter((c) => c.isPrimaryKey)
        .map((c) => c.name);
      if (pks.length > 0) {
        prompt += ` (PK: ${pks.join(", ")})`;
      }
      prompt += "\n";
    }
  }

  return prompt;
}

/**
 * Generate system prompt for general AI chat with SQL context
 */
export function chatPrompt(context: QueryContext): string {
  return sqlGenerationPrompt(context);
}
