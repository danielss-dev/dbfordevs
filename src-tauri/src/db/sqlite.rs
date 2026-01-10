use crate::db::common::{escape_sqlite_identifier, parse_cte_statement_type, CteParserConfig};
use crate::db::{DatabaseDriver, PoolRef};
use crate::error::{AppError, AppResult};
use crate::models::{
    ConnectionConfig, ConstraintInfo, ExplainResult, ExplainWarning, ExtendedColumnInfo,
    ForeignKeyInfo, IndexInfo, NewTableDefinition, PlanNode, PreviewResult, QueryResult,
    StatementPreview, StatementType, TableInfo, TableProperties, TableReferenceInfo,
    TableRelationship, TableSchema, TestConnectionResult, ColumnInfo, WarningSeverity
};
use std::collections::HashMap;
use async_trait::async_trait;
use sqlx::{sqlite::SqlitePool, Row, Column, TypeInfo};
use std::time::Instant;

pub struct SqliteDriver;

/// Parse SQLite detail string to extract meaningful information (free function for use in nested functions)
fn parse_sqlite_detail_inline(detail: &str) -> (String, Option<String>, Option<String>, Vec<String>) {
    let node_type: String;
    let mut relation_name = None;
    let mut index_name = None;
    let mut warnings = Vec::new();

    let detail_upper = detail.to_uppercase();

    if detail_upper.contains("SCAN") {
        if detail_upper.contains("USING INDEX") {
            node_type = "Index Scan".to_string();
            // Extract index name
            if let Some(idx) = detail.find("USING INDEX ") {
                let rest = &detail[idx + 12..];
                index_name = rest.split_whitespace().next().map(String::from);
            }
        } else if detail_upper.contains("USING COVERING INDEX") {
            node_type = "Covering Index Scan".to_string();
            if let Some(idx) = detail.find("USING COVERING INDEX ") {
                let rest = &detail[idx + 21..];
                index_name = rest.split_whitespace().next().map(String::from);
            }
        } else {
            node_type = "Table Scan".to_string();
            warnings.push("Full table scan detected".to_string());
        }

        // Extract table name
        if let Some(idx) = detail.find("SCAN ") {
            let rest = &detail[idx + 5..];
            relation_name = rest.split_whitespace().next().map(String::from);
        }
    } else if detail_upper.contains("SEARCH") {
        node_type = "Index Search".to_string();
        if let Some(idx) = detail.find("SEARCH ") {
            let rest = &detail[idx + 7..];
            relation_name = rest.split_whitespace().next().map(String::from);
        }
        if detail_upper.contains("USING INDEX") {
            if let Some(idx) = detail.find("USING INDEX ") {
                let rest = &detail[idx + 12..];
                let name = rest.split(|c: char| c == ' ' || c == '(').next();
                index_name = name.map(String::from);
            }
        }
    } else if detail_upper.contains("USE TEMP B-TREE") {
        node_type = "Temp B-Tree Sort".to_string();
        warnings.push("Using temporary B-tree for sorting".to_string());
    } else if detail_upper.contains("COMPOUND SUBQUERIES") {
        node_type = "Compound Query".to_string();
    } else if detail_upper.contains("CO-ROUTINE") {
        node_type = "Coroutine".to_string();
    } else if detail_upper.contains("SUBQUERY") {
        node_type = "Subquery".to_string();
    } else {
        node_type = detail.to_string();
    }

    (node_type, relation_name, index_name, warnings)
}

impl SqliteDriver {
    /// Safely split SQL into individual statements, handling quotes and comments
    fn split_sql_statements(sql: &str) -> Vec<String> {
        let mut statements = Vec::new();
        let mut current = String::new();
        let mut chars = sql.chars().peekable();
        let mut in_single_quote = false;
        let mut in_double_quote = false;
        let mut in_bracket = false;
        let mut in_line_comment = false;
        let mut in_block_comment = false;

        while let Some(c) = chars.next() {
            match c {
                '\'' if !in_double_quote && !in_bracket && !in_line_comment && !in_block_comment => {
                    if in_single_quote && chars.peek() == Some(&'\'') {
                        current.push(c);
                        current.push(chars.next().unwrap());
                    } else {
                        in_single_quote = !in_single_quote;
                        current.push(c);
                    }
                }
                '"' if !in_single_quote && !in_bracket && !in_line_comment && !in_block_comment => {
                    in_double_quote = !in_double_quote;
                    current.push(c);
                }
                '[' if !in_single_quote && !in_double_quote && !in_line_comment && !in_block_comment => {
                    in_bracket = true;
                    current.push(c);
                }
                ']' if in_bracket && !in_line_comment && !in_block_comment => {
                    in_bracket = false;
                    current.push(c);
                }
                '-' if !in_single_quote && !in_double_quote && !in_bracket && !in_line_comment && !in_block_comment => {
                    if let Some(&'-') = chars.peek() {
                        chars.next();
                        in_line_comment = true;
                    } else {
                        current.push(c);
                    }
                }
                '\n' if in_line_comment => {
                    in_line_comment = false;
                }
                '/' if !in_single_quote && !in_double_quote && !in_bracket && !in_line_comment && !in_block_comment => {
                    if let Some(&'*') = chars.peek() {
                        chars.next();
                        in_block_comment = true;
                    } else {
                        current.push(c);
                    }
                }
                '*' if in_block_comment => {
                    if let Some(&'/') = chars.peek() {
                        chars.next();
                        in_block_comment = false;
                    }
                }
                ';' if !in_single_quote && !in_double_quote && !in_bracket && !in_line_comment && !in_block_comment => {
                    let trimmed = current.trim().to_string();
                    if !trimmed.is_empty() {
                        statements.push(trimmed);
                    }
                    current.clear();
                }
                _ if !in_line_comment && !in_block_comment => {
                    current.push(c);
                }
                _ => {}
            }
        }

        let trimmed = current.trim().to_string();
        if !trimmed.is_empty() {
            statements.push(trimmed);
        }

        statements
    }

