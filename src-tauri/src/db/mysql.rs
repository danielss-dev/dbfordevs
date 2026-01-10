use crate::db::common::{parse_cte_statement_type, CteParserConfig};
use crate::db::{DatabaseDriver, PoolRef};
use crate::error::{AppError, AppResult};
use crate::models::{
    ConnectionConfig, ConstraintInfo, ExplainResult, ExplainWarning, ExtendedColumnInfo,
    ForeignKeyInfo, IndexInfo, PlanNode, PreviewResult, QueryResult, StatementPreview,
    StatementType, TableInfo, TableProperties, TableRelationship, TableSchema,
    TestConnectionResult, ColumnInfo, WarningSeverity
};
use async_trait::async_trait;
use sqlx::{mysql::MySqlPool, Row, Column, TypeInfo};
use std::collections::HashMap;
use std::time::Instant;

fn decode_string(row: &sqlx::mysql::MySqlRow, column: &str) -> String {
    if let Ok(s) = row.try_get::<String, _>(column) {
        return s;
    }
    if let Ok(v) = row.try_get::<Vec<u8>, _>(column) {
        return String::from_utf8_lossy(&v).into_owned();
    }
    String::new()
}

fn decode_string_opt(row: &sqlx::mysql::MySqlRow, column: &str) -> Option<String> {
    if let Ok(s) = row.try_get::<String, _>(column) {
        return Some(s);
    }
    if let Ok(v) = row.try_get::<Vec<u8>, _>(column) {
        return Some(String::from_utf8_lossy(&v).into_owned());
    }
    None
}

pub struct MySqlDriver;

