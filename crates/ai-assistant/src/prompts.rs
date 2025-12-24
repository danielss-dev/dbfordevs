//! AI Prompts for SQL generation and analysis
//!
//! This module contains the system prompts used to guide the AI in generating
//! SQL queries, explaining queries, and suggesting optimizations.

use crate::QueryContext;

/// Generate the system prompt for SQL generation
pub fn sql_generation_prompt(context: &QueryContext) -> String {
    let mut prompt = String::from(
        r#"You are an expert SQL developer assistant for dbfordevs, a database management tool. 
Your task is to generate accurate, efficient SQL queries based on natural language descriptions.

IMPORTANT RULES:
1. Generate ONLY valid SQL that can be executed directly
2. Use proper quoting for identifiers when necessary
3. Prefer explicit column names over SELECT *
4. Include appropriate WHERE clauses to prevent accidental data modification
5. For destructive operations (DELETE, UPDATE, DROP), always include safety measures
6. Return ONLY the SQL query without any explanation or markdown formatting
7. If the request is ambiguous, generate the most likely interpretation

"#,
    );

    // Add database-specific context
    if let Some(ref db_type) = context.database_type {
        prompt.push_str(&format!("DATABASE TYPE: {}\n", db_type));
        
        // Add database-specific hints
        match db_type.to_lowercase().as_str() {
            "postgresql" | "postgres" => {
                prompt.push_str("- Use PostgreSQL syntax (ILIKE for case-insensitive, :: for casting)\n");
                prompt.push_str("- Use SERIAL or IDENTITY for auto-increment\n");
            }
            "mysql" | "mariadb" => {
                prompt.push_str("- Use MySQL syntax (backticks for identifiers, LIMIT for pagination)\n");
                prompt.push_str("- Use AUTO_INCREMENT for auto-increment columns\n");
            }
            "sqlite" => {
                prompt.push_str("- Use SQLite syntax (AUTOINCREMENT, || for concatenation)\n");
                prompt.push_str("- Remember SQLite has limited ALTER TABLE support\n");
            }
            "mssql" | "sqlserver" => {
                prompt.push_str("- Use T-SQL syntax (TOP for limiting, square brackets for identifiers)\n");
                prompt.push_str("- Use IDENTITY for auto-increment columns\n");
            }
            _ => {}
        }
        prompt.push('\n');
    }

    // Add schema context
    if !context.tables.is_empty() {
        prompt.push_str("AVAILABLE TABLES AND COLUMNS:\n");
        for table in &context.tables {
            prompt.push_str(&format!("\n{}:\n", table.name));
            for col in &table.columns {
                let pk = if col.is_primary_key { " (PK)" } else { "" };
                let nullable = if col.is_nullable { " NULL" } else { " NOT NULL" };
                prompt.push_str(&format!("  - {} {}{}{}\n", col.name, col.data_type, nullable, pk));
            }
        }
        prompt.push('\n');
    }

    // Add selected table context
    if let Some(ref selected) = context.selected_table {
        prompt.push_str(&format!("CURRENTLY SELECTED TABLE: {}\n\n", selected));
    }

    prompt
}

/// Generate the system prompt for query explanation
pub fn query_explanation_prompt(context: &QueryContext) -> String {
    let mut prompt = String::from(
        r#"You are an expert SQL developer assistant. Your task is to explain SQL queries in clear, 
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

"#,
    );

    if let Some(ref db_type) = context.database_type {
        prompt.push_str(&format!("DATABASE TYPE: {}\n", db_type));
    }

    prompt
}

/// Generate the system prompt for query optimization
pub fn optimization_prompt(context: &QueryContext) -> String {
    let mut prompt = String::from(
        r#"You are an expert database performance engineer. Your task is to analyze SQL queries 
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
```sql
[Optimized SQL]
```

**Recommended Indexes:**
- [Index suggestion 1]
- [Index suggestion 2]

"#,
    );

    if let Some(ref db_type) = context.database_type {
        prompt.push_str(&format!("\nDATABASE TYPE: {}\n", db_type));
        
        // Add database-specific optimization hints
        match db_type.to_lowercase().as_str() {
            "postgresql" | "postgres" => {
                prompt.push_str("- Consider using EXPLAIN ANALYZE for query plans\n");
                prompt.push_str("- PostgreSQL supports partial indexes and expression indexes\n");
            }
            "mysql" | "mariadb" => {
                prompt.push_str("- Use EXPLAIN to analyze query execution\n");
                prompt.push_str("- Consider covering indexes for frequently queried columns\n");
            }
            _ => {}
        }
    }

    // Add schema context for optimization suggestions
    if !context.tables.is_empty() {
        prompt.push_str("\nAVAILABLE TABLES:\n");
        for table in &context.tables {
            prompt.push_str(&format!("- {}", table.name));
            let pks: Vec<_> = table.columns.iter()
                .filter(|c| c.is_primary_key)
                .map(|c| c.name.as_str())
                .collect();
            if !pks.is_empty() {
                prompt.push_str(&format!(" (PK: {})", pks.join(", ")));
            }
            prompt.push('\n');
        }
    }

    prompt
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{ColumnInfo, TableInfo};

    #[test]
    fn test_sql_generation_prompt_with_context() {
        let context = QueryContext {
            database_type: Some("postgresql".to_string()),
            database_name: Some("testdb".to_string()),
            schema_name: None,
            tables: vec![TableInfo {
                name: "users".to_string(),
                columns: vec![
                    ColumnInfo {
                        name: "id".to_string(),
                        data_type: "integer".to_string(),
                        is_nullable: false,
                        is_primary_key: true,
                    },
                    ColumnInfo {
                        name: "name".to_string(),
                        data_type: "varchar(255)".to_string(),
                        is_nullable: false,
                        is_primary_key: false,
                    },
                ],
            }],
            selected_table: Some("users".to_string()),
        };

        let prompt = sql_generation_prompt(&context);
        assert!(prompt.contains("postgresql"));
        assert!(prompt.contains("users"));
        assert!(prompt.contains("ILIKE"));
    }

    #[test]
    fn test_empty_context() {
        let context = QueryContext::default();
        let prompt = sql_generation_prompt(&context);
        assert!(prompt.contains("expert SQL developer"));
    }
}