    /// Detect the type of SQL statement
    fn detect_statement_type(sql: &str) -> StatementType {
        let mut clean_sql = sql.trim().to_uppercase();

        // Skip comments
        while clean_sql.starts_with("--") || clean_sql.starts_with("/*") {
            if clean_sql.starts_with("--") {
                if let Some(newline_pos) = clean_sql.find('\n') {
                    clean_sql = clean_sql[newline_pos..].trim().to_string();
                } else {
                    return StatementType::Other;
                }
            } else if clean_sql.starts_with("/*") {
                if let Some(end_pos) = clean_sql.find("*/") {
                    clean_sql = clean_sql[end_pos + 2..].trim().to_string();
                } else {
                    return StatementType::Other;
                }
            }
        }

        if clean_sql.starts_with("CREATE") || clean_sql.starts_with("ALTER") || clean_sql.starts_with("DROP") {
            StatementType::Ddl
        } else if clean_sql.starts_with("INSERT") || clean_sql.starts_with("UPDATE") || clean_sql.starts_with("DELETE") {
            StatementType::Dml
        } else if clean_sql.starts_with("WITH") {
            parse_cte_statement_type(&clean_sql, &CteParserConfig::sqlite())
        } else if clean_sql.starts_with("SELECT") || clean_sql.starts_with("PRAGMA") {
            StatementType::Select
        } else {
            StatementType::Other
        }
    }

    /// Extract table name from SQL statement
    fn extract_table_name(sql: &str) -> Option<String> {
        let sql_upper = sql.trim().to_uppercase();
        let sql_trimmed = sql.trim();

        // Handle CREATE [TEMPORARY|TEMP] TABLE
        if sql_upper.starts_with("CREATE") {
            let rest = &sql_trimmed[6..].trim_start();
            let rest_upper = rest.to_uppercase();
            
            let after_create = if rest_upper.starts_with("TEMPORARY TABLE") {
                &rest[15..].trim_start()
            } else if rest_upper.starts_with("TEMP TABLE") {
                &rest[10..].trim_start()
            } else if rest_upper.starts_with("TABLE") {
                &rest[5..].trim_start()
            } else {
                return None;
            };

            let rest = if after_create.to_uppercase().starts_with("IF NOT EXISTS") {
                &after_create[13..].trim_start()
            } else {
                after_create
            };
            return Self::extract_identifier(rest);
        }

        // Handle ALTER TABLE
        if sql_upper.starts_with("ALTER TABLE") {
            let rest = &sql_trimmed[11..].trim_start();
            return Self::extract_identifier(rest);
        }

        // Handle DROP TABLE
        if sql_upper.starts_with("DROP TABLE") {
            let rest = &sql_trimmed[10..].trim_start();
            let rest = if rest.to_uppercase().starts_with("IF EXISTS") {
                &rest[9..].trim_start()
            } else {
                rest
            };
            return Self::extract_identifier(rest);
        }

        // Handle INSERT INTO
        if sql_upper.starts_with("INSERT INTO") {
            let rest = &sql_trimmed[11..].trim_start();
            return Self::extract_identifier(rest);
        }
        if sql_upper.starts_with("INSERT") {
            let rest = &sql_trimmed[6..].trim_start();
            return Self::extract_identifier(rest);
        }

        // Handle UPDATE
        if sql_upper.starts_with("UPDATE") {
            let rest = &sql_trimmed[6..].trim_start();
            return Self::extract_identifier(rest);
        }

        // Handle DELETE FROM
        if sql_upper.starts_with("DELETE FROM") {
            let rest = &sql_trimmed[11..].trim_start();
            return Self::extract_identifier(rest);
        }
        if sql_upper.starts_with("DELETE") {
            let rest = &sql_trimmed[6..].trim_start();
            return Self::extract_identifier(rest);
        }

        None
    }

    /// Extract identifier (table name) from the start of a string
    fn extract_identifier(s: &str) -> Option<String> {
        let s = s.trim();
        if s.is_empty() {
            return None;
        }

        // Handle quoted identifier (SQLite uses double quotes or square brackets)
        if s.starts_with('"') {
            let mut identifier = String::new();
            let mut end_byte = 1;
            let mut chars = s.char_indices().skip(1).peekable();
            let mut found_closing = false;

            while let Some((pos, c)) = chars.next() {
                if c == '"' {
                    if let Some((_, next_c)) = chars.peek() {
                        if *next_c == '"' {
                            identifier.push('"');
                            chars.next(); // consume second quote
                            continue;
                        }
                    }
                    found_closing = true;
                    end_byte = pos + 1;
                    break;
                }
                identifier.push(c);
            }

            if found_closing {
                let after = s[end_byte..].trim_start();
                if after.starts_with('.') {
                    if let Some(table) = Self::extract_identifier(after[1..].trim_start()) {
                        return Some(format!("{}.{}", identifier, table));
                    }
                }
            }
            
            return if identifier.is_empty() && !found_closing { None } else { Some(identifier) };
        }

        if s.starts_with('[') {
            let mut identifier = String::new();
            let mut end_byte = 1;
            let mut chars = s.char_indices().skip(1).peekable();
            let mut found_closing = false;

            while let Some((pos, c)) = chars.next() {
                if c == ']' {
                    if let Some((_, next_c)) = chars.peek() {
                        if *next_c == ']' {
                            identifier.push(']');
                            chars.next();
                            continue;
                        }
                    }
                    found_closing = true;
                    end_byte = pos + 1;
                    break;
                }
                identifier.push(c);
            }

            if found_closing {
                let after = s[end_byte..].trim_start();
                if after.starts_with('.') {
                    if let Some(table) = Self::extract_identifier(after[1..].trim_start()) {
                        return Some(format!("{}.{}", identifier, table));
                    }
                }
            }
            
            return if identifier.is_empty() && !found_closing { None } else { Some(identifier) };
        }

        // Handle unquoted identifier
        let mut end_byte = 0;
        for (pos, c) in s.char_indices() {
            if c.is_alphanumeric() || c == '_' {
                end_byte = pos + c.len_utf8();
            } else {
                break;
            }
        }

        if end_byte == 0 {
            return None;
        }

        let identifier = s[..end_byte].to_string();
        let after = s[end_byte..].trim_start();
        if after.starts_with('.') {
            if let Some(table) = Self::extract_identifier(after[1..].trim_start()) {
                return Some(format!("{}.{}", identifier, table));
            }
        }

        Some(identifier)
    }

