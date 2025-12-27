use crate::db::{DatabaseDriver, PoolRef};
use crate::error::{AppError, AppResult};
use crate::models::{
    ConnectionConfig, ConstraintInfo, ExtendedColumnInfo, ForeignKeyInfo, IndexInfo,
    QueryResult, TableInfo, TableProperties, TableRelationship, TableSchema,
    TestConnectionResult, ColumnInfo
};
use async_trait::async_trait;
use sqlx::{postgres::PgPool, Row, Column, ValueRef};
use std::collections::HashMap;
use std::time::Instant;

pub struct PostgresDriver;

/// Base64 encode binary data
fn base64_encode(data: &[u8]) -> String {
    use base64::{Engine as _, engine::general_purpose};
    general_purpose::STANDARD.encode(data)
}

/// Helper methods for PostgresDriver
impl PostgresDriver {
    /// Convert a PostgreSQL row value at a given index to a JSON value
    /// Handles all PostgreSQL data types comprehensively
    fn pg_value_to_json(row: &sqlx::postgres::PgRow, idx: usize) -> serde_json::Value {
        use sqlx::postgres::types::{PgInterval, PgMoney};

        // Check for NULL first
        if let Ok(raw) = row.try_get_raw(idx) {
            if raw.is_null() {
                return serde_json::Value::Null;
            }
        }

        // Try each type in order of likelihood
        // String types (most common, try first)
        if let Ok(val) = row.try_get::<String, _>(idx) {
            return serde_json::Value::String(val);
        }

        // UUID (very common in PostgreSQL)
        if let Ok(val) = row.try_get::<uuid::Uuid, _>(idx) {
            return serde_json::Value::String(val.to_string());
        }

        // Integer types
        if let Ok(val) = row.try_get::<i64, _>(idx) {
            return serde_json::Value::Number(val.into());
        }
        if let Ok(val) = row.try_get::<i32, _>(idx) {
            return serde_json::Value::Number(val.into());
        }
        if let Ok(val) = row.try_get::<i16, _>(idx) {
            return serde_json::Value::Number(val.into());
        }

        // Floating point
        if let Ok(val) = row.try_get::<f64, _>(idx) {
            return serde_json::Value::Number(
                serde_json::Number::from_f64(val).unwrap_or(0.into())
            );
        }
        if let Ok(val) = row.try_get::<f32, _>(idx) {
            return serde_json::Value::Number(
                serde_json::Number::from_f64(val as f64).unwrap_or(0.into())
            );
        }

        // Decimal types (NUMERIC, DECIMAL)
        if let Ok(val) = row.try_get::<sqlx::types::Decimal, _>(idx) {
            return serde_json::Value::String(val.to_string());
        }

        // Money type (MONEY)
        if let Ok(val) = row.try_get::<PgMoney, _>(idx) {
            // PgMoney stores value in cents/pennies as i64
            // Convert to decimal representation
            let dollars = val.0 as f64 / 100.0;
            return serde_json::Value::String(format!("${:.2}", dollars));
        }

        // Boolean
        if let Ok(val) = row.try_get::<bool, _>(idx) {
            return serde_json::Value::Bool(val);
        }

        // Date/Time types - chrono
        if let Ok(val) = row.try_get::<chrono::NaiveDateTime, _>(idx) {
            return serde_json::Value::String(val.to_string());
        }
        if let Ok(val) = row.try_get::<chrono::DateTime<chrono::Utc>, _>(idx) {
            return serde_json::Value::String(val.to_rfc3339());
        }
        if let Ok(val) = row.try_get::<chrono::NaiveDate, _>(idx) {
            return serde_json::Value::String(val.to_string());
        }
        if let Ok(val) = row.try_get::<chrono::NaiveTime, _>(idx) {
            return serde_json::Value::String(val.to_string());
        }

        // Date/Time types - time crate (alternative representations)
        if let Ok(val) = row.try_get::<sqlx::types::time::Date, _>(idx) {
            return serde_json::Value::String(val.to_string());
        }
        if let Ok(val) = row.try_get::<sqlx::types::time::Time, _>(idx) {
            return serde_json::Value::String(val.to_string());
        }
        if let Ok(val) = row.try_get::<sqlx::types::time::PrimitiveDateTime, _>(idx) {
            return serde_json::Value::String(val.to_string());
        }
        if let Ok(val) = row.try_get::<sqlx::types::time::OffsetDateTime, _>(idx) {
            return serde_json::Value::String(val.to_string());
        }

        // Interval type
        if let Ok(val) = row.try_get::<PgInterval, _>(idx) {
            return serde_json::Value::String(format!(
                "{} months {} days {} microseconds",
                val.months, val.days, val.microseconds
            ));
        }

        // Network types
        if let Ok(val) = row.try_get::<sqlx::types::ipnetwork::IpNetwork, _>(idx) {
            return serde_json::Value::String(val.to_string());
        }
        if let Ok(val) = row.try_get::<std::net::IpAddr, _>(idx) {
            return serde_json::Value::String(val.to_string());
        }
        if let Ok(val) = row.try_get::<sqlx::types::mac_address::MacAddress, _>(idx) {
            return serde_json::Value::String(val.to_string());
        }

        // Bit types
        if let Ok(val) = row.try_get::<sqlx::types::BitVec, _>(idx) {
            return serde_json::Value::String(format!("{:?}", val));
        }

        // Binary data (BYTEA) - encode as base64
        if let Ok(val) = row.try_get::<Vec<u8>, _>(idx) {
            return serde_json::Value::String(base64_encode(&val));
        }

        // JSON/JSONB
        if let Ok(val) = row.try_get::<serde_json::Value, _>(idx) {
            return val;
        }

        // Array types - try common array types
        if let Ok(val) = row.try_get::<Vec<String>, _>(idx) {
            return serde_json::Value::Array(
                val.into_iter().map(serde_json::Value::String).collect()
            );
        }
        if let Ok(val) = row.try_get::<Vec<i32>, _>(idx) {
            return serde_json::Value::Array(
                val.into_iter().map(|v| serde_json::Value::Number(v.into())).collect()
            );
        }
        if let Ok(val) = row.try_get::<Vec<i64>, _>(idx) {
            return serde_json::Value::Array(
                val.into_iter().map(|v| serde_json::Value::Number(v.into())).collect()
            );
        }
        if let Ok(val) = row.try_get::<Vec<f64>, _>(idx) {
            return serde_json::Value::Array(
                val.into_iter()
                    .map(|v| serde_json::Value::Number(
                        serde_json::Number::from_f64(v).unwrap_or(0.into())
                    ))
                    .collect()
            );
        }
        if let Ok(val) = row.try_get::<Vec<bool>, _>(idx) {
            return serde_json::Value::Array(
                val.into_iter().map(serde_json::Value::Bool).collect()
            );
        }
        if let Ok(val) = row.try_get::<Vec<uuid::Uuid>, _>(idx) {
            return serde_json::Value::Array(
                val.into_iter().map(|v| serde_json::Value::String(v.to_string())).collect()
            );
        }

        // Generic fallback: use the raw value and convert to string
        // This handles enums, composite types, tsquery, tsvector, and any other custom types
        match row.try_get_raw(idx) {
            Ok(raw) => {
                if raw.is_null() {
                    serde_json::Value::Null
                } else {
                    let bytes = raw.as_bytes().unwrap_or(&[]);

                    // Try to decode as UTF-8
                    if let Ok(s) = std::str::from_utf8(bytes) {
                        // Check if it's printable and doesn't contain null bytes
                        if s.chars().all(|c| !c.is_control() || c.is_whitespace()) {
                            return serde_json::Value::String(s.to_string());
                        }
                    }

                    // For binary data or data with control characters,
                    // encode as base64 with a prefix to indicate it's encoded
                    serde_json::Value::String(format!("[base64: {}]", base64_encode(bytes)))
                }
            }
            Err(_) => serde_json::Value::String("[Unable to decode value]".to_string())
        }
    }

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
                    // Handle PostgreSQL escaped quotes ('') inside string literals
                    if in_single_quote && chars.peek() == Some(&'\'') {
                        // It's an escaped quote, consume both and treat as a literal
                        current.push(c);
                        current.push(chars.next().unwrap());
                        // Stay in single quote mode
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
                _ => {
                    // Skip characters in comments
                }
            }
        }

        let trimmed = current.trim().to_string();
        if !trimmed.is_empty() {
            statements.push(trimmed);
        }

        statements
    }

    /// Execute a single SQL statement
    async fn execute_single_query(&self, pool_ref: PoolRef<'_>, sql: &str, start: Instant) -> AppResult<QueryResult> {
        let pool = match pool_ref {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        // Check if it's a SELECT query, handling comments
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
        let is_select = sql_upper.starts_with("SELECT") || sql_upper.starts_with("WITH");

        if is_select {
            // Execute as query and fetch results
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

            // Get column names from first row
            let columns: Vec<ColumnInfo> = rows[0]
                .columns()
                .iter()
                .map(|col| ColumnInfo {
                    name: col.name().to_string(),
                    data_type: "unknown".to_string(), // Will be filled from schema if needed
                    nullable: true,
                    is_primary_key: false,
                })
                .collect();

            // Convert rows to JSON values
            let json_rows: Vec<Vec<serde_json::Value>> = rows
                .iter()
                .map(|row| {
                    (0..columns.len())
                        .map(|i| Self::pg_value_to_json(row, i))
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
            // Execute as execute (INSERT, UPDATE, DELETE, CREATE, DROP, etc.)
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
}

#[async_trait]
impl DatabaseDriver for PostgresDriver {
    async fn test_connection(&self, config: &ConnectionConfig) -> AppResult<TestConnectionResult> {
        let connection_string = self.build_connection_string(config);
        
        let pool = PgPool::connect(&connection_string).await
            .map_err(|e| AppError::ConnectionError(format!("PostgreSQL connection failed: {}", e)))?;
        
        // Get server version
        let version: String = sqlx::query_scalar("SELECT version()")
            .fetch_one(&pool)
            .await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get version: {}", e)))?;
        
        pool.close().await;
        
        Ok(TestConnectionResult {
            success: true,
            message: format!("PostgreSQL connection to {} successful", config.database),
            server_version: Some(version),
        })
    }

    async fn execute_query(&self, pool: PoolRef<'_>, sql: &str) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let start = Instant::now();

        // Split SQL into individual statements
        let statements = Self::split_sql_statements(sql);

        // If there's only one statement, execute it directly (original behavior)
        if statements.len() == 1 {
            return self.execute_single_query(PoolRef::Postgres(pool), &statements[0], start).await;
        }

        // Execute multiple statements in a transaction
        // Start transaction
        let mut tx = pool.begin().await
            .map_err(|e| AppError::QueryError(format!("Failed to start transaction: {}", e)))?;

        let execution_result: AppResult<QueryResult> = async {
            let mut final_result = QueryResult {
                columns: vec![],
                rows: vec![],
                affected_rows: None,
                execution_time_ms: 0,
            };

            for (i, stmt) in statements.iter().enumerate() {
                let stmt_start = Instant::now();

                // Execute the statement directly on the transaction
                let clean_sql = stmt.trim();
                let mut check_sql = clean_sql;
                while check_sql.starts_with("--") || check_sql.starts_with("/*") {
                    if check_sql.starts_with("--") {
                        if let Some(newline_pos) = check_sql.find('\n') {
                            check_sql = check_sql[newline_pos..].trim();
                        } else {
                            check_sql = "";
                            break;
                        }
                    } else if check_sql.starts_with("/*") {
                        if let Some(end_pos) = check_sql.find("*/") {
                            check_sql = check_sql[end_pos + 2..].trim();
                        } else {
                            break;
                        }
                    }
                }

                let sql_upper = check_sql.to_uppercase();
                let is_select = sql_upper.starts_with("SELECT") || sql_upper.starts_with("WITH");

                let result = if is_select {
                    // Execute SELECT and fetch results
                    let rows = sqlx::query(stmt)
                        .fetch_all(&mut *tx)
                        .await
                        .map_err(|e| AppError::QueryError(format!("Query execution failed: {}", e)))?;

                    if rows.is_empty() {
                        QueryResult {
                            columns: vec![],
                            rows: vec![],
                            affected_rows: None,
                            execution_time_ms: stmt_start.elapsed().as_millis() as u64,
                        }
                    } else {
                        // Get column names from first row
                        let columns: Vec<ColumnInfo> = rows[0]
                            .columns()
                            .iter()
                            .map(|col| ColumnInfo {
                                name: col.name().to_string(),
                                data_type: "unknown".to_string(),
                                nullable: true,
                                is_primary_key: false,
                            })
                            .collect();

                        // Convert rows to JSON values
                        let json_rows: Vec<Vec<serde_json::Value>> = rows
                            .iter()
                            .map(|row| {
                                (0..columns.len())
                                    .map(|idx| Self::pg_value_to_json(row, idx))
                                    .collect()
                            })
                            .collect();

                        QueryResult {
                            columns,
                            rows: json_rows,
                            affected_rows: None,
                            execution_time_ms: stmt_start.elapsed().as_millis() as u64,
                        }
                    }
                } else {
                    // Execute INSERT, UPDATE, DELETE, CREATE, DROP, etc.
                    let execute_result = sqlx::query(stmt)
                        .execute(&mut *tx)
                        .await
                        .map_err(|e| AppError::QueryError(format!("Query execution failed: {}", e)))?;

                    QueryResult {
                        columns: vec![],
                        rows: vec![],
                        affected_rows: Some(execute_result.rows_affected()),
                        execution_time_ms: stmt_start.elapsed().as_millis() as u64,
                    }
                };

                // Keep track of total affected rows and the last query result
                if let Some(affected) = result.affected_rows {
                    if let Some(total) = final_result.affected_rows {
                        final_result.affected_rows = Some(total + affected);
                    } else {
                        final_result.affected_rows = Some(affected);
                    }
                }

                // Use the last SELECT query's results as the final result
                if result.rows.len() > 0 {
                    // Save accumulated affected_rows before replacing result
                    let accumulated_affected = final_result.affected_rows;
                    final_result = result;
                    // Restore accumulated affected_rows
                    final_result.affected_rows = accumulated_affected;
                } else if i == statements.len() - 1 && final_result.rows.is_empty() {
                    // If no SELECT queries, use the last result
                    final_result = result;
                }
            }
            Ok(final_result)
        }.await;

        // Commit or rollback based on execution result
        match execution_result {
            Ok(mut result) => {
                tx.commit().await
                    .map_err(|e| AppError::QueryError(format!("Failed to commit transaction: {}", e)))?;
                result.execution_time_ms = start.elapsed().as_millis() as u64;
                Ok(result)
            }
            Err(e) => {
                tx.rollback().await
                    .map_err(|rollback_err| {
                        AppError::QueryError(format!(
                            "Query failed: {}. Transaction rollback also failed: {}",
                            e,
                            rollback_err
                        ))
                    })?;
                Err(e)
            }
        }
    }

    async fn get_tables(&self, pool: PoolRef<'_>, _config: &ConnectionConfig) -> AppResult<Vec<TableInfo>> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let query = r#"
            SELECT 
                table_name::text as table_name,
                table_schema::text as table_schema,
                'BASE TABLE'::text as table_type
            FROM information_schema.tables
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            AND table_type = 'BASE TABLE'
            ORDER BY table_schema, table_name
        "#;
        
        let rows = sqlx::query(query)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get tables: {}", e)))?;
        
        let tables: Vec<TableInfo> = rows
            .iter()
            .map(|row| {
                let schema: Option<String> = row.try_get("table_schema").ok();
                let name: String = row.get("table_name");
                let full_name = if let Some(schema) = &schema {
                    format!("{}.{}", schema, name)
                } else {
                    name.clone()
                };
                
                TableInfo {
                    name: full_name,
                    schema,
                    table_type: "BASE TABLE".to_string(),
                    row_count: None, // Could be added with COUNT query if needed
                }
            })
            .collect();
        
        Ok(tables)
    }

    async fn get_table_schema(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<TableSchema> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };
        // Parse schema.table format
        let (schema, table) = if let Some(dot_pos) = table_name.find('.') {
            let (s, t) = table_name.split_at(dot_pos);
            (Some(s.to_string()), t.trim_start_matches('.').to_string())
        } else {
            (None, table_name.to_string())
        };
        
        // Get columns
        let columns_query = r#"
            SELECT 
                column_name::text as column_name,
                data_type::text as data_type,
                is_nullable::text as is_nullable,
                column_default::text as column_default
            FROM information_schema.columns
            WHERE table_schema = COALESCE($1, current_schema())
            AND table_name = $2
            ORDER BY ordinal_position
        "#;
        
        let columns_rows = sqlx::query(columns_query)
            .bind(&schema)
            .bind(&table)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get columns: {}", e)))?;
        
        // Get primary keys
        let pk_query = r#"
            SELECT column_name::text as column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema = COALESCE($1, current_schema())
            AND tc.table_name = $2
        "#;
        
        let pk_rows = sqlx::query(pk_query)
            .bind(&schema)
            .bind(&table)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get primary keys: {}", e)))?;
        
        let primary_keys: Vec<String> = pk_rows
            .iter()
            .map(|row| row.get::<String, _>("column_name"))
            .collect();
        
        // Get foreign keys
        let fk_query = r#"
            SELECT
                kcu.column_name::text as column_name,
                ccu.table_name::text AS foreign_table_name,
                ccu.column_name::text AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = COALESCE($1, current_schema())
            AND tc.table_name = $2
        "#;
        
        let fk_rows = sqlx::query(fk_query)
            .bind(&schema)
            .bind(&table)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get foreign keys: {}", e)))?;
        
        let foreign_keys: Vec<ForeignKeyInfo> = fk_rows
            .iter()
            .map(|row| ForeignKeyInfo {
                column: row.get("column_name"),
                references_table: row.get("foreign_table_name"),
                references_column: row.get("foreign_column_name"),
            })
            .collect();
        
        let columns: Vec<ColumnInfo> = columns_rows
            .iter()
            .map(|row| {
                let col_name: String = row.get("column_name");
                ColumnInfo {
                    name: col_name.clone(),
                    data_type: row.get("data_type"),
                    nullable: row.get::<String, _>("is_nullable") == "YES",
                    is_primary_key: primary_keys.contains(&col_name),
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
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        // Get all columns for all tables in one query
        let all_columns_query = r#"
            SELECT 
                table_schema::text as table_schema,
                table_name::text as table_name,
                column_name::text as column_name,
                data_type::text as data_type,
                is_nullable::text as is_nullable
            FROM information_schema.columns
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_schema, table_name, ordinal_position
        "#;

        let all_columns = sqlx::query(all_columns_query)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get all columns: {}", e)))?;

        // Get all primary keys in one query
        let all_pks_query = r#"
            SELECT 
                tc.table_schema::text as table_schema,
                tc.table_name::text as table_name,
                kcu.column_name::text as column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY tc.table_schema, tc.table_name
        "#;

        let all_pks = sqlx::query(all_pks_query)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get all primary keys: {}", e)))?;

        // Get all foreign keys in one query
        let all_fks_query = r#"
            SELECT
                tc.table_schema::text as table_schema,
                tc.table_name::text as table_name,
                kcu.column_name::text as column_name,
                ccu.table_name::text AS foreign_table_name,
                ccu.column_name::text AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY tc.table_schema, tc.table_name
        "#;

        let all_fks = sqlx::query(all_fks_query)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get all foreign keys: {}", e)))?;

        // Build a map of table_key -> list of column info
        let mut table_columns: HashMap<String, Vec<ColumnInfo>> = HashMap::new();
        let mut table_pks: HashMap<String, Vec<String>> = HashMap::new();
        let mut table_fks: HashMap<String, Vec<ForeignKeyInfo>> = HashMap::new();

        // Process columns
        for row in all_columns {
            let schema_name: String = row.get("table_schema");
            let table_name: String = row.get("table_name");
            let table_key = format!("{}.{}", schema_name, table_name);

            let column_info = ColumnInfo {
                name: row.get("column_name"),
                data_type: row.get("data_type"),
                nullable: row.get::<String, _>("is_nullable") == "YES",
                is_primary_key: false, // Will be updated below
            };

            table_columns.entry(table_key.clone()).or_default().push(column_info);
        }

        // Process primary keys
        for row in all_pks {
            let schema_name: String = row.get("table_schema");
            let table_name: String = row.get("table_name");
            let table_key = format!("{}.{}", schema_name, table_name);
            let column_name: String = row.get("column_name");

            table_pks.entry(table_key.clone()).or_default().push(column_name);
        }

        // Process foreign keys
        for row in all_fks {
            let schema_name: String = row.get("table_schema");
            let table_name: String = row.get("table_name");
            let table_key = format!("{}.{}", schema_name, table_name);

            let fk_info = ForeignKeyInfo {
                column: row.get("column_name"),
                references_table: row.get("foreign_table_name"),
                references_column: row.get("foreign_column_name"),
            };

            table_fks.entry(table_key.clone()).or_default().push(fk_info);
        }

        // Build TableSchema for each table
        let mut schemas = Vec::new();
        for (table_key, mut columns) in table_columns {
            let pks = table_pks.get(&table_key).cloned().unwrap_or_default();
            let fks = table_fks.get(&table_key).cloned().unwrap_or_default();

            // Mark primary keys in columns
            for column in &mut columns {
                column.is_primary_key = pks.contains(&column.name);
            }

            schemas.push(TableSchema {
                table_name: table_key,
                columns,
                primary_keys: pks,
                foreign_keys: fks,
            });
        }

        Ok(schemas)
    }

    fn build_connection_string(&self, config: &ConnectionConfig) -> String {
        let host = config.host.as_deref().unwrap_or("localhost");
        let port = config.port.unwrap_or(5432);
        let username = config.username.as_deref().unwrap_or("postgres");
        let password = config.password.as_deref().unwrap_or("");

        let mut url = format!("postgresql://{}:{}@{}:{}/{}",
            username, password, host, port, config.database);

        if let Some(ssl_mode) = &config.ssl_mode {
            url.push_str(&format!("?sslmode={}", ssl_mode));
        }

        url
    }

    async fn generate_table_ddl(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<String> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        // Parse schema.table format
        let (schema, table) = if let Some(dot_pos) = table_name.find('.') {
            let (s, t) = table_name.split_at(dot_pos);
            (Some(s.to_string()), t.trim_start_matches('.').to_string())
        } else {
            (None, table_name.to_string())
        };

        // Get columns with full details
        let columns_query = r#"
            SELECT
                column_name::text as column_name,
                data_type::text as data_type,
                character_maximum_length::int as max_length,
                numeric_precision::int as numeric_precision,
                numeric_scale::int as numeric_scale,
                is_nullable::text as is_nullable,
                column_default::text as column_default,
                udt_name::text as udt_name
            FROM information_schema.columns
            WHERE table_schema = COALESCE($1, current_schema())
            AND table_name = $2
            ORDER BY ordinal_position
        "#;

        let columns = sqlx::query(columns_query)
            .bind(&schema)
            .bind(&table)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get columns for DDL: {}", e)))?;

        // Get primary key constraint
        let pk_query = r#"
            SELECT
                tc.constraint_name::text as constraint_name,
                array_agg(kcu.column_name::text ORDER BY kcu.ordinal_position)::text[] as columns
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema = COALESCE($1, current_schema())
            AND tc.table_name = $2
            GROUP BY tc.constraint_name
        "#;

        let pk_rows = sqlx::query(pk_query)
            .bind(&schema)
            .bind(&table)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get PK for DDL: {}", e)))?;

        // Get foreign keys with grouped columns
        let fk_query = r#"
            SELECT
                tc.constraint_name::text as constraint_name,
                array_agg(kcu.column_name::text ORDER BY kcu.ordinal_position)::text[] as source_columns,
                ccu.table_schema::text || '.' || ccu.table_name::text AS foreign_table,
                array_agg(ccu.column_name::text ORDER BY kcu.ordinal_position)::text[] AS foreign_columns
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = COALESCE($1, current_schema())
            AND tc.table_name = $2
            GROUP BY tc.constraint_name, ccu.table_schema, ccu.table_name
        "#;

        let fk_rows = sqlx::query(fk_query)
            .bind(&schema)
            .bind(&table)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get FK for DDL: {}", e)))?;

        // Build the DDL
        let schema_prefix = schema.as_ref().map(|s| format!("\"{}\".", s)).unwrap_or_default();
        let mut ddl = format!("CREATE TABLE {}\"{}\" (\n", schema_prefix, table);

        // Add columns
        let column_defs: Vec<String> = columns.iter().map(|row| {
            let col_name: String = row.get("column_name");
            let data_type: String = row.get("data_type");
            let udt_name: String = row.get("udt_name");
            let max_length: Option<i32> = row.try_get("max_length").ok();
            let numeric_precision: Option<i32> = row.try_get("numeric_precision").ok();
            let numeric_scale: Option<i32> = row.try_get("numeric_scale").ok();
            let is_nullable: String = row.get("is_nullable");
            let column_default: Option<String> = row.try_get("column_default").ok();

            // Build type string
            let type_str = match data_type.as_str() {
                "character varying" => {
                    if let Some(len) = max_length {
                        format!("VARCHAR({})", len)
                    } else {
                        "VARCHAR".to_string()
                    }
                }
                "character" => {
                    if let Some(len) = max_length {
                        format!("CHAR({})", len)
                    } else {
                        "CHAR".to_string()
                    }
                }
                "numeric" => {
                    match (numeric_precision, numeric_scale) {
                        (Some(p), Some(s)) if s > 0 => format!("NUMERIC({},{})", p, s),
                        (Some(p), _) => format!("NUMERIC({})", p),
                        _ => "NUMERIC".to_string()
                    }
                }
                "ARRAY" => format!("{}[]", udt_name.trim_start_matches('_')),
                _ => data_type.to_uppercase()
            };

            let mut col_def = format!("    \"{}\" {}", col_name, type_str);

            if is_nullable == "NO" {
                col_def.push_str(" NOT NULL");
            }

            if let Some(default) = column_default {
                col_def.push_str(&format!(" DEFAULT {}", default));
            }

            col_def
        }).collect();

        ddl.push_str(&column_defs.join(",\n"));

        // Add primary key constraint
        if let Some(pk_row) = pk_rows.first() {
            let pk_columns: Vec<String> = pk_row.get("columns");
            let pk_cols_quoted: Vec<String> = pk_columns.iter().map(|c| format!("\"{}\"", c)).collect();
            ddl.push_str(&format!(",\n    PRIMARY KEY ({})", pk_cols_quoted.join(", ")));
        }

        // Add foreign key constraints
        for fk_row in &fk_rows {
            let constraint_name: String = fk_row.get("constraint_name");
            let source_columns: Vec<String> = fk_row.get("source_columns");
            let foreign_table: String = fk_row.get("foreign_table");
            let foreign_columns: Vec<String> = fk_row.get("foreign_columns");

            let src_cols_quoted: Vec<String> = source_columns.iter().map(|c| format!("\"{}\"", c)).collect();
            let target_cols_quoted: Vec<String> = foreign_columns.iter().map(|c| format!("\"{}\"", c)).collect();

            // Split foreign table into schema and table if possible
            let quoted_foreign_table = if let Some(dot_pos) = foreign_table.find('.') {
                let (s, t) = foreign_table.split_at(dot_pos);
                format!("\"{}\".\"{}\"", s, t.trim_start_matches('.'))
            } else {
                format!("\"{}\"", foreign_table)
            };

            ddl.push_str(&format!(
                ",\n    CONSTRAINT \"{}\" FOREIGN KEY ({}) REFERENCES {} ({})",
                constraint_name,
                src_cols_quoted.join(", "),
                quoted_foreign_table,
                target_cols_quoted.join(", ")
            ));
        }

        ddl.push_str("\n);");

        Ok(ddl)
    }

    async fn rename_table(&self, pool: PoolRef<'_>, old_name: &str, new_name: &str) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let start = Instant::now();

        // Parse schema.table format for old name
        let (schema, old_table) = if let Some(dot_pos) = old_name.find('.') {
            let (s, t) = old_name.split_at(dot_pos);
            (Some(s.to_string()), t.trim_start_matches('.').to_string())
        } else {
            (None, old_name.to_string())
        };

        // Build the rename SQL
        let sql = if let Some(s) = &schema {
            format!("ALTER TABLE {}.{} RENAME TO {}", s, old_table, new_name)
        } else {
            format!("ALTER TABLE {} RENAME TO {}", old_table, new_name)
        };

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
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        // Parse schema.table format
        let (schema, table) = if let Some(dot_pos) = table_name.find('.') {
            let (s, t) = table_name.split_at(dot_pos);
            (Some(s.to_string()), t.trim_start_matches('.').to_string())
        } else {
            (None, table_name.to_string())
        };

        let query = r#"
            SELECT
                i.relname::text as index_name,
                array_agg(a.attname::text ORDER BY k.n)::text[] as columns,
                ix.indisunique as is_unique,
                ix.indisprimary as is_primary
            FROM pg_index ix
            JOIN pg_class t ON t.oid = ix.indrelid
            JOIN pg_class i ON i.oid = ix.indexrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            CROSS JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(attnum, n)
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
            WHERE t.relname = $2
            AND n.nspname = COALESCE($1, current_schema())
            GROUP BY i.relname, ix.indisunique, ix.indisprimary
            ORDER BY i.relname
        "#;

        let rows = sqlx::query(query)
            .bind(&schema)
            .bind(&table)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get indexes: {}", e)))?;

        let indexes: Vec<IndexInfo> = rows.iter().map(|row| {
            IndexInfo {
                name: row.get("index_name"),
                columns: row.get("columns"),
                is_unique: row.get("is_unique"),
                is_primary: row.get("is_primary"),
            }
        }).collect();

        Ok(indexes)
    }

    async fn get_constraints(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<Vec<ConstraintInfo>> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        // Parse schema.table format
        let (schema, table) = if let Some(dot_pos) = table_name.find('.') {
            let (s, t) = table_name.split_at(dot_pos);
            (Some(s.to_string()), t.trim_start_matches('.').to_string())
        } else {
            (None, table_name.to_string())
        };

        let query = r#"
            SELECT
                con.conname::text as name,
                CASE con.contype
                    WHEN 'c' THEN 'CHECK'
                    WHEN 'u' THEN 'UNIQUE'
                    WHEN 'x' THEN 'EXCLUSION'
                END as constraint_type,
                pg_get_constraintdef(con.oid)::text as definition
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE rel.relname = $2
            AND nsp.nspname = COALESCE($1, current_schema())
            AND con.contype IN ('c', 'u', 'x')
            ORDER BY con.conname
        "#;

        let rows = sqlx::query(query)
            .bind(&schema)
            .bind(&table)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get constraints: {}", e)))?;

        let constraints: Vec<ConstraintInfo> = rows.iter().map(|row| {
            ConstraintInfo {
                name: row.get("name"),
                constraint_type: row.get("constraint_type"),
                definition: row.get("definition"),
            }
        }).collect();

        Ok(constraints)
    }

    async fn get_table_properties(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<TableProperties> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        // Parse schema.table format
        let (schema, table) = if let Some(dot_pos) = table_name.find('.') {
            let (s, t) = table_name.split_at(dot_pos);
            (Some(s.to_string()), t.trim_start_matches('.').to_string())
        } else {
            (None, table_name.to_string())
        };

        // Get extended columns info
        let columns_query = r#"
            SELECT
                c.column_name::text as column_name,
                c.data_type::text as data_type,
                c.is_nullable::text as is_nullable,
                c.column_default::text as column_default,
                pgd.description::text as comment
            FROM information_schema.columns c
            LEFT JOIN pg_catalog.pg_statio_all_tables st
                ON c.table_schema = st.schemaname AND c.table_name = st.relname
            LEFT JOIN pg_catalog.pg_description pgd
                ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
            WHERE c.table_schema = COALESCE($1, current_schema())
            AND c.table_name = $2
            ORDER BY c.ordinal_position
        "#;

        let columns_rows = sqlx::query(columns_query)
            .bind(&schema)
            .bind(&table)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get columns: {}", e)))?;

        // Get primary keys
        let pk_query = r#"
            SELECT column_name::text as column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema = COALESCE($1, current_schema())
            AND tc.table_name = $2
        "#;

        let pk_rows = sqlx::query(pk_query)
            .bind(&schema)
            .bind(&table)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get primary keys: {}", e)))?;

        let primary_keys: Vec<String> = pk_rows
            .iter()
            .map(|row| row.get::<String, _>("column_name"))
            .collect();

        // Get foreign keys
        let fk_query = r#"
            SELECT
                kcu.column_name::text as column_name,
                ccu.table_name::text AS foreign_table_name,
                ccu.column_name::text AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = COALESCE($1, current_schema())
            AND tc.table_name = $2
        "#;

        let fk_rows = sqlx::query(fk_query)
            .bind(&schema)
            .bind(&table)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get foreign keys: {}", e)))?;

        let foreign_keys: Vec<ForeignKeyInfo> = fk_rows.iter().map(|row| {
            ForeignKeyInfo {
                column: row.get("column_name"),
                references_table: row.get("foreign_table_name"),
                references_column: row.get("foreign_column_name"),
            }
        }).collect();

        // Get indexes
        let indexes = self.get_indexes(PoolRef::Postgres(pool), table_name).await?;

        // Get constraints
        let constraints = self.get_constraints(PoolRef::Postgres(pool), table_name).await?;

        // Get row count
        let count_query = format!(
            "SELECT COUNT(*)::bigint as count FROM {}{}",
            schema.as_ref().map(|s| format!("{}.", s)).unwrap_or_default(),
            table
        );

        let row_count: Option<i64> = sqlx::query_scalar(&count_query)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();

        // Get table comment
        let comment_query = r#"
            SELECT obj_description(
                (SELECT oid FROM pg_class WHERE relname = $2 AND relnamespace = (
                    SELECT oid FROM pg_namespace WHERE nspname = COALESCE($1, current_schema())
                ))
            )::text as comment
        "#;

        let table_comment: Option<String> = sqlx::query_scalar(comment_query)
            .bind(&schema)
            .bind(&table)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();

        // Build columns
        let columns: Vec<ExtendedColumnInfo> = columns_rows.iter().map(|row| {
            let col_name: String = row.get("column_name");
            ExtendedColumnInfo {
                name: col_name.clone(),
                data_type: row.get("data_type"),
                nullable: row.get::<String, _>("is_nullable") == "YES",
                is_primary_key: primary_keys.contains(&col_name),
                default_value: row.try_get("column_default").ok(),
                comment: row.try_get("comment").ok(),
            }
        }).collect();

        Ok(TableProperties {
            table_name: table_name.to_string(),
            schema,
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
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        // Parse schema.table format
        let (schema, table) = if let Some(dot_pos) = table_name.find('.') {
            let (s, t) = table_name.split_at(dot_pos);
            (Some(s.to_string()), t.trim_start_matches('.').to_string())
        } else {
            (None, table_name.to_string())
        };

        // Get outgoing relationships (this table references others)
        let outgoing_query = r#"
            SELECT
                tc.constraint_name::text as constraint_name,
                tc.table_schema::text || '.' || tc.table_name::text as source_table,
                kcu.column_name::text as source_column,
                ccu.table_schema::text || '.' || ccu.table_name::text AS target_table,
                ccu.column_name::text AS target_column
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = COALESCE($1, current_schema())
            AND tc.table_name = $2
        "#;

        let outgoing_rows = sqlx::query(outgoing_query)
            .bind(&schema)
            .bind(&table)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get outgoing relationships: {}", e)))?;

        // Get incoming relationships (other tables reference this table)
        let incoming_query = r#"
            SELECT
                tc.constraint_name::text as constraint_name,
                tc.table_schema::text || '.' || tc.table_name::text as source_table,
                kcu.column_name::text as source_column,
                ccu.table_schema::text || '.' || ccu.table_name::text AS target_table,
                ccu.column_name::text AS target_column
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND ccu.table_schema = COALESCE($1, current_schema())
            AND ccu.table_name = $2
        "#;

        let incoming_rows = sqlx::query(incoming_query)
            .bind(&schema)
            .bind(&table)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get incoming relationships: {}", e)))?;

        let mut relationships: Vec<TableRelationship> = Vec::new();

        for row in outgoing_rows.iter().chain(incoming_rows.iter()) {
            relationships.push(TableRelationship {
                source_table: row.get("source_table"),
                source_column: row.get("source_column"),
                target_table: row.get("target_table"),
                target_column: row.get("target_column"),
                constraint_name: row.try_get("constraint_name").ok(),
            });
        }

        Ok(relationships)
    }
}