impl MySqlDriver {
    /// Safely split SQL into individual statements, handling quotes and comments
    fn split_sql_statements(sql: &str) -> Vec<String> {
        let mut statements = Vec::new();
        let mut current = String::new();
        let mut chars = sql.chars().peekable();
        let mut in_single_quote = false;
        let mut in_double_quote = false;
        let mut in_backtick = false;
        let mut in_line_comment = false;
        let mut in_block_comment = false;

        while let Some(c) = chars.next() {
            match c {
                '\'' if !in_double_quote && !in_backtick && !in_line_comment && !in_block_comment => {
                    if in_single_quote && chars.peek() == Some(&'\'') {
                        current.push(c);
                        current.push(chars.next().unwrap());
                    } else {
                        in_single_quote = !in_single_quote;
                        current.push(c);
                    }
                }
                '"' if !in_single_quote && !in_backtick && !in_line_comment && !in_block_comment => {
                    in_double_quote = !in_double_quote;
                    current.push(c);
                }
                '`' if !in_single_quote && !in_double_quote && !in_line_comment && !in_block_comment => {
                    in_backtick = !in_backtick;
                    current.push(c);
                }
                '-' if !in_single_quote && !in_double_quote && !in_backtick && !in_line_comment && !in_block_comment => {
                    if let Some(&'-') = chars.peek() {
                        chars.next();
                        in_line_comment = true;
                    } else {
                        current.push(c);
                    }
                }
                '#' if !in_single_quote && !in_double_quote && !in_backtick && !in_line_comment && !in_block_comment => {
                    in_line_comment = true;
                }
                '\n' if in_line_comment => {
                    in_line_comment = false;
                }
                '/' if !in_single_quote && !in_double_quote && !in_backtick && !in_line_comment && !in_block_comment => {
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
                ';' if !in_single_quote && !in_double_quote && !in_backtick && !in_line_comment && !in_block_comment => {
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
        while clean_sql.starts_with("--") || clean_sql.starts_with("/*") || clean_sql.starts_with('#') {
            if clean_sql.starts_with("--") || clean_sql.starts_with('#') {
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

        if clean_sql.starts_with("CREATE") 
            || clean_sql.starts_with("ALTER") 
            || clean_sql.starts_with("DROP") 
            || clean_sql.starts_with("TRUNCATE")
            || clean_sql.starts_with("RENAME")
        {
            StatementType::Ddl
        } else if clean_sql.starts_with("INSERT") 
            || clean_sql.starts_with("UPDATE") 
            || clean_sql.starts_with("DELETE")
            || clean_sql.starts_with("REPLACE")
        {
            StatementType::Dml
        } else if clean_sql.starts_with("WITH") {
            parse_cte_statement_type(&clean_sql, &CteParserConfig::mysql())
        } else if clean_sql.starts_with("SELECT") 
            || clean_sql.starts_with("SHOW") 
            || clean_sql.starts_with("DESCRIBE") 
            || clean_sql.starts_with("EXPLAIN")
        {
            StatementType::Select
        } else {
            StatementType::Other
        }
    }

    /// Extract table name from SQL statement
    fn extract_table_name(sql: &str) -> Option<String> {
        let sql_upper = sql.trim().to_uppercase();
        let sql_trimmed = sql.trim();

        // Handle CREATE [TEMPORARY] TABLE
        if sql_upper.starts_with("CREATE") {
            let rest = &sql_trimmed[6..].trim_start();
            let rest_upper = rest.to_uppercase();
            
            let after_create = if rest_upper.starts_with("TEMPORARY TABLE") {
                &rest[15..].trim_start()
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

        // Handle backtick quoted identifier (MySQL style)
        if s.starts_with('`') {
            let mut identifier = String::new();
            let mut end_byte = 1;
            let mut chars = s.char_indices().skip(1).peekable();
            let mut found_closing = false;

            while let Some((pos, c)) = chars.next() {
                if c == '`' {
                    if let Some((_, next_c)) = chars.peek() {
                        if *next_c == '`' {
                            identifier.push('`');
                            chars.next(); // consume second backtick
                            continue;
                        }
                    }
                    // This is the closing backtick
                    end_byte = pos + 1;
                    found_closing = true;
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

    /// Execute a single SQL statement
    async fn execute_single_query(pool: &MySqlPool, sql: &str, start: Instant) -> AppResult<QueryResult> {
        let mut clean_sql = sql.trim();
        while clean_sql.starts_with("--") || clean_sql.starts_with("/*") || clean_sql.starts_with('#') {
            if clean_sql.starts_with("--") || clean_sql.starts_with('#') {
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
        let is_select = sql_upper.starts_with("SELECT") || sql_upper.starts_with("WITH")
            || sql_upper.starts_with("SHOW") || sql_upper.starts_with("DESCRIBE");

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
                            } else if let Ok(val) = row.try_get::<Vec<u8>, _>(i) {
                                serde_json::Value::String(String::from_utf8_lossy(&val).into_owned())
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
        tx: &mut sqlx::Transaction<'c, sqlx::MySql>,
        sql: &str,
        start: Instant,
    ) -> AppResult<QueryResult> {
        let mut clean_sql = sql.trim();
        while clean_sql.starts_with("--") || clean_sql.starts_with("/*") || clean_sql.starts_with('#') {
            if clean_sql.starts_with("--") || clean_sql.starts_with('#') {
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
        let is_select = sql_upper.starts_with("SELECT") || sql_upper.starts_with("WITH")
            || sql_upper.starts_with("SHOW") || sql_upper.starts_with("DESCRIBE");

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
                            } else if let Ok(val) = row.try_get::<Vec<u8>, _>(i) {
                                serde_json::Value::String(String::from_utf8_lossy(&val).into_owned())
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

    /// Parse MySQL EXPLAIN JSON output into a PlanNode tree
    fn parse_mysql_plan_json(json: &serde_json::Value) -> AppResult<PlanNode> {
        // MySQL EXPLAIN FORMAT=JSON returns a "query_block" structure
        let query_block = &json["query_block"];
        Self::parse_mysql_query_block(query_block)
    }

    /// Parse a MySQL query_block into a PlanNode
    fn parse_mysql_query_block(block: &serde_json::Value) -> AppResult<PlanNode> {
        let mut children = Vec::new();
        let mut node_type = "Query Block".to_string();
        let relation_name = None;
        let mut total_cost = None;
        let plan_rows = None;

        // Check for nested_loop (JOIN operations)
        if let Some(nested_loop) = block.get("nested_loop").and_then(|v| v.as_array()) {
            node_type = "Nested Loop".to_string();
            for item in nested_loop {
                if let Some(table) = item.get("table") {
                    if let Ok(child) = Self::parse_mysql_table_node(table) {
                        children.push(child);
                    }
                }
            }
        }

        // Check for ordering_operation
        if let Some(ordering) = block.get("ordering_operation") {
            node_type = "Sort".to_string();
            if let Some(nested) = ordering.get("nested_loop").and_then(|v| v.as_array()) {
                for item in nested {
                    if let Some(table) = item.get("table") {
                        if let Ok(child) = Self::parse_mysql_table_node(table) {
                            children.push(child);
                        }
                    }
                }
            }
            if let Some(grouping) = ordering.get("grouping_operation") {
                if let Ok(child) = Self::parse_mysql_query_block(grouping) {
                    children.push(child);
                }
            }
        }

        // Check for single table access
        if let Some(table) = block.get("table") {
            return Self::parse_mysql_table_node(table);
        }

        // Extract cost info if available
        if let Some(cost) = block.get("cost_info") {
            total_cost = cost["query_cost"].as_str().and_then(|s| s.parse::<f64>().ok());
        }

        Ok(PlanNode {
            node_type,
            relation_name,
            alias: None,
            startup_cost: None,
            total_cost,
            plan_rows,
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

    /// Parse a MySQL table access node
    fn parse_mysql_table_node(table: &serde_json::Value) -> AppResult<PlanNode> {
        let table_name = table["table_name"].as_str().map(String::from);
        let access_type = table["access_type"].as_str().unwrap_or("unknown");

        // Map MySQL access types to node types
        let node_type = match access_type {
            "ALL" => "Full Table Scan",
            "index" => "Index Scan",
            "range" => "Index Range Scan",
            "ref" => "Index Lookup",
            "eq_ref" => "Unique Index Lookup",
            "const" => "Constant Lookup",
            "system" => "System Table",
            "fulltext" => "Fulltext Search",
            _ => access_type,
        }.to_string();

        let mut warnings = Vec::new();
        if access_type == "ALL" {
            if let Some(rows) = table["rows_examined_per_scan"].as_u64() {
                if rows > 10000 {
                    warnings.push(format!("Full table scan on large table (~{} rows)", rows));
                }
            }
        }

        // Extract cost info
        let total_cost = table.get("cost_info")
            .and_then(|c| c["read_cost"].as_str())
            .and_then(|s| s.parse::<f64>().ok());

        let plan_rows = table["rows_examined_per_scan"].as_u64()
            .or_else(|| table["rows_produced_per_join"].as_u64());

        Ok(PlanNode {
            node_type,
            relation_name: table_name,
            alias: table["table_name"].as_str().map(String::from),
            startup_cost: None,
            total_cost,
            plan_rows,
            plan_width: None,
            actual_startup_time: None,
            actual_total_time: None,
            actual_rows: None,
            actual_loops: None,
            index_name: table["key"].as_str().map(String::from),
            index_cond: table["used_key_parts"].as_array().map(|arr|
                arr.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>().join(", ")
            ),
            filter: table["attached_condition"].as_str().map(String::from),
            rows_removed_by_filter: table["filtered"].as_str()
                .and_then(|s| s.parse::<f64>().ok())
                .map(|pct| ((100.0 - pct) / 100.0 * plan_rows.unwrap_or(0) as f64) as u64),
            sort_key: None,
            sort_method: None,
            join_type: None,
            hash_cond: None,
            buffers_shared_hit: None,
            buffers_shared_read: None,
            children: Vec::new(),
            warnings,
            extra_info: HashMap::new(),
        })
    }

    /// Analyze MySQL plan and collect warnings
    fn analyze_mysql_warnings(plan: &PlanNode) -> Vec<ExplainWarning> {
        let mut warnings = Vec::new();
        Self::collect_mysql_warnings_recursive(plan, &mut warnings);
        warnings
    }

    fn collect_mysql_warnings_recursive(node: &PlanNode, warnings: &mut Vec<ExplainWarning>) {
        // Check for full table scans
        if node.node_type == "Full Table Scan" {
            if let Some(rows) = node.plan_rows {
                if rows > 10000 {
                    warnings.push(ExplainWarning {
                        severity: WarningSeverity::Warning,
                        message: format!(
                            "Full table scan on '{}' (~{} rows)",
                            node.relation_name.as_deref().unwrap_or("unknown"),
                            rows
                        ),
                        node_type: Some(node.node_type.clone()),
                        suggestion: Some("Consider adding an index on frequently filtered columns".to_string()),
                    });
                }
            }
        }

        for child in &node.children {
            Self::collect_mysql_warnings_recursive(child, warnings);
        }
    }
}

#[async_trait]
impl DatabaseDriver for MySqlDriver {
    async fn test_connection(&self, config: &ConnectionConfig) -> AppResult<TestConnectionResult> {
        let connection_string = self.build_connection_string(config);
        
        let pool = MySqlPool::connect(&connection_string).await
            .map_err(|e| AppError::ConnectionError(format!("MySQL connection failed: {}", e)))?;
        
        // Get server version
        let version: String = sqlx::query_scalar("SELECT VERSION()")
            .fetch_one(&pool)
            .await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get version: {}", e)))?;
        
        pool.close().await;
        
        Ok(TestConnectionResult {
            success: true,
            message: format!("MySQL connection to {} successful", config.database),
            server_version: Some(version),
        })
    }

    async fn execute_query(&self, pool: PoolRef<'_>, sql: &str) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::MySql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MySQL driver".to_string())),
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

    async fn get_tables(&self, pool: PoolRef<'_>, config: &ConnectionConfig) -> AppResult<Vec<TableInfo>> {
        let pool = match pool {
            PoolRef::MySql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MySQL driver".to_string())),
        };

        let schema_filter = if config.database.trim().is_empty() {
            "TABLE_SCHEMA NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')"
        } else {
            "TABLE_SCHEMA = DATABASE()"
        };

        let query = format!(r#"
            SELECT 
                TABLE_NAME as table_name,
                TABLE_SCHEMA as table_schema,
                TABLE_TYPE as table_type
            FROM information_schema.TABLES
            WHERE {}
            AND TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_SCHEMA, TABLE_NAME
        "#, schema_filter);
        
        let rows = sqlx::query(&query)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get tables: {}", e)))?;
        
        let tables: Vec<TableInfo> = rows
            .iter()
            .map(|row| {
                let schema = decode_string_opt(row, "table_schema");
                let name = decode_string(row, "table_name");
                
                TableInfo {
                    name,
                    schema,
                    table_type: "BASE TABLE".to_string(),
                    row_count: None,
                }
            })
            .collect();
        
        Ok(tables)
    }

    async fn get_table_schema(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<TableSchema> {
        let pool = match pool {
            PoolRef::MySql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MySQL driver".to_string())),
        };
        // Get columns
        let columns_query = r#"
            SELECT 
                COLUMN_NAME as column_name,
                DATA_TYPE as data_type,
                IS_NULLABLE as is_nullable,
                COLUMN_KEY as column_key
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
        "#;
        
        let columns_rows = sqlx::query(columns_query)
            .bind(table_name)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get columns: {}", e)))?;
        
        // Get primary keys
        let pk_query = r#"
            SELECT COLUMN_NAME as column_name
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            AND CONSTRAINT_NAME = 'PRIMARY'
        "#;
        
        let pk_rows = sqlx::query(pk_query)
            .bind(table_name)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get primary keys: {}", e)))?;
        
        let primary_keys: Vec<String> = pk_rows
            .iter()
            .map(|row| decode_string(row, "column_name"))
            .collect();
        
        // Get foreign keys
        let fk_query = r#"
            SELECT
                kcu.COLUMN_NAME as column_name,
                kcu.REFERENCED_TABLE_NAME as foreign_table_name,
                kcu.REFERENCED_COLUMN_NAME as foreign_column_name
            FROM information_schema.KEY_COLUMN_USAGE kcu
            WHERE kcu.TABLE_SCHEMA = DATABASE()
            AND kcu.TABLE_NAME = ?
            AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
        "#;
        
        let fk_rows = sqlx::query(fk_query)
            .bind(table_name)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get foreign keys: {}", e)))?;
        
        let foreign_keys: Vec<ForeignKeyInfo> = fk_rows
            .iter()
            .map(|row| ForeignKeyInfo {
                column: decode_string(row, "column_name"),
                references_table: decode_string(row, "foreign_table_name"),
                references_column: decode_string(row, "foreign_column_name"),
            })
            .collect();
        
        let columns: Vec<ColumnInfo> = columns_rows
            .iter()
            .map(|row| {
                let col_name = decode_string(row, "column_name");
                let column_key = decode_string(row, "column_key");
                ColumnInfo {
                    name: col_name,
                    data_type: decode_string(row, "data_type"),
                    nullable: decode_string(row, "is_nullable") == "YES",
                    is_primary_key: column_key == "PRI",
                }
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
            PoolRef::MySql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MySQL driver".to_string())),
        };

        // Get all columns for all tables in one query
        let all_columns_query = r#"
            SELECT
                TABLE_NAME as table_name,
                COLUMN_NAME as column_name,
                DATA_TYPE as data_type,
                IS_NULLABLE as is_nullable,
                COLUMN_KEY as column_key
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            ORDER BY TABLE_NAME, ORDINAL_POSITION
        "#;

        let all_columns = sqlx::query(all_columns_query)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get all columns: {}", e)))?;

        // Get all primary keys in one query
        let all_pks_query = r#"
            SELECT
                TABLE_NAME as table_name,
                COLUMN_NAME as column_name
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
            AND CONSTRAINT_NAME = 'PRIMARY'
            ORDER BY TABLE_NAME
        "#;

        let all_pks = sqlx::query(all_pks_query)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get all primary keys: {}", e)))?;

        // Get all foreign keys in one query
        let all_fks_query = r#"
            SELECT
                TABLE_NAME as table_name,
                COLUMN_NAME as column_name,
                REFERENCED_TABLE_NAME as foreign_table_name,
                REFERENCED_COLUMN_NAME as foreign_column_name
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
            AND REFERENCED_TABLE_NAME IS NOT NULL
            ORDER BY TABLE_NAME
        "#;

        let all_fks = sqlx::query(all_fks_query)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get all foreign keys: {}", e)))?;

        // Build a map of table_name -> list of column info
        let mut table_columns: HashMap<String, Vec<ColumnInfo>> = HashMap::new();
        let mut table_pks: HashMap<String, Vec<String>> = HashMap::new();
        let mut table_fks: HashMap<String, Vec<ForeignKeyInfo>> = HashMap::new();

        // Process columns
        for row in all_columns {
            let table_name = decode_string(&row, "table_name");

            let column_info = ColumnInfo {
                name: decode_string(&row, "column_name"),
                data_type: decode_string(&row, "data_type"),
                nullable: decode_string(&row, "is_nullable") == "YES",
                is_primary_key: false, // Will be updated below
            };

            table_columns.entry(table_name.clone()).or_default().push(column_info);
        }

        // Process primary keys
        for row in all_pks {
            let table_name = decode_string(&row, "table_name");
            let column_name = decode_string(&row, "column_name");

            table_pks.entry(table_name.clone()).or_default().push(column_name);
        }

        // Process foreign keys
        for row in all_fks {
            let table_name = decode_string(&row, "table_name");

            let fk_info = ForeignKeyInfo {
                column: decode_string(&row, "column_name"),
                references_table: decode_string(&row, "foreign_table_name"),
                references_column: decode_string(&row, "foreign_column_name"),
            };

            table_fks.entry(table_name.clone()).or_default().push(fk_info);
        }

        // Build TableSchema for each table
        let mut schemas = Vec::new();
        for (table_name, mut columns) in table_columns {
            let pks = table_pks.get(&table_name).cloned().unwrap_or_default();
            let fks = table_fks.get(&table_name).cloned().unwrap_or_default();

            // Mark primary keys in columns
            for column in &mut columns {
                column.is_primary_key = pks.contains(&column.name);
            }

            // For MySQL, use database name as schema prefix if needed
            // But keep it simple for now - just use table_name directly
            schemas.push(TableSchema {
                table_name: table_name.clone(),
                columns,
                primary_keys: pks,
                foreign_keys: fks,
            });
        }

        Ok(schemas)
    }

    fn build_connection_string(&self, config: &ConnectionConfig) -> String {
        let host = config.host.as_deref().unwrap_or("localhost");
        let port = config.port.unwrap_or(3306);
        let username = config.username.as_deref().unwrap_or("root");
        let password = config.password.as_deref().unwrap_or("");

        format!("mysql://{}:{}@{}:{}/{}",
            username, password, host, port, config.database)
    }

    async fn generate_table_ddl(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<String> {
        let pool = match pool {
            PoolRef::MySql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MySQL driver".to_string())),
        };

        // MySQL has SHOW CREATE TABLE which gives us the exact DDL
        let query = format!("SHOW CREATE TABLE {}", table_name);
        let row = sqlx::query(&query)
            .fetch_one(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get DDL: {}", e)))?;

        // The DDL is in the second column
        let ddl = row.try_get::<String, _>(1)
            .or_else(|_| row.try_get::<Vec<u8>, _>(1).map(|v| String::from_utf8_lossy(&v).into_owned()))
            .map_err(|e| AppError::QueryError(format!("Failed to extract DDL: {}", e)))?;

        Ok(ddl)
    }

    async fn rename_table(&self, pool: PoolRef<'_>, old_name: &str, new_name: &str) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::MySql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MySQL driver".to_string())),
        };

        let start = Instant::now();

        let sql = format!("RENAME TABLE {} TO {}", old_name, new_name);

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
            PoolRef::MySql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MySQL driver".to_string())),
        };

        let query = r#"
            SELECT
                INDEX_NAME as index_name,
                GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as columns,
                NOT NON_UNIQUE as is_unique,
                INDEX_NAME = 'PRIMARY' as is_primary
            FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            GROUP BY INDEX_NAME, NON_UNIQUE
            ORDER BY INDEX_NAME
        "#;

        let rows = sqlx::query(query)
            .bind(table_name)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get indexes: {}", e)))?;

        let indexes: Vec<IndexInfo> = rows.iter().map(|row| {
            let columns_str = decode_string(row, "columns");
            IndexInfo {
                name: decode_string(row, "index_name"),
                columns: columns_str.split(',').map(|s| s.to_string()).collect(),
                is_unique: row.get("is_unique"),
                is_primary: row.get("is_primary"),
            }
        }).collect();

        Ok(indexes)
    }

    async fn get_constraints(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<Vec<ConstraintInfo>> {
        let pool = match pool {
            PoolRef::MySql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MySQL driver".to_string())),
        };

        let query = r#"
            SELECT
                CONSTRAINT_NAME as name,
                CONSTRAINT_TYPE as constraint_type,
                '' as definition
            FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            AND CONSTRAINT_TYPE IN ('CHECK', 'UNIQUE')
        "#;

        let rows = sqlx::query(query)
            .bind(table_name)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get constraints: {}", e)))?;

        let constraints: Vec<ConstraintInfo> = rows.iter().map(|row| {
            ConstraintInfo {
                name: decode_string(row, "name"),
                constraint_type: decode_string(row, "constraint_type"),
                definition: decode_string(row, "definition"),
            }
        }).collect();

        Ok(constraints)
    }

    async fn get_table_properties(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<TableProperties> {
        let pool = match pool {
            PoolRef::MySql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MySQL driver".to_string())),
        };

        // Get columns with extended info
        let columns_query = r#"
            SELECT
                COLUMN_NAME as column_name,
                DATA_TYPE as data_type,
                IS_NULLABLE as is_nullable,
                COLUMN_DEFAULT as column_default,
                COLUMN_KEY as column_key,
                COLUMN_COMMENT as comment
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
        "#;

        let columns_rows = sqlx::query(columns_query)
            .bind(table_name)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get columns: {}", e)))?;

        // Get primary keys
        let pk_query = r#"
            SELECT COLUMN_NAME as column_name
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            AND CONSTRAINT_NAME = 'PRIMARY'
        "#;

        let pk_rows = sqlx::query(pk_query)
            .bind(table_name)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get primary keys: {}", e)))?;

        let primary_keys: Vec<String> = pk_rows
            .iter()
            .map(|row| decode_string(row, "column_name"))
            .collect();

        // Get foreign keys
        let fk_query = r#"
            SELECT
                kcu.COLUMN_NAME as column_name,
                kcu.REFERENCED_TABLE_NAME as foreign_table_name,
                kcu.REFERENCED_COLUMN_NAME as foreign_column_name
            FROM information_schema.KEY_COLUMN_USAGE kcu
            WHERE kcu.TABLE_SCHEMA = DATABASE()
            AND kcu.TABLE_NAME = ?
            AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
        "#;

        let fk_rows = sqlx::query(fk_query)
            .bind(table_name)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get foreign keys: {}", e)))?;

        let foreign_keys: Vec<ForeignKeyInfo> = fk_rows.iter().map(|row| {
            ForeignKeyInfo {
                column: decode_string(row, "column_name"),
                references_table: decode_string(row, "foreign_table_name"),
                references_column: decode_string(row, "foreign_column_name"),
            }
        }).collect();

        // Get indexes
        let indexes = self.get_indexes(PoolRef::MySql(pool), table_name).await?;

        // Get constraints
        let constraints = self.get_constraints(PoolRef::MySql(pool), table_name).await?;

        // Get row count
        let count_query = format!("SELECT COUNT(*) as count FROM {}", table_name);
        let row_count: Option<i64> = sqlx::query_scalar(&count_query)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();

        // Get table comment
        let comment_query = r#"
            SELECT TABLE_COMMENT
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
        "#;

        let table_comment: Option<String> = sqlx::query_scalar(comment_query)
            .bind(table_name)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();

        // Build columns
        let columns: Vec<ExtendedColumnInfo> = columns_rows.iter().map(|row| {
            let col_name = decode_string(row, "column_name");
            let column_key = decode_string(row, "column_key");
            ExtendedColumnInfo {
                name: col_name,
                data_type: decode_string(row, "data_type"),
                nullable: decode_string(row, "is_nullable") == "YES",
                is_primary_key: column_key == "PRI",
                default_value: decode_string_opt(row, "column_default"),
                comment: decode_string_opt(row, "comment"),
            }
        }).collect();

        Ok(TableProperties {
            table_name: table_name.to_string(),
            schema: None,
            columns,
            primary_keys,
            foreign_keys,
            indexes,
            constraints,
            row_count,
            table_comment,
        })
    }

    async fn get_table_relationships(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<Vec<TableRelationship>> {
        let pool = match pool {
            PoolRef::MySql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MySQL driver".to_string())),
        };

        // Get outgoing relationships
        let outgoing_query = r#"
            SELECT
                kcu.CONSTRAINT_NAME as constraint_name,
                kcu.TABLE_NAME as source_table,
                kcu.COLUMN_NAME as source_column,
                kcu.REFERENCED_TABLE_NAME as target_table,
                kcu.REFERENCED_COLUMN_NAME as target_column
            FROM information_schema.KEY_COLUMN_USAGE kcu
            WHERE kcu.TABLE_SCHEMA = DATABASE()
            AND kcu.TABLE_NAME = ?
            AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
        "#;

        let outgoing_rows = sqlx::query(outgoing_query)
            .bind(table_name)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get outgoing relationships: {}", e)))?;

        // Get incoming relationships
        let incoming_query = r#"
            SELECT
                kcu.CONSTRAINT_NAME as constraint_name,
                kcu.TABLE_NAME as source_table,
                kcu.COLUMN_NAME as source_column,
                kcu.REFERENCED_TABLE_NAME as target_table,
                kcu.REFERENCED_COLUMN_NAME as target_column
            FROM information_schema.KEY_COLUMN_USAGE kcu
            WHERE kcu.TABLE_SCHEMA = DATABASE()
            AND kcu.REFERENCED_TABLE_NAME = ?
        "#;

        let incoming_rows = sqlx::query(incoming_query)
            .bind(table_name)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get incoming relationships: {}", e)))?;

        let mut relationships: Vec<TableRelationship> = Vec::new();

        for row in outgoing_rows.iter().chain(incoming_rows.iter()) {
            relationships.push(TableRelationship {
                source_table: decode_string(row, "source_table"),
                source_column: decode_string(row, "source_column"),
                target_table: decode_string(row, "target_table"),
                target_column: decode_string(row, "target_column"),
                constraint_name: decode_string_opt(row, "constraint_name"),
            });
        }

        Ok(relationships)
    }

    async fn preview_query(&self, pool: PoolRef<'_>, sql: &str) -> AppResult<PreviewResult> {
        let pool = match pool {
            PoolRef::MySql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MySQL driver".to_string())),
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
                    // MySQL DDL statements (CREATE, ALTER, DROP, RENAME, TRUNCATE) cause an implicit 
                    // commit in MySQL, which means they cannot be rolled back.
                    // To prevent permanent changes during a preview, we must refuse to execute them.
                    let _ = tx.rollback().await;
                    return Ok(PreviewResult {
                        statements: previews,
                        execution_time_ms: start.elapsed().as_millis() as u64,
                        success: true,
                        error: None,
                        warning: Some("MySQL does not support transactional DDL. Previewing CREATE, ALTER, DROP, RENAME, or TRUNCATE statements would permanently apply them to the database. Preview cancelled for safety.".to_string()),
                    });
                }
                StatementType::Dml => {
                    // For DML, execute and count affected rows
                    // MySQL doesn't have RETURNING, so we just execute and report count
                    match sqlx::query(stmt).execute(&mut *tx).await {
                        Ok(result) => {
                            let row_count = result.rows_affected();

                            previews.push(StatementPreview {
                                statement_type: StatementType::Dml,
                                sql: stmt.clone(),
                                schema_before: None,
                                schema_after: None,
                                affected_rows: None, // MySQL doesn't support RETURNING easily
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

    async fn explain_query(&self, pool: PoolRef<'_>, sql: &str, analyze: bool) -> AppResult<ExplainResult> {
        let pool = match pool {
            PoolRef::MySql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MySQL driver".to_string())),
        };

        // MySQL 8.0.18+ supports EXPLAIN ANALYZE, earlier versions don't
        // Try EXPLAIN ANALYZE first, fall back to regular EXPLAIN if it fails
        let explain_sql = if analyze {
            format!("EXPLAIN ANALYZE FORMAT=JSON {}", sql)
        } else {
            format!("EXPLAIN FORMAT=JSON {}", sql)
        };

        // Execute EXPLAIN query
        let result = sqlx::query(&explain_sql)
            .fetch_one(pool)
            .await;

        let row = match result {
            Ok(row) => row,
            Err(e) if analyze => {
                // If EXPLAIN ANALYZE fails, fall back to regular EXPLAIN
                let fallback_sql = format!("EXPLAIN FORMAT=JSON {}", sql);
                sqlx::query(&fallback_sql)
                    .fetch_one(pool)
                    .await
                    .map_err(|e2| AppError::QueryError(format!("EXPLAIN failed: {}", e2)))?
            }
            Err(e) => return Err(AppError::QueryError(format!("EXPLAIN failed: {}", e))),
        };

        // MySQL returns JSON in the "EXPLAIN" column
        let json_str: String = row.try_get(0)
            .map_err(|e| AppError::QueryError(format!("Failed to get EXPLAIN result: {}", e)))?;

        let json_plan: serde_json::Value = serde_json::from_str(&json_str)
            .map_err(|e| AppError::QueryError(format!("Failed to parse EXPLAIN JSON: {}", e)))?;

        // Parse the plan tree
        let plan_node = Self::parse_mysql_plan_json(&json_plan)?;
        let warnings = Self::analyze_mysql_warnings(&plan_node);

        // Extract cost from query_block
        let total_cost = json_plan["query_block"]["cost_info"]["query_cost"]
            .as_str()
            .and_then(|s| s.parse::<f64>().ok())
            .unwrap_or(plan_node.total_cost.unwrap_or(0.0));

        Ok(ExplainResult {
            plan: plan_node,
            planning_time: None,  // MySQL doesn't provide planning time
            execution_time: None, // Would need EXPLAIN ANALYZE for this
            total_cost,
            warnings,
            raw_output: serde_json::to_string_pretty(&json_plan).unwrap_or_default(),
            database_type: "mysql".to_string(),
        })
    }
}