    /// Get table schema (CREATE TABLE statement) within a transaction
    async fn get_table_schema_in_tx(
        tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
        table_name: &str,
    ) -> AppResult<String> {
        // Handle database-qualified names (e.g., main.users)
        let (db_prefix, actual_table_name) = if let Some(dot_pos) = table_name.rfind('.') {
            let (db, table) = table_name.split_at(dot_pos);
            (Some(db.to_string()), table.trim_start_matches('.').to_string())
        } else {
            (None, table_name.to_string())
        };

        let query = if let Some(db) = db_prefix {
            format!(
                "SELECT sql FROM \"{}\".sqlite_master WHERE type = 'table' AND name = ?",
                escape_sqlite_identifier(&db)
            )
        } else {
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?".to_string()
        };

        let ddl: Option<String> = sqlx::query_scalar(&query)
            .bind(actual_table_name)
            .fetch_optional(&mut **tx)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get table schema: {}", e)))?;

        ddl.ok_or_else(|| AppError::QueryError(format!("Table {} does not exist", table_name)))
    }

    /// Execute a single SQL statement
    async fn execute_single_query(pool: &SqlitePool, sql: &str, start: Instant) -> AppResult<QueryResult> {
        let mut clean_sql = sql.trim();
        while clean_sql.starts_with("--") || clean_sql.starts_with("/*") {
            if clean_sql.starts_with("--") {
                if let Some(newline_pos) = clean_sql.find('\n') {
                    clean_sql = clean_sql[newline_pos..].trim();
                } else {
                    clean_sql = "";
                    break;
                }
            } else if clean_sql.starts_with("/*") {
                if let Some(end_pos) = clean_sql.find("*/") {
                    clean_sql = clean_sql[end_pos + 2..].trim();
                } else {
                    break;
                }
            }
        }

        let sql_upper = clean_sql.to_uppercase();
        let is_select = sql_upper.starts_with("SELECT") || sql_upper.starts_with("WITH") || sql_upper.starts_with("PRAGMA");

        if is_select {
            let rows = sqlx::query(sql)
                .fetch_all(pool)
                .await
                .map_err(|e| AppError::QueryError(format!("Query execution failed: {}", e)))?;

            if rows.is_empty() {
                return Ok(QueryResult {
                    columns: vec![],
                    rows: vec![],
                    affected_rows: None,
                    execution_time_ms: start.elapsed().as_millis() as u64,
                });
            }

            let columns: Vec<ColumnInfo> = rows[0]
                .columns()
                .iter()
                .map(|col| ColumnInfo {
                    name: col.name().to_string(),
                    data_type: col.type_info().name().to_string(),
                    nullable: true,
                    is_primary_key: false,
                })
                .collect();

            let json_rows: Vec<Vec<serde_json::Value>> = rows
                .iter()
                .map(|row| {
                    (0..columns.len())
                        .map(|i| {
                            if let Ok(val) = row.try_get::<String, _>(i) {
                                serde_json::Value::String(val)
                            } else if let Ok(val) = row.try_get::<i64, _>(i) {
                                serde_json::Value::Number(val.into())
                            } else if let Ok(val) = row.try_get::<i32, _>(i) {
                                serde_json::Value::Number(val.into())
                            } else if let Ok(val) = row.try_get::<f64, _>(i) {
                                serde_json::Value::Number(serde_json::Number::from_f64(val).unwrap_or(0.into()))
                            } else if let Ok(val) = row.try_get::<bool, _>(i) {
                                serde_json::Value::Bool(val)
                            } else if let Ok(val) = row.try_get::<chrono::NaiveDateTime, _>(i) {
                                serde_json::Value::String(val.to_string())
                            } else if let Ok(val) = row.try_get::<chrono::DateTime<chrono::Utc>, _>(i) {
                                serde_json::Value::String(val.to_rfc3339())
                            } else {
                                serde_json::Value::String("Unsupported type".to_string())
                            }
                        })
                        .collect()
                })
                .collect();

            Ok(QueryResult {
                columns,
                rows: json_rows,
                affected_rows: None,
                execution_time_ms: start.elapsed().as_millis() as u64,
            })
        } else {
            let result = sqlx::query(sql)
                .execute(pool)
                .await
                .map_err(|e| AppError::QueryError(format!("Query execution failed: {}", e)))?;

            Ok(QueryResult {
                columns: vec![],
                rows: vec![],
                affected_rows: Some(result.rows_affected()),
                execution_time_ms: start.elapsed().as_millis() as u64,
            })
        }
    }

    /// Execute a single SQL statement within a transaction
    async fn execute_single_query_tx<'c>(
        tx: &mut sqlx::Transaction<'c, sqlx::Sqlite>,
        sql: &str,
        start: Instant,
    ) -> AppResult<QueryResult> {
        let mut clean_sql = sql.trim();
        while clean_sql.starts_with("--") || clean_sql.starts_with("/*") {
            if clean_sql.starts_with("--") {
                if let Some(newline_pos) = clean_sql.find('\n') {
                    clean_sql = clean_sql[newline_pos..].trim();
                } else {
                    clean_sql = "";
                    break;
                }
            } else if clean_sql.starts_with("/*") {
                if let Some(end_pos) = clean_sql.find("*/") {
                    clean_sql = clean_sql[end_pos + 2..].trim();
                } else {
                    break;
                }
            }
        }

        let sql_upper = clean_sql.to_uppercase();
        let is_select = sql_upper.starts_with("SELECT") || sql_upper.starts_with("WITH") || sql_upper.starts_with("PRAGMA");

        if is_select {
            let rows = sqlx::query(sql)
                .fetch_all(&mut **tx)
                .await
                .map_err(|e| AppError::QueryError(format!("Query execution failed: {}", e)))?;

            if rows.is_empty() {
                return Ok(QueryResult {
                    columns: vec![],
                    rows: vec![],
                    affected_rows: None,
                    execution_time_ms: start.elapsed().as_millis() as u64,
                });
            }

            let columns: Vec<ColumnInfo> = rows[0]
                .columns()
                .iter()
                .map(|col| ColumnInfo {
                    name: col.name().to_string(),
                    data_type: col.type_info().name().to_string(),
                    nullable: true,
                    is_primary_key: false,
                })
                .collect();

            let json_rows: Vec<Vec<serde_json::Value>> = rows
                .iter()
                .map(|row| {
                    (0..columns.len())
                        .map(|i| {
                            if let Ok(val) = row.try_get::<String, _>(i) {
                                serde_json::Value::String(val)
                            } else if let Ok(val) = row.try_get::<i64, _>(i) {
                                serde_json::Value::Number(val.into())
                            } else if let Ok(val) = row.try_get::<i32, _>(i) {
                                serde_json::Value::Number(val.into())
                            } else if let Ok(val) = row.try_get::<f64, _>(i) {
                                serde_json::Value::Number(serde_json::Number::from_f64(val).unwrap_or(0.into()))
                            } else if let Ok(val) = row.try_get::<bool, _>(i) {
                                serde_json::Value::Bool(val)
                            } else if let Ok(val) = row.try_get::<chrono::NaiveDateTime, _>(i) {
                                serde_json::Value::String(val.to_string())
                            } else if let Ok(val) = row.try_get::<chrono::DateTime<chrono::Utc>, _>(i) {
                                serde_json::Value::String(val.to_rfc3339())
                            } else {
                                serde_json::Value::String("Unsupported type".to_string())
                            }
                        })
                        .collect()
                })
                .collect();

            Ok(QueryResult {
                columns,
                rows: json_rows,
                affected_rows: None,
                execution_time_ms: start.elapsed().as_millis() as u64,
            })
        } else {
            let result = sqlx::query(sql)
                .execute(&mut **tx)
                .await
                .map_err(|e| AppError::QueryError(format!("Query execution failed: {}", e)))?;

            Ok(QueryResult {
                columns: vec![],
                rows: vec![],
                affected_rows: Some(result.rows_affected()),
                execution_time_ms: start.elapsed().as_millis() as u64,
            })
        }
    }

    /// Parse SQLite EXPLAIN QUERY PLAN output into a PlanNode tree
    /// SQLite returns flat rows with: id, parent, notused, detail
    fn parse_sqlite_explain_rows(rows: &[(i32, i32, i32, String)]) -> AppResult<PlanNode> {
        if rows.is_empty() {
            return Ok(PlanNode {
                node_type: "Empty Plan".to_string(),
                relation_name: None,
                alias: None,
                startup_cost: None,
                total_cost: None,
                plan_rows: None,
                plan_width: None,
                actual_startup_time: None,
                actual_total_time: None,
                actual_rows: None,
                actual_loops: None,
                index_name: None,
                index_cond: None,
                filter: None,
                rows_removed_by_filter: None,
                sort_key: None,
                sort_method: None,
                join_type: None,
                hash_cond: None,
                buffers_shared_hit: None,
                buffers_shared_read: None,
                children: Vec::new(),
                warnings: Vec::new(),
                extra_info: HashMap::new(),
            });
        }

        // Build a map of id -> node info
        let mut nodes: HashMap<i32, (String, Vec<i32>)> = HashMap::new();
        let mut children_map: HashMap<i32, Vec<i32>> = HashMap::new();

        for (id, parent, _, detail) in rows {
            nodes.insert(*id, (detail.clone(), Vec::new()));
            children_map.entry(*parent).or_insert_with(Vec::new).push(*id);
        }

        // Find root nodes (parent = 0 or parent not in nodes)
        let root_ids: Vec<i32> = rows
            .iter()
            .filter(|(_, parent, _, _)| *parent == 0 || !nodes.contains_key(parent))
            .map(|(id, _, _, _)| *id)
            .collect();

        // Recursive helper to build node tree
        fn build_node(id: i32, nodes: &HashMap<i32, (String, Vec<i32>)>, children_map: &HashMap<i32, Vec<i32>>) -> PlanNode {
            let (detail, _) = nodes.get(&id).cloned().unwrap_or_default();
            let child_ids = children_map.get(&id).cloned().unwrap_or_default();

            let children: Vec<PlanNode> = child_ids
                .iter()
                .map(|cid| build_node(*cid, nodes, children_map))
                .collect();

            // Parse SQLite detail string to extract node type and table info (inline)
            let (node_type, relation_name, index_name, warnings) = parse_sqlite_detail_inline(&detail);

            PlanNode {
                node_type,
                relation_name,
                alias: None,
                startup_cost: None,
                total_cost: None,
                plan_rows: None,
                plan_width: None,
                actual_startup_time: None,
                actual_total_time: None,
                actual_rows: None,
                actual_loops: None,
                index_name,
                index_cond: None,
                filter: None,
                rows_removed_by_filter: None,
                sort_key: None,
                sort_method: None,
                join_type: None,
                hash_cond: None,
                buffers_shared_hit: None,
                buffers_shared_read: None,
                children,
                warnings,
                extra_info: HashMap::new(),
            }
        }

        // If single root, return it; otherwise wrap in a parent node
        if root_ids.len() == 1 {
            Ok(build_node(root_ids[0], &nodes, &children_map))
        } else {
            let children: Vec<PlanNode> = root_ids
                .iter()
                .map(|id| build_node(*id, &nodes, &children_map))
                .collect();

            Ok(PlanNode {
                node_type: "Query Plan".to_string(),
                relation_name: None,
                alias: None,
                startup_cost: None,
                total_cost: None,
                plan_rows: None,
                plan_width: None,
                actual_startup_time: None,
                actual_total_time: None,
                actual_rows: None,
                actual_loops: None,
                index_name: None,
                index_cond: None,
                filter: None,
                rows_removed_by_filter: None,
                sort_key: None,
                sort_method: None,
                join_type: None,
                hash_cond: None,
                buffers_shared_hit: None,
                buffers_shared_read: None,
                children,
                warnings: Vec::new(),
                extra_info: HashMap::new(),
            })
        }
    }

    /// Analyze SQLite plan and collect warnings
    fn analyze_sqlite_warnings(plan: &PlanNode) -> Vec<ExplainWarning> {
        let mut warnings = Vec::new();
        Self::collect_sqlite_warnings_recursive(plan, &mut warnings);
        warnings
    }

    fn collect_sqlite_warnings_recursive(node: &PlanNode, warnings: &mut Vec<ExplainWarning>) {
        if node.node_type == "Table Scan" {
            warnings.push(ExplainWarning {
                severity: WarningSeverity::Warning,
                message: format!(
                    "Full table scan on '{}'",
                    node.relation_name.as_deref().unwrap_or("unknown")
                ),
                node_type: Some(node.node_type.clone()),
                suggestion: Some("Consider adding an index on frequently queried columns".to_string()),
            });
        }

        if node.node_type == "Temp B-Tree Sort" {
            warnings.push(ExplainWarning {
                severity: WarningSeverity::Info,
                message: "Using temporary B-tree for sorting".to_string(),
                node_type: Some(node.node_type.clone()),
                suggestion: Some("Consider adding an index to avoid sorting".to_string()),
            });
        }

        for child in &node.children {
            Self::collect_sqlite_warnings_recursive(child, warnings);
        }
    }
}

#[async_trait]
impl DatabaseDriver for SqliteDriver {
    async fn test_connection(&self, config: &ConnectionConfig) -> AppResult<TestConnectionResult> {
        let connection_string = self.build_connection_string(config);
        
        let pool = SqlitePool::connect(&connection_string).await
            .map_err(|e| AppError::ConnectionError(format!("SQLite connection failed: {}", e)))?;
        
        // Get SQLite version
        let version: String = sqlx::query_scalar("SELECT sqlite_version()")
            .fetch_one(&pool)
            .await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get version: {}", e)))?;
        
        pool.close().await;
        
        Ok(TestConnectionResult {
            success: true,
            message: format!("SQLite connection to {} successful", config.database),
            server_version: Some(format!("SQLite {}", version)),
        })
    }

    async fn execute_query(&self, pool: PoolRef<'_>, sql: &str) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::Sqlite(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for SQLite driver".to_string())),
        };

        let start = Instant::now();

        // Split SQL into individual statements
        let statements = Self::split_sql_statements(sql);

        // If there's only one statement, execute it directly
        if statements.len() == 1 {
            return Self::execute_single_query(pool, &statements[0], start).await;
        }

        // Execute multiple statements in a transaction
        let mut tx = pool.begin().await
            .map_err(|e| AppError::QueryError(format!("Failed to start transaction: {}", e)))?;

        let mut final_result = QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: None,
            execution_time_ms: 0,
        };

        for (i, stmt) in statements.iter().enumerate() {
            match Self::execute_single_query_tx(&mut tx, stmt, start).await {
                Ok(result) => {
                    // Keep the last statement's result (or any with rows)
                    if i == statements.len() - 1 || !result.rows.is_empty() {
                        final_result = result;
                    }
                }
                Err(e) => {
                    // Rollback on error
                    let _ = tx.rollback().await;
                    return Err(e);
                }
            }
        }

        // Commit transaction
        tx.commit().await
            .map_err(|e| AppError::QueryError(format!("Failed to commit transaction: {}", e)))?;

        final_result.execution_time_ms = start.elapsed().as_millis() as u64;
        Ok(final_result)
    }

    async fn get_tables(&self, pool: PoolRef<'_>, _config: &ConnectionConfig) -> AppResult<Vec<TableInfo>> {
        let pool = match pool {
            PoolRef::Sqlite(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for SQLite driver".to_string())),
        };

        let query = r#"
            SELECT name as table_name
            FROM sqlite_master
            WHERE type = 'table'
            AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        "#;
        
        let rows = sqlx::query(query)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get tables: {}", e)))?;
        
        let tables: Vec<TableInfo> = rows
            .iter()
            .map(|row| {
                let name: String = row.get("table_name");
                
                TableInfo {
                    name: name.clone(),
                    schema: None,
                    table_type: "table".to_string(),
                    row_count: None,
                }
            })
            .collect();
        
        Ok(tables)
    }

    async fn get_table_schema(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<TableSchema> {
        let pool = match pool {
            PoolRef::Sqlite(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for SQLite driver".to_string())),
        };
        // Use PRAGMA table_info to get column information
        let pragma_query = format!("PRAGMA table_info({})", table_name);
        
        let columns_rows = sqlx::query(&pragma_query)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get table info: {}", e)))?;
        
        let mut primary_keys = Vec::new();
        let columns: Vec<ColumnInfo> = columns_rows
            .iter()
            .map(|row| {
                let name: String = row.get("name");
                let notnull: i64 = row.get("notnull");
                let pk: i64 = row.get("pk");
                let data_type: String = row.get("type");
                
                if pk > 0 {
                    primary_keys.push(name.clone());
                }
                
                ColumnInfo {
                    name: name.clone(),
                    data_type,
                    nullable: notnull == 0,
                    is_primary_key: pk > 0,
                }
            })
            .collect();
        
        // Get foreign keys using PRAGMA
        let fk_query = format!("PRAGMA foreign_key_list({})", table_name);
        let fk_rows = sqlx::query(&fk_query)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get foreign keys: {}", e)))?;
        
        let foreign_keys: Vec<ForeignKeyInfo> = fk_rows
            .iter()
            .map(|row| ForeignKeyInfo {
                column: row.get("from"),
                references_table: row.get("table"),
                references_column: row.get("to"),
            })
            .collect();
        
        Ok(TableSchema {
            table_name: table_name.to_string(),
            columns,
            primary_keys,
            foreign_keys,
        })
    }

    async fn get_all_table_schemas(&self, pool: PoolRef<'_>, _config: &ConnectionConfig) -> AppResult<Vec<TableSchema>> {
        let pool = match pool {
            PoolRef::Sqlite(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for SQLite driver".to_string())),
        };

        // Get all table names first
        let tables_query = r#"
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
            AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        "#;

        let table_names_rows = sqlx::query(tables_query)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get table names: {}", e)))?;

        let table_names: Vec<String> = table_names_rows
            .iter()
            .map(|row| row.get::<String, _>("name"))
            .collect();

        // Build schemas for all tables
        let mut schemas = Vec::new();
        for table_name in table_names {
            let schema = self.get_table_schema(PoolRef::Sqlite(pool), &table_name).await?;
            schemas.push(schema);
        }

        Ok(schemas)
    }

    fn build_connection_string(&self, config: &ConnectionConfig) -> String {
        let path = config.file_path.as_deref()
            .unwrap_or_else(|| config.database.as_str());

        if path.starts_with("sqlite:") {
            path.to_string()
        } else {
            format!("sqlite:{}", path)
        }
    }

    async fn generate_table_ddl(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<String> {
        let pool = match pool {
            PoolRef::Sqlite(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for SQLite driver".to_string())),
        };

        // Handle database-qualified names
        let (db_prefix, actual_table_name) = if let Some(dot_pos) = table_name.rfind('.') {
            let (db, table) = table_name.split_at(dot_pos);
            (Some(db.to_string()), table.trim_start_matches('.').to_string())
        } else {
            (None, table_name.to_string())
        };

        let query = if let Some(db) = db_prefix {
            format!(
                "SELECT sql FROM \"{}\".sqlite_master WHERE type = 'table' AND name = ?",
                escape_sqlite_identifier(&db)
            )
        } else {
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?".to_string()
        };

        let ddl: Option<String> = sqlx::query_scalar(&query)
            .bind(actual_table_name)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get DDL: {}", e)))?;

        ddl.ok_or_else(|| AppError::QueryError(format!("Table '{}' not found", table_name)))
    }

    async fn rename_table(&self, pool: PoolRef<'_>, old_name: &str, new_name: &str) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::Sqlite(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for SQLite driver".to_string())),
        };

        let start = Instant::now();

        let sql = format!("ALTER TABLE {} RENAME TO {}", old_name, new_name);

        sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to rename table: {}", e)))?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: Some(0),
            execution_time_ms: start.elapsed().as_millis() as u64,
        })
    }

    async fn get_indexes(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<Vec<IndexInfo>> {
        let pool = match pool {
            PoolRef::Sqlite(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for SQLite driver".to_string())),
        };

        // Get index list
        let index_query = format!("PRAGMA index_list({})", table_name);
        let index_rows = sqlx::query(&index_query)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get indexes: {}", e)))?;

        let mut indexes = Vec::new();

        for row in &index_rows {
            let name: String = row.get("name");
            let is_unique: i64 = row.get("unique");
            let origin: String = row.try_get("origin").unwrap_or_else(|_| "c".to_string());

            // Get columns for this index
            let info_query = format!("PRAGMA index_info({})", name);
            let info_rows = sqlx::query(&info_query)
                .fetch_all(pool)
                .await
                .map_err(|e| AppError::QueryError(format!("Failed to get index info: {}", e)))?;

            let columns: Vec<String> = info_rows
                .iter()
                .map(|r| r.get("name"))
                .collect();

            indexes.push(IndexInfo {
                name,
                columns,
                is_unique: is_unique != 0,
                is_primary: origin == "pk",
            });
        }

        Ok(indexes)
    }

    async fn get_constraints(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<Vec<ConstraintInfo>> {
        let pool = match pool {
            PoolRef::Sqlite(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for SQLite driver".to_string())),
        };

        // Handle database-qualified names
        let (db_prefix, actual_table_name) = if let Some(dot_pos) = table_name.rfind('.') {
            let (db, table) = table_name.split_at(dot_pos);
            (Some(db.to_string()), table.trim_start_matches('.').to_string())
        } else {
            (None, table_name.to_string())
        };

        // SQLite doesn't have a direct way to query constraints, but we can parse them from the DDL
        let query = if let Some(db) = db_prefix {
            format!(
                "SELECT sql FROM \"{}\".sqlite_master WHERE type = 'table' AND name = ?",
                escape_sqlite_identifier(&db)
            )
        } else {
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?".to_string()
        };

        let ddl: Option<String> = sqlx::query_scalar(&query)
            .bind(actual_table_name)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get DDL for constraints: {}", e)))?;

        let mut constraints = Vec::new();

        if let Some(sql) = ddl {
            // Parse CHECK constraints from DDL
            let sql_upper = sql.to_uppercase();
            if sql_upper.contains("CHECK") {
                // Simple extraction of CHECK constraints
                let mut idx = 0;
                for part in sql.split("CHECK") {
                    if idx > 0 {
                        // Try to extract the constraint
                        if let Some(start) = part.find('(') {
                            let mut depth = 1;
                            let mut end = start + 1;
                            for (i, c) in part[start + 1..].chars().enumerate() {
                                match c {
                                    '(' => depth += 1,
                                    ')' => {
                                        depth -= 1;
                                        if depth == 0 {
                                            end = start + 1 + i + 1;
                                            break;
                                        }
                                    }
                                    _ => {}
                                }
                            }
                            let definition = format!("CHECK{}", &part[..end]);
                            constraints.push(ConstraintInfo {
                                name: format!("check_{}", idx),
                                constraint_type: "CHECK".to_string(),
                                definition,
                            });
                        }
                    }
                    idx += 1;
                }
            }

            // Parse UNIQUE constraints
            if sql_upper.contains("UNIQUE") {
                let mut idx = 0;
                for part in sql.split("UNIQUE") {
                    if idx > 0 && part.trim().starts_with('(') {
                        if let Some(end) = part.find(')') {
                            let definition = format!("UNIQUE{}", &part[..=end]);
                            constraints.push(ConstraintInfo {
                                name: format!("unique_{}", idx),
                                constraint_type: "UNIQUE".to_string(),
                                definition,
                            });
                        }
                    }
                    idx += 1;
                }
            }
        }

        Ok(constraints)
    }

    async fn get_table_properties(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<TableProperties> {
        let pool = match pool {
            PoolRef::Sqlite(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for SQLite driver".to_string())),
        };

        // Get columns using PRAGMA
        let pragma_query = format!("PRAGMA table_info({})", table_name);
        let columns_rows = sqlx::query(&pragma_query)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get table info: {}", e)))?;

        let mut primary_keys = Vec::new();
        let columns: Vec<ExtendedColumnInfo> = columns_rows
            .iter()
            .map(|row| {
                let name: String = row.get("name");
                let notnull: i64 = row.get("notnull");
                let pk: i64 = row.get("pk");
                let data_type: String = row.get("type");
                let default_value: Option<String> = row.try_get("dflt_value").ok();

                if pk > 0 {
                    primary_keys.push(name.clone());
                }

                ExtendedColumnInfo {
                    name,
                    data_type,
                    nullable: notnull == 0,
                    is_primary_key: pk > 0,
                    default_value,
                    comment: None, // SQLite doesn't support column comments
                }
            })
            .collect();

        // Get foreign keys
        let fk_query = format!("PRAGMA foreign_key_list({})", table_name);
        let fk_rows = sqlx::query(&fk_query)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get foreign keys: {}", e)))?;

        let foreign_keys: Vec<ForeignKeyInfo> = fk_rows
            .iter()
            .map(|row| ForeignKeyInfo {
                column: row.get("from"),
                references_table: row.get("table"),
                references_column: row.get("to"),
            })
            .collect();

        // Get indexes
        let indexes = self.get_indexes(PoolRef::Sqlite(pool), table_name).await?;

        // Get constraints
        let constraints = self.get_constraints(PoolRef::Sqlite(pool), table_name).await?;

        // Get row count
        let count_query = format!("SELECT COUNT(*) as count FROM {}", table_name);
        let row_count: Option<i64> = sqlx::query_scalar(&count_query)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();

        Ok(TableProperties {
            table_name: table_name.to_string(),
            schema: None,
            columns,
            primary_keys,
            foreign_keys,
            indexes,
            constraints,
            row_count,
            table_comment: None, // SQLite doesn't support table comments
        })
    }

    async fn get_table_relationships(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<Vec<TableRelationship>> {
        let pool = match pool {
            PoolRef::Sqlite(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for SQLite driver".to_string())),
        };

        let mut relationships = Vec::new();

        // Get outgoing relationships (this table's foreign keys)
        let fk_query = format!("PRAGMA foreign_key_list({})", table_name);
        let fk_rows = sqlx::query(&fk_query)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get foreign keys: {}", e)))?;

        for row in &fk_rows {
            let source_column: String = row.get("from");
            let target_table: String = row.get("table");
            let target_column: String = row.get("to");

            relationships.push(TableRelationship {
                source_table: table_name.to_string(),
                source_column,
                target_table,
                target_column,
                constraint_name: None,
            });
        }

        // Get incoming relationships (other tables referencing this one)
        // Get all tables
        let tables_query = "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'";
        let tables = sqlx::query(tables_query)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get tables: {}", e)))?;

        for table_row in &tables {
            let other_table: String = table_row.get("name");
            if other_table == table_name {
                continue;
            }

            let other_fk_query = format!("PRAGMA foreign_key_list({})", other_table);
            let other_fk_rows = sqlx::query(&other_fk_query)
                .fetch_all(pool)
                .await
                .unwrap_or_default();

            for fk_row in &other_fk_rows {
                let referenced_table: String = fk_row.get("table");
                if referenced_table == table_name {
                    let source_column: String = fk_row.get("from");
                    let target_column: String = fk_row.get("to");

                    relationships.push(TableRelationship {
                        source_table: other_table.clone(),
                        source_column,
                        target_table: table_name.to_string(),
                        target_column,
                        constraint_name: None,
                    });
                }
            }
        }

        Ok(relationships)
    }

    async fn preview_query(&self, pool: PoolRef<'_>, sql: &str) -> AppResult<PreviewResult> {
        let pool = match pool {
            PoolRef::Sqlite(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for SQLite driver".to_string())),
        };

        let start = Instant::now();
        let statements = Self::split_sql_statements(sql);

        if statements.is_empty() {
            return Ok(PreviewResult {
                statements: vec![],
                execution_time_ms: 0,
                success: true,
                error: None,
                warning: None,
            });
        }

        // Start transaction for preview
        let mut tx = pool.begin().await
            .map_err(|e| AppError::QueryError(format!("Failed to start preview transaction: {}", e)))?;

        let mut previews: Vec<StatementPreview> = Vec::new();

        for stmt in &statements {
            let stmt_type = Self::detect_statement_type(stmt);
            let table_name = Self::extract_table_name(stmt);

            match stmt_type {
                StatementType::Ddl => {
                    // For DDL, capture schema before and after
                    let schema_before = if let Some(ref name) = table_name {
                        Self::get_table_schema_in_tx(&mut tx, name).await.ok()
                    } else {
                        None
                    };

                    // Execute DDL
                    match sqlx::query(stmt).execute(&mut *tx).await {
                        Ok(_) => {
                            let schema_after = if let Some(ref name) = table_name {
                                Self::get_table_schema_in_tx(&mut tx, name).await.ok()
                            } else {
                                None
                            };

                            previews.push(StatementPreview {
                                statement_type: StatementType::Ddl,
                                sql: stmt.clone(),
                                schema_before,
                                schema_after,
                                affected_rows: None,
                                affected_columns: None,
                                row_count: 0,
                                table_name,
                            });
                        }
                        Err(e) => {
                            let _ = tx.rollback().await;
                            return Ok(PreviewResult {
                                statements: previews,
                                execution_time_ms: start.elapsed().as_millis() as u64,
                                success: false,
                                error: Some(format!("DDL execution failed: {}", e)),
                                warning: None,
                            });
                        }
                    }
                }
                StatementType::Dml => {
                    // For DML, execute and count affected rows
                    // SQLite 3.35+ supports RETURNING but we'll keep it simple
                    match sqlx::query(stmt).execute(&mut *tx).await {
                        Ok(result) => {
                            let row_count = result.rows_affected();

                            previews.push(StatementPreview {
                                statement_type: StatementType::Dml,
                                sql: stmt.clone(),
                                schema_before: None,
                                schema_after: None,
                                affected_rows: None,
                                affected_columns: None,
                                row_count,
                                table_name,
                            });
                        }
                        Err(e) => {
                            let _ = tx.rollback().await;
                            return Ok(PreviewResult {
                                statements: previews,
                                execution_time_ms: start.elapsed().as_millis() as u64,
                                success: false,
                                error: Some(format!("DML execution failed: {}", e)),
                                warning: None,
                            });
                        }
                    }
                }
                StatementType::Select => {
                    previews.push(StatementPreview {
                        statement_type: StatementType::Select,
                        sql: stmt.clone(),
                        schema_before: None,
                        schema_after: None,
                        affected_rows: None,
                        affected_columns: None,
                        row_count: 0,
                        table_name,
                    });
                }
                StatementType::Other => {
                    match sqlx::query(stmt).execute(&mut *tx).await {
                        Ok(_) => {
                            previews.push(StatementPreview {
                                statement_type: StatementType::Other,
                                sql: stmt.clone(),
                                schema_before: None,
                                schema_after: None,
                                affected_rows: None,
                                affected_columns: None,
                                row_count: 0,
                                table_name,
                            });
                        }
                        Err(e) => {
                            let _ = tx.rollback().await;
                            return Ok(PreviewResult {
                                statements: previews,
                                execution_time_ms: start.elapsed().as_millis() as u64,
                                success: false,
                                error: Some(format!("Statement execution failed: {}", e)),
                                warning: None,
                            });
                        }
                    }
                }
            }
        }

        // Always rollback - this is just a preview
        tx.rollback().await
            .map_err(|e| AppError::QueryError(format!("Failed to rollback preview transaction: {}", e)))?;

        Ok(PreviewResult {
            statements: previews,
            execution_time_ms: start.elapsed().as_millis() as u64,
            success: true,
            error: None,
            warning: None,
        })
    }

    async fn explain_query(&self, pool: PoolRef<'_>, sql: &str, _analyze: bool) -> AppResult<ExplainResult> {
        let pool = match pool {
            PoolRef::Sqlite(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for SQLite driver".to_string())),
        };

        // SQLite uses EXPLAIN QUERY PLAN (no ANALYZE mode like PostgreSQL)
        let explain_sql = format!("EXPLAIN QUERY PLAN {}", sql);

        // Execute EXPLAIN QUERY PLAN
        let rows = sqlx::query(&explain_sql)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("EXPLAIN QUERY PLAN failed: {}", e)))?;

        // SQLite returns: id, parent, notused, detail
        let parsed_rows: Vec<(i32, i32, i32, String)> = rows
            .iter()
            .map(|row| {
                let id: i32 = row.try_get(0).unwrap_or(0);
                let parent: i32 = row.try_get(1).unwrap_or(0);
                let notused: i32 = row.try_get(2).unwrap_or(0);
                let detail: String = row.try_get(3).unwrap_or_default();
                (id, parent, notused, detail)
            })
            .collect();

        // Build raw output for display
        let raw_output = parsed_rows
            .iter()
            .map(|(id, parent, _, detail)| format!("{} | {} | {}", id, parent, detail))
            .collect::<Vec<_>>()
            .join("\n");

        // Parse into tree structure
        let plan_node = Self::parse_sqlite_explain_rows(&parsed_rows)?;
        let warnings = Self::analyze_sqlite_warnings(&plan_node);

        Ok(ExplainResult {
            plan: plan_node,
            planning_time: None,   // SQLite doesn't provide timing
            execution_time: None,
            total_cost: 0.0,       // SQLite doesn't provide cost estimates
            warnings,
            raw_output,
            database_type: "sqlite".to_string(),
        })
    }

    fn generate_create_table_ddl(&self, table_def: &NewTableDefinition) -> AppResult<String> {
        let mut ddl = String::new();

        // SQLite uses double quotes for quoting
        let table_name = format!("\"{}\"", table_def.name);

        ddl.push_str(&format!("CREATE TABLE {} (\n", table_name));

        // Column definitions
        let mut column_defs = Vec::new();
        for col in &table_def.columns {
            let mut col_def = format!("    \"{}\"", col.name);

            // Handle auto-increment (INTEGER PRIMARY KEY is auto-increment in SQLite)
            if col.is_auto_increment && col.is_primary_key {
                col_def.push_str(" INTEGER PRIMARY KEY AUTOINCREMENT");
            } else {
                // Regular type
                col_def.push_str(&format!(" {}", col.data_type));

                // NOT NULL constraint
                if !col.nullable {
                    col_def.push_str(" NOT NULL");
                }

                // DEFAULT value
                if let Some(ref default) = col.default_value {
                    col_def.push_str(&format!(" DEFAULT {}", default));
                }

                // UNIQUE constraint (inline)
                if col.is_unique && !col.is_primary_key {
                    col_def.push_str(" UNIQUE");
                }
            }

            column_defs.push(col_def);
        }

        // Primary key constraint (for non-auto-increment or composite keys)
        let non_autoincrement_pk: Vec<&str> = table_def.primary_key_columns.iter()
            .filter(|pk| {
                let col = table_def.columns.iter().find(|c| &c.name == *pk);
                !col.map(|c| c.is_auto_increment).unwrap_or(false)
            })
            .map(|s| s.as_str())
            .collect();

        if !non_autoincrement_pk.is_empty() {
            let pk_cols: Vec<String> = non_autoincrement_pk.iter()
                .map(|c| format!("\"{}\"", c))
                .collect();
            column_defs.push(format!("    PRIMARY KEY ({})", pk_cols.join(", ")));
        }

        // Foreign key constraints
        for fk in &table_def.foreign_keys {
            let src_cols: Vec<String> = fk.columns.iter().map(|c| format!("\"{}\"", c)).collect();
            let ref_cols: Vec<String> = fk.references_columns.iter().map(|c| format!("\"{}\"", c)).collect();

            let mut fk_def = format!(
                "    FOREIGN KEY ({}) REFERENCES \"{}\" ({})",
                src_cols.join(", "),
                fk.references_table,
                ref_cols.join(", ")
            );

            if let Some(ref action) = fk.on_delete {
                fk_def.push_str(&format!(" ON DELETE {}", action.to_sql()));
            }
            if let Some(ref action) = fk.on_update {
                fk_def.push_str(&format!(" ON UPDATE {}", action.to_sql()));
            }

            column_defs.push(fk_def);
        }

        // Check constraints
        for check in &table_def.check_constraints {
            let check_def = if let Some(ref name) = check.name {
                format!("    CONSTRAINT \"{}\" CHECK ({})", name, check.expression)
            } else {
                format!("    CHECK ({})", check.expression)
            };
            column_defs.push(check_def);
        }

        ddl.push_str(&column_defs.join(",\n"));
        ddl.push_str("\n);\n");

        // Create indexes (separate statements in SQLite)
        for idx in &table_def.indexes {
            let idx_cols: Vec<String> = idx.columns.iter().map(|c| format!("\"{}\"", c)).collect();
            let unique_str = if idx.is_unique { "UNIQUE " } else { "" };
            let idx_name = idx.name.clone().unwrap_or_else(|| {
                format!("idx_{}_{}", table_def.name, idx.columns.join("_"))
            });
            ddl.push_str(&format!(
                "\nCREATE {}INDEX \"{}\" ON {} ({});",
                unique_str,
                idx_name,
                table_name,
                idx_cols.join(", ")
            ));
        }

        Ok(ddl)
    }

    async fn get_referenceable_tables(&self, pool: PoolRef<'_>) -> AppResult<Vec<TableReferenceInfo>> {
        let pool = match pool {
            PoolRef::Sqlite(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for SQLite driver".to_string())),
        };

        // Get all tables from sqlite_master
        let tables_query = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
        let table_rows = sqlx::query(tables_query)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get tables: {}", e)))?;

        let mut result = Vec::new();

        for table_row in table_rows {
            let table_name: String = table_row.get("name");

            // Get primary key columns using PRAGMA
            let pragma_query = format!("PRAGMA table_info(\"{}\")", table_name);
            let col_rows = sqlx::query(&pragma_query)
                .fetch_all(pool)
                .await
                .map_err(|e| AppError::QueryError(format!("Failed to get table info: {}", e)))?;

            let mut pk_columns = Vec::new();
            for col_row in col_rows {
                let pk: i32 = col_row.get("pk");
                if pk > 0 {
                    let name: String = col_row.get("name");
                    let data_type: String = col_row.get("type");
                    let notnull: i32 = col_row.get("notnull");

                    pk_columns.push(ColumnInfo {
                        name,
                        data_type,
                        nullable: notnull == 0,
                        is_primary_key: true,
                    });
                }
            }

            result.push(TableReferenceInfo {
                table_name,
                schema: None, // SQLite doesn't have schemas in the same way
                primary_key_columns: pk_columns,
            });
        }

        Ok(result)
    }
}

