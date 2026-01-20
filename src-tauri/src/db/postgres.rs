use crate::db::{DatabaseDriver, PoolRef};
use crate::db::common::{parse_cte_statement_type, quote_identifier, quote_identifier_single, CteParserConfig};
use crate::error::{AppError, AppResult};
use crate::models::{
    AvailablePrivileges, ChangePasswordRequest, ConnectionConfig, ConstraintInfo,
    CreateIndexDefinition, CreateRoleRequest, CreateUserRequest, DatabasePermission, DatabaseRole,
    DatabaseType, DatabaseUser, ExplainResult, ExplainWarning, ExtendedColumnInfo, ForeignKeyInfo,
    FunctionInfo, IndexInfo, NewFunctionDefinition, NewProcedureDefinition, NewSequenceDefinition,
    NewTableDefinition, NewTriggerDefinition, NewViewDefinition, PermissionRequest, PlanNode,
    PreviewResult, ProcedureInfo, QueryResult, RoleMembershipRequest, SequenceInfo,
    StandaloneIndexInfo, StatementPreview, StatementType, TableInfo, TableProperties,
    TableReferenceInfo, TableRelationship, TableSchema, TestConnectionResult, ColumnInfo,
    TriggerInfo, ViewInfo, WarningSeverity,
};
use async_trait::async_trait;
use sqlx::{postgres::PgPool, Row, Column, ValueRef, TypeInfo};
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

    /// Detect the type of SQL statement
    fn detect_statement_type(sql: &str) -> StatementType {
        let mut clean_sql = sql.trim().to_uppercase();

        // Skip comments to find actual statement
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
            parse_cte_statement_type(&clean_sql, &CteParserConfig::postgres())
        } else if clean_sql.starts_with("SELECT") {
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
            let rest = if rest.to_uppercase().starts_with("IF EXISTS") {
                &rest[9..].trim_start()
            } else {
                rest
            };
            let rest = if rest.to_uppercase().starts_with("ONLY") {
                &rest[4..].trim_start()
            } else {
                rest
            };
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
            let rest = if rest.to_uppercase().starts_with("ONLY") {
                &rest[4..].trim_start()
            } else {
                rest
            };
            return Self::extract_identifier(rest);
        }

        // Handle DELETE FROM
        if sql_upper.starts_with("DELETE FROM") {
            let rest = &sql_trimmed[11..].trim_start();
            let rest = if rest.to_uppercase().starts_with("ONLY") {
                &rest[4..].trim_start()
            } else {
                rest
            };
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

        // Handle quoted identifier
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
                    // This is the closing quote
                    found_closing = true;
                    end_byte = pos + c.len_utf8();
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

    /// Generate table DDL within a transaction
    async fn generate_table_ddl_in_tx(
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        table_name: &str,
    ) -> AppResult<String> {
        // Parse schema.table format
        let (schema, table) = if let Some(dot_pos) = table_name.find('.') {
            let (s, t) = table_name.split_at(dot_pos);
            (Some(s.to_string()), t.trim_start_matches('.').to_string())
        } else {
            (None, table_name.to_string())
        };

        // Check if table exists
        let exists_query = r#"
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = COALESCE($1, current_schema())
                AND table_name = $2
            ) as exists
        "#;

        let exists: bool = sqlx::query_scalar(exists_query)
            .bind(&schema)
            .bind(&table)
            .fetch_one(&mut **tx)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to check table existence: {}", e)))?;

        if !exists {
            return Err(AppError::QueryError(format!("Table {} does not exist", table_name)));
        }

        // Get columns
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
            .fetch_all(&mut **tx)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get columns for DDL: {}", e)))?;

        if columns.is_empty() {
            return Ok(String::new()); // Table doesn't exist yet (e.g., CREATE TABLE preview)
        }

        // Get primary key
        let pk_query = r#"
            SELECT
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
            .fetch_all(&mut **tx)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get PK for DDL: {}", e)))?;

        // Build DDL
        let schema_prefix = schema.as_ref().map(|s| format!("\"{}\".", s)).unwrap_or_default();
        let mut ddl = format!("CREATE TABLE {}\"{}\" (\n", schema_prefix, table);

        let column_defs: Vec<String> = columns.iter().map(|row| {
            let col_name: String = row.get("column_name");
            let data_type: String = row.get("data_type");
            let udt_name: String = row.get("udt_name");
            let max_length: Option<i32> = row.try_get("max_length").ok();
            let numeric_precision: Option<i32> = row.try_get("numeric_precision").ok();
            let numeric_scale: Option<i32> = row.try_get("numeric_scale").ok();
            let is_nullable: String = row.get("is_nullable");
            let column_default: Option<String> = row.try_get("column_default").ok();

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

        // Add primary key
        if let Some(pk_row) = pk_rows.first() {
            let pk_columns: Vec<String> = pk_row.get("columns");
            let pk_cols_quoted: Vec<String> = pk_columns.iter().map(|c| format!("\"{}\"", c)).collect();
            ddl.push_str(&format!(",\n    PRIMARY KEY ({})", pk_cols_quoted.join(", ")));
        }

        ddl.push_str("\n);");

        Ok(ddl)
    }

    /// Preview a DML statement by executing with RETURNING
    async fn preview_dml_statement(
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        stmt: &str,
        table_name: &Option<String>,
    ) -> AppResult<StatementPreview> {
        let sql_upper = stmt.trim().to_uppercase();

        // Add RETURNING * if not already present
        let has_returning = sql_upper.contains(" RETURNING ");
        let sql_with_returning = if has_returning {
            stmt.to_string()
        } else {
            // Append RETURNING * on a new line to ensure it doesn't get commented out
            // by a trailing line comment in the original statement.
            format!("{}\nRETURNING *", stmt.trim().trim_end_matches(';'))
        };

        // Execute and fetch results
        let rows = sqlx::query(&sql_with_returning)
            .fetch_all(&mut **tx)
            .await
            .map_err(|e| AppError::QueryError(format!("DML execution failed: {}", e)))?;

        let row_count = rows.len() as u64;

        if rows.is_empty() {
            return Ok(StatementPreview {
                statement_type: StatementType::Dml,
                sql: stmt.to_string(),
                schema_before: None,
                schema_after: None,
                affected_rows: Some(vec![]),
                affected_columns: Some(vec![]),
                row_count: 0,
                table_name: table_name.clone(),
            });
        }

        // Get column info from first row
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

        // Convert rows to JSON, limiting to 100 rows for preview
        let max_preview_rows = 100;
        let json_rows: Vec<Vec<serde_json::Value>> = rows
            .iter()
            .take(max_preview_rows)
            .map(|row| {
                (0..columns.len())
                    .map(|i| Self::pg_value_to_json(row, i))
                    .collect()
            })
            .collect();

        Ok(StatementPreview {
            statement_type: StatementType::Dml,
            sql: stmt.to_string(),
            schema_before: None,
            schema_after: None,
            affected_rows: Some(json_rows),
            affected_columns: Some(columns),
            row_count,
            table_name: table_name.clone(),
        })
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

            // Get column names and types from first row
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

    /// Parse PostgreSQL EXPLAIN JSON output into a PlanNode tree
    fn parse_pg_plan_json(json: &serde_json::Value) -> AppResult<PlanNode> {
        let plan = &json[0]["Plan"];
        Self::parse_pg_plan_node(plan)
    }

    /// Recursively parse a single plan node from PostgreSQL EXPLAIN JSON
    fn parse_pg_plan_node(node: &serde_json::Value) -> AppResult<PlanNode> {
        let children: Vec<PlanNode> = node["Plans"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|n| Self::parse_pg_plan_node(n).ok()).collect())
            .unwrap_or_default();

        let mut warnings = Vec::new();
        let node_type = node["Node Type"].as_str().unwrap_or("Unknown").to_string();

        // Detect sequential scans on potentially large tables
        if node_type == "Seq Scan" {
            if let Some(rows) = node["Plan Rows"].as_u64() {
                if rows > 10000 {
                    warnings.push(format!("Sequential scan on large table (~{} rows)", rows));
                }
            }
        }

        // Build extra_info from any additional fields
        let mut extra_info = HashMap::new();
        if let Some(obj) = node.as_object() {
            for (key, value) in obj {
                // Skip fields we already handle explicitly
                if !["Node Type", "Relation Name", "Alias", "Startup Cost", "Total Cost",
                     "Plan Rows", "Plan Width", "Actual Startup Time", "Actual Total Time",
                     "Actual Rows", "Actual Loops", "Index Name", "Index Cond", "Filter",
                     "Rows Removed by Filter", "Sort Key", "Sort Method", "Join Type",
                     "Hash Cond", "Shared Hit Blocks", "Shared Read Blocks", "Plans"].contains(&key.as_str()) {
                    extra_info.insert(key.clone(), value.clone());
                }
            }
        }

        Ok(PlanNode {
            node_type,
            relation_name: node["Relation Name"].as_str().map(String::from),
            alias: node["Alias"].as_str().map(String::from),
            startup_cost: node["Startup Cost"].as_f64(),
            total_cost: node["Total Cost"].as_f64(),
            plan_rows: node["Plan Rows"].as_u64(),
            plan_width: node["Plan Width"].as_u64().map(|v| v as u32),
            actual_startup_time: node["Actual Startup Time"].as_f64(),
            actual_total_time: node["Actual Total Time"].as_f64(),
            actual_rows: node["Actual Rows"].as_u64(),
            actual_loops: node["Actual Loops"].as_u64(),
            index_name: node["Index Name"].as_str().map(String::from),
            index_cond: node["Index Cond"].as_str().map(String::from),
            filter: node["Filter"].as_str().map(String::from),
            rows_removed_by_filter: node["Rows Removed by Filter"].as_u64(),
            sort_key: node["Sort Key"].as_array().map(|arr|
                arr.iter().filter_map(|v| v.as_str().map(String::from)).collect()
            ),
            sort_method: node["Sort Method"].as_str().map(String::from),
            join_type: node["Join Type"].as_str().map(String::from),
            hash_cond: node["Hash Cond"].as_str().map(String::from),
            buffers_shared_hit: node["Shared Hit Blocks"].as_u64(),
            buffers_shared_read: node["Shared Read Blocks"].as_u64(),
            children,
            warnings,
            extra_info,
        })
    }

    /// Analyze a plan tree and collect warnings
    fn analyze_plan_warnings(plan: &PlanNode) -> Vec<ExplainWarning> {
        let mut warnings = Vec::new();
        Self::collect_warnings_recursive(plan, &mut warnings);
        warnings
    }

    /// Recursively collect warnings from plan nodes
    fn collect_warnings_recursive(node: &PlanNode, warnings: &mut Vec<ExplainWarning>) {
        // Check for sequential scans on large tables
        if node.node_type == "Seq Scan" {
            if let Some(rows) = node.plan_rows {
                if rows > 10000 {
                    warnings.push(ExplainWarning {
                        severity: WarningSeverity::Warning,
                        message: format!(
                            "Sequential scan on '{}' (~{} rows)",
                            node.relation_name.as_deref().unwrap_or("unknown"),
                            rows
                        ),
                        node_type: Some(node.node_type.clone()),
                        suggestion: Some("Consider adding an index on frequently filtered columns".to_string()),
                    });
                }
            }
        }

        // Check for row estimate vs actual mismatch (if ANALYZE data available)
        if let (Some(estimated), Some(actual)) = (node.plan_rows, node.actual_rows) {
            let ratio = if estimated > 0 {
                actual as f64 / estimated as f64
            } else {
                1.0
            };
            if ratio > 10.0 || ratio < 0.1 {
                warnings.push(ExplainWarning {
                    severity: WarningSeverity::Info,
                    message: format!(
                        "Row estimate mismatch: estimated {} vs actual {}",
                        estimated, actual
                    ),
                    node_type: Some(node.node_type.clone()),
                    suggestion: Some("Run ANALYZE on the table to update statistics".to_string()),
                });
            }
        }

        // Check for sorts spilling to disk
        if node.node_type == "Sort" {
            if let Some(method) = &node.sort_method {
                if method.contains("external") {
                    warnings.push(ExplainWarning {
                        severity: WarningSeverity::Warning,
                        message: "Sort operation spilled to disk".to_string(),
                        node_type: Some(node.node_type.clone()),
                        suggestion: Some("Consider increasing work_mem or adding an index".to_string()),
                    });
                }
            }
        }

        // Recursively check children
        for child in &node.children {
            Self::collect_warnings_recursive(child, warnings);
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
                        // Get column names and types from first row
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

        // Build SSL query parameters
        let mut params: Vec<String> = Vec::new();

        if let Some(ssl) = &config.ssl {
            let ssl_mode = match ssl.mode {
                crate::models::SslMode::Disable => "disable",
                crate::models::SslMode::Prefer => "prefer",
                crate::models::SslMode::Require => "require",
                crate::models::SslMode::VerifyCa => "verify-ca",
                crate::models::SslMode::VerifyFull => "verify-full",
            };
            params.push(format!("sslmode={}", ssl_mode));

            if let Some(ca_cert) = &ssl.ca_cert_path {
                if !ca_cert.is_empty() {
                    params.push(format!("sslrootcert={}", ca_cert));
                }
            }
            if let Some(client_cert) = &ssl.client_cert_path {
                if !client_cert.is_empty() {
                    params.push(format!("sslcert={}", client_cert));
                }
            }
            if let Some(client_key) = &ssl.client_key_path {
                if !client_key.is_empty() {
                    params.push(format!("sslkey={}", client_key));
                }
            }
        } else if let Some(ssl_mode) = &config.ssl_mode {
            // Legacy support for old ssl_mode field
            params.push(format!("sslmode={}", ssl_mode));
        }

        if !params.is_empty() {
            url.push('?');
            url.push_str(&params.join("&"));
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

    async fn preview_query(&self, pool: PoolRef<'_>, sql: &str) -> AppResult<PreviewResult> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
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
                    // Capture schema before
                    let schema_before = if let Some(ref name) = table_name {
                        Self::generate_table_ddl_in_tx(&mut tx, name).await.ok()
                    } else {
                        None
                    };

                    // Execute DDL
                    let result = sqlx::query(stmt)
                        .execute(&mut *tx)
                        .await;

                    match result {
                        Ok(_) => {
                            // Capture schema after
                            let schema_after = if let Some(ref name) = table_name {
                                Self::generate_table_ddl_in_tx(&mut tx, name).await.ok()
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
                            // Rollback and return error
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
                    // For DML, try to get affected rows using RETURNING
                    let preview = Self::preview_dml_statement(&mut tx, stmt, &table_name).await;

                    match preview {
                        Ok(p) => previews.push(p),
                        Err(e) => {
                            let _ = tx.rollback().await;
                            return Ok(PreviewResult {
                                statements: previews,
                                execution_time_ms: start.elapsed().as_millis() as u64,
                                success: false,
                                error: Some(format!("DML preview failed: {}", e)),
                                warning: None,
                            });
                        }
                    }
                }
                StatementType::Select => {
                    // SELECT queries don't need preview - skip them
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
                    // Execute other statements (GRANT, etc.)
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
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        // Build EXPLAIN query with JSON format for structured output
        let explain_sql = if analyze {
            format!("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {}", sql)
        } else {
            format!("EXPLAIN (FORMAT JSON) {}", sql)
        };

        // Execute EXPLAIN query
        let row = sqlx::query(&explain_sql)
            .fetch_one(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("EXPLAIN failed: {}", e)))?;

        // PostgreSQL returns JSON in first column - use serde_json::Value directly
        let json_plan: serde_json::Value = row.try_get(0)
            .map_err(|e| AppError::QueryError(format!("Failed to get EXPLAIN result: {}", e)))?;

        // Parse the plan tree
        let plan_node = Self::parse_pg_plan_json(&json_plan)?;
        let warnings = Self::analyze_plan_warnings(&plan_node);

        // Extract timing info if ANALYZE was used
        let planning_time = json_plan[0]["Planning Time"].as_f64();
        let execution_time = json_plan[0]["Execution Time"].as_f64();
        let total_cost = plan_node.total_cost.unwrap_or(0.0);

        Ok(ExplainResult {
            plan: plan_node,
            planning_time,
            execution_time,
            total_cost,
            warnings,
            raw_output: serde_json::to_string_pretty(&json_plan).unwrap_or_default(),
            database_type: "postgresql".to_string(),
        })
    }

    fn generate_create_table_ddl(&self, table_def: &NewTableDefinition) -> AppResult<String> {
        let mut ddl = String::new();
        let db_type = DatabaseType::PostgreSQL;

        // Build table name with optional schema - properly escape identifiers
        let table_name = if let Some(ref schema) = table_def.schema {
            format!(
                "{}.{}",
                quote_identifier_single(schema, &db_type),
                quote_identifier_single(&table_def.name, &db_type)
            )
        } else {
            quote_identifier_single(&table_def.name, &db_type)
        };

        ddl.push_str(&format!("CREATE TABLE {} (\n", table_name));

        // Column definitions
        let mut column_defs = Vec::new();
        for col in &table_def.columns {
            let mut col_def = format!("    {}", quote_identifier_single(&col.name, &db_type));

            // Handle auto-increment types (SERIAL, BIGSERIAL)
            if col.is_auto_increment {
                let type_upper = col.data_type.to_uppercase();
                if type_upper == "SERIAL" || type_upper == "BIGSERIAL" || type_upper == "SMALLSERIAL" {
                    col_def.push_str(&format!(" {}", type_upper));
                } else if type_upper == "INTEGER" || type_upper == "INT" {
                    col_def.push_str(" SERIAL");
                } else if type_upper == "BIGINT" {
                    col_def.push_str(" BIGSERIAL");
                } else if type_upper == "SMALLINT" {
                    col_def.push_str(" SMALLSERIAL");
                } else {
                    col_def.push_str(&format!(" {}", col.data_type));
                }
            } else {
                // Regular type with optional length/precision
                let type_str = if let Some(length) = col.length {
                    format!("{}({})", col.data_type, length)
                } else if let (Some(precision), Some(scale)) = (col.precision, col.scale) {
                    format!("{}({},{})", col.data_type, precision, scale)
                } else if let Some(precision) = col.precision {
                    format!("{}({})", col.data_type, precision)
                } else {
                    col.data_type.clone()
                };
                col_def.push_str(&format!(" {}", type_str));
            }

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

            column_defs.push(col_def);
        }

        // Primary key constraint
        if !table_def.primary_key_columns.is_empty() {
            let pk_cols: Vec<String> = table_def.primary_key_columns.iter()
                .map(|c| quote_identifier_single(c, &db_type))
                .collect();
            column_defs.push(format!("    PRIMARY KEY ({})", pk_cols.join(", ")));
        }

        // Foreign key constraints
        for fk in &table_def.foreign_keys {
            let src_cols: Vec<String> = fk.columns.iter().map(|c| quote_identifier_single(c, &db_type)).collect();
            let ref_cols: Vec<String> = fk.references_columns.iter().map(|c| quote_identifier_single(c, &db_type)).collect();

            let mut fk_def = String::new();
            if let Some(ref name) = fk.name {
                fk_def.push_str(&format!("    CONSTRAINT {} ", quote_identifier_single(name, &db_type)));
            } else {
                fk_def.push_str("    ");
            }
            // Quote the references table (handle schema.table format)
            let ref_table = quote_identifier(&fk.references_table, &db_type);
            fk_def.push_str(&format!(
                "FOREIGN KEY ({}) REFERENCES {} ({})",
                src_cols.join(", "),
                ref_table,
                ref_cols.join(", ")
            ));

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
                format!("    CONSTRAINT {} CHECK ({})", quote_identifier_single(name, &db_type), check.expression)
            } else {
                format!("    CHECK ({})", check.expression)
            };
            column_defs.push(check_def);
        }

        ddl.push_str(&column_defs.join(",\n"));
        ddl.push_str("\n);\n");

        // Create indexes
        for idx in &table_def.indexes {
            let idx_cols: Vec<String> = idx.columns.iter().map(|c| quote_identifier_single(c, &db_type)).collect();
            let unique_str = if idx.is_unique { "UNIQUE " } else { "" };
            let idx_name = idx.name.clone().unwrap_or_else(|| {
                format!("idx_{}_{}", table_def.name, idx.columns.join("_"))
            });
            ddl.push_str(&format!(
                "\nCREATE {}INDEX {} ON {} ({});",
                unique_str,
                quote_identifier_single(&idx_name, &db_type),
                table_name,
                idx_cols.join(", ")
            ));
        }

        // Add table comment
        if let Some(ref comment) = table_def.comment {
            ddl.push_str(&format!(
                "\n\nCOMMENT ON TABLE {} IS '{}';",
                table_name,
                comment.replace("'", "''")
            ));
        }

        // Add column comments
        for col in &table_def.columns {
            if let Some(ref comment) = col.comment {
                ddl.push_str(&format!(
                    "\nCOMMENT ON COLUMN {}.{} IS '{}';",
                    table_name,
                    quote_identifier_single(&col.name, &db_type),
                    comment.replace('\'', "''")
                ));
            }
        }

        Ok(ddl)
    }

    async fn get_referenceable_tables(&self, pool: PoolRef<'_>) -> AppResult<Vec<TableReferenceInfo>> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        // Query to get all tables with their primary key columns
        let query = r#"
            SELECT
                t.table_schema,
                t.table_name,
                kcu.column_name,
                c.data_type,
                CASE WHEN c.is_nullable = 'YES' THEN true ELSE false END as is_nullable
            FROM information_schema.tables t
            LEFT JOIN information_schema.table_constraints tc
                ON t.table_schema = tc.table_schema
                AND t.table_name = tc.table_name
                AND tc.constraint_type = 'PRIMARY KEY'
            LEFT JOIN information_schema.key_column_usage kcu
                ON tc.constraint_schema = kcu.constraint_schema
                AND tc.constraint_name = kcu.constraint_name
            LEFT JOIN information_schema.columns c
                ON kcu.table_schema = c.table_schema
                AND kcu.table_name = c.table_name
                AND kcu.column_name = c.column_name
            WHERE t.table_type = 'BASE TABLE'
                AND t.table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY t.table_schema, t.table_name, kcu.ordinal_position
        "#;

        let rows = sqlx::query(query)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get referenceable tables: {}", e)))?;

        // Group by table
        let mut tables: HashMap<(String, String), Vec<ColumnInfo>> = HashMap::new();

        for row in rows {
            let schema: String = row.get("table_schema");
            let table: String = row.get("table_name");
            let key = (schema, table);

            // Only add if there's a primary key column
            let col_name: Option<String> = row.try_get("column_name").ok();
            if let Some(col_name) = col_name {
                let data_type: String = row.get("data_type");
                let is_nullable: bool = row.get("is_nullable");

                let pk_columns = tables.entry(key).or_insert_with(Vec::new);
                pk_columns.push(ColumnInfo {
                    name: col_name,
                    data_type,
                    nullable: is_nullable,
                    is_primary_key: true,
                });
            } else {
                // Table exists but has no primary key - still include it
                tables.entry(key).or_insert_with(Vec::new);
            }
        }

        let result: Vec<TableReferenceInfo> = tables
            .into_iter()
            .map(|((schema, table), pk_columns)| TableReferenceInfo {
                table_name: table,
                schema: Some(schema),
                primary_key_columns: pk_columns,
            })
            .collect();

        Ok(result)
    }

    // ============ User Management Methods ============

    async fn get_users(&self, pool: PoolRef<'_>) -> AppResult<Vec<DatabaseUser>> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let query = r#"
            SELECT
                r.rolname as name,
                r.rolsuper as is_superuser,
                r.rolcanlogin as can_login,
                COALESCE(
                    array_agg(m.rolname) FILTER (WHERE m.rolname IS NOT NULL),
                    ARRAY[]::text[]
                ) as roles
            FROM pg_roles r
            LEFT JOIN pg_auth_members am ON r.oid = am.member
            LEFT JOIN pg_roles m ON am.roleid = m.oid
            WHERE r.rolname !~ '^pg_'
            GROUP BY r.rolname, r.rolsuper, r.rolcanlogin
            ORDER BY r.rolname
        "#;

        let rows = sqlx::query(query)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get users: {}", e)))?;

        let users = rows
            .iter()
            .map(|row| {
                let roles: Vec<String> = row
                    .try_get::<Vec<String>, _>("roles")
                    .unwrap_or_default();
                DatabaseUser {
                    name: row.get("name"),
                    host: None,
                    is_superuser: row.get("is_superuser"),
                    can_login: row.get("can_login"),
                    roles,
                }
            })
            .collect();

        Ok(users)
    }

    async fn create_user(&self, pool: PoolRef<'_>, request: &CreateUserRequest) -> AppResult<()> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        // Validate username
        if request.username.is_empty() {
            return Err(AppError::ValidationError("Username cannot be empty".to_string()));
        }

        let sql = format!(
            "CREATE USER {} WITH PASSWORD '{}'",
            quote_identifier_single(&request.username, &DatabaseType::PostgreSQL),
            request.password.replace('\'', "''")
        );

        sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to create user: {}", e)))?;

        Ok(())
    }

    async fn delete_user(
        &self,
        pool: PoolRef<'_>,
        username: &str,
        _host: Option<&str>,
    ) -> AppResult<()> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let sql = format!(
            "DROP USER IF EXISTS {}",
            quote_identifier_single(username, &DatabaseType::PostgreSQL)
        );

        sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to delete user: {}", e)))?;

        Ok(())
    }

    async fn change_password(
        &self,
        pool: PoolRef<'_>,
        request: &ChangePasswordRequest,
    ) -> AppResult<()> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let sql = format!(
            "ALTER USER {} WITH PASSWORD '{}'",
            quote_identifier_single(&request.username, &DatabaseType::PostgreSQL),
            request.new_password.replace('\'', "''")
        );

        sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to change password: {}", e)))?;

        Ok(())
    }

    async fn get_roles(&self, pool: PoolRef<'_>) -> AppResult<Vec<DatabaseRole>> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let query = r#"
            SELECT
                r.rolname as name,
                r.rolsuper as is_system_role,
                COALESCE(
                    array_agg(DISTINCT m.rolname) FILTER (WHERE m.rolname IS NOT NULL),
                    ARRAY[]::text[]
                ) as members
            FROM pg_roles r
            LEFT JOIN pg_auth_members am ON r.oid = am.roleid
            LEFT JOIN pg_roles m ON am.member = m.oid
            WHERE NOT r.rolcanlogin
                AND r.rolname !~ '^pg_'
            GROUP BY r.rolname, r.rolsuper
            ORDER BY r.rolname
        "#;

        let rows = sqlx::query(query)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get roles: {}", e)))?;

        let roles = rows
            .iter()
            .map(|row| {
                let members: Vec<String> = row
                    .try_get::<Vec<String>, _>("members")
                    .unwrap_or_default();
                DatabaseRole {
                    name: row.get("name"),
                    is_system_role: row.get("is_system_role"),
                    members,
                }
            })
            .collect();

        Ok(roles)
    }

    async fn create_role(&self, pool: PoolRef<'_>, request: &CreateRoleRequest) -> AppResult<()> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        if request.role_name.is_empty() {
            return Err(AppError::ValidationError("Role name cannot be empty".to_string()));
        }

        let sql = format!(
            "CREATE ROLE {}",
            quote_identifier_single(&request.role_name, &DatabaseType::PostgreSQL)
        );

        sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to create role: {}", e)))?;

        Ok(())
    }

    async fn delete_role(&self, pool: PoolRef<'_>, role_name: &str) -> AppResult<()> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let sql = format!(
            "DROP ROLE IF EXISTS {}",
            quote_identifier_single(role_name, &DatabaseType::PostgreSQL)
        );

        sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to delete role: {}", e)))?;

        Ok(())
    }

    async fn get_permissions(
        &self,
        pool: PoolRef<'_>,
        grantee: &str,
        _host: Option<&str>,
    ) -> AppResult<Vec<DatabasePermission>> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        // First check if the user is a superuser - superusers have all privileges inherently
        let superuser_check = r#"
            SELECT rolsuper FROM pg_roles WHERE rolname = $1
        "#;

        let is_superuser: Option<bool> = sqlx::query_scalar(superuser_check)
            .bind(grantee)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to check superuser status: {}", e)))?;

        if is_superuser == Some(true) {
            // Superusers have all privileges inherently
            return Ok(vec![
                DatabasePermission {
                    privilege: "SUPERUSER (all privileges)".to_string(),
                    grantee: grantee.to_string(),
                    is_grantable: true,
                },
            ]);
        }

        // Get database-level permissions from pg_database ACL
        // The datacl column contains entries like: {username=CTc/grantor}
        // C = CREATE, T = TEMPORARY, c = CONNECT
        let query = r#"
            WITH acl_entries AS (
                SELECT
                    unnest(datacl)::text as acl_entry
                FROM pg_database
                WHERE datname = current_database()
            )
            SELECT
                acl_entry,
                CASE
                    WHEN acl_entry LIKE $1 || '=%' THEN true
                    ELSE false
                END as matches_user
            FROM acl_entries
            WHERE acl_entry LIKE $1 || '=%'
        "#;

        let rows = sqlx::query(query)
            .bind(grantee)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get permissions: {}", e)))?;

        let mut permissions = Vec::new();

        for row in rows {
            let acl_entry: String = row.get("acl_entry");
            // Parse ACL entry format: username=privileges/grantor
            if let Some(eq_pos) = acl_entry.find('=') {
                let privs_part = &acl_entry[eq_pos + 1..];
                let privs = if let Some(slash_pos) = privs_part.find('/') {
                    &privs_part[..slash_pos]
                } else {
                    privs_part
                };

                // Parse privilege characters
                for c in privs.chars() {
                    let (privilege, is_grantable) = match c {
                        'C' => (Some("CREATE"), false),
                        'c' => (Some("CONNECT"), false),
                        'T' => (Some("TEMPORARY"), false),
                        '*' => (None, true), // Grant option marker
                        _ => (None, false),
                    };

                    if let Some(priv_name) = privilege {
                        permissions.push(DatabasePermission {
                            privilege: priv_name.to_string(),
                            grantee: grantee.to_string(),
                            is_grantable,
                        });
                    }
                }
            }
        }

        Ok(permissions)
    }

    async fn get_available_privileges(&self, _pool: PoolRef<'_>) -> AppResult<AvailablePrivileges> {
        Ok(AvailablePrivileges {
            database_privileges: vec![
                "CONNECT".to_string(),
                "CREATE".to_string(),
                "TEMPORARY".to_string(),
                "TEMP".to_string(),
            ],
        })
    }

    async fn grant_permission(
        &self,
        pool: PoolRef<'_>,
        request: &PermissionRequest,
    ) -> AppResult<()> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        // Validate privilege against allowed list to prevent SQL injection
        let allowed_privileges = ["CONNECT", "CREATE", "TEMPORARY", "TEMP"];
        let privilege_upper = request.privilege.to_uppercase();
        if !allowed_privileges.contains(&privilege_upper.as_str()) {
            return Err(AppError::ValidationError(format!(
                "Invalid privilege '{}'. Allowed privileges: {}",
                request.privilege,
                allowed_privileges.join(", ")
            )));
        }

        let grant_option = if request.with_grant_option {
            " WITH GRANT OPTION"
        } else {
            ""
        };

        // Get current database name
        let db_row = sqlx::query("SELECT current_database()")
            .fetch_one(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get current database: {}", e)))?;
        let db_name: String = db_row.get(0);

        let sql = format!(
            "GRANT {} ON DATABASE {} TO {}{}",
            privilege_upper,
            quote_identifier_single(&db_name, &DatabaseType::PostgreSQL),
            quote_identifier_single(&request.grantee, &DatabaseType::PostgreSQL),
            grant_option
        );

        sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to grant permission: {}", e)))?;

        Ok(())
    }

    async fn revoke_permission(
        &self,
        pool: PoolRef<'_>,
        request: &PermissionRequest,
    ) -> AppResult<()> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        // Validate privilege against allowed list to prevent SQL injection
        let allowed_privileges = ["CONNECT", "CREATE", "TEMPORARY", "TEMP"];
        let privilege_upper = request.privilege.to_uppercase();
        if !allowed_privileges.contains(&privilege_upper.as_str()) {
            return Err(AppError::ValidationError(format!(
                "Invalid privilege '{}'. Allowed privileges: {}",
                request.privilege,
                allowed_privileges.join(", ")
            )));
        }

        // Get current database name
        let db_row = sqlx::query("SELECT current_database()")
            .fetch_one(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get current database: {}", e)))?;
        let db_name: String = db_row.get(0);

        let sql = format!(
            "REVOKE {} ON DATABASE {} FROM {}",
            privilege_upper,
            quote_identifier_single(&db_name, &DatabaseType::PostgreSQL),
            quote_identifier_single(&request.grantee, &DatabaseType::PostgreSQL)
        );

        sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to revoke permission: {}", e)))?;

        Ok(())
    }

    async fn grant_role(&self, pool: PoolRef<'_>, request: &RoleMembershipRequest) -> AppResult<()> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let sql = format!(
            "GRANT {} TO {}",
            quote_identifier_single(&request.role_name, &DatabaseType::PostgreSQL),
            quote_identifier_single(&request.member_name, &DatabaseType::PostgreSQL)
        );

        sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to grant role: {}", e)))?;

        Ok(())
    }

    async fn revoke_role(
        &self,
        pool: PoolRef<'_>,
        request: &RoleMembershipRequest,
    ) -> AppResult<()> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let sql = format!(
            "REVOKE {} FROM {}",
            quote_identifier_single(&request.role_name, &DatabaseType::PostgreSQL),
            quote_identifier_single(&request.member_name, &DatabaseType::PostgreSQL)
        );

        sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to revoke role: {}", e)))?;

        Ok(())
    }

    // ============ View Management Methods ============

    async fn get_views(
        &self,
        pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<ViewInfo>> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        // PostgreSQL defaults to "public" schema
        let schema = "public";

        let sql = r#"
            SELECT
                v.table_name as name,
                v.table_schema as schema,
                v.view_definition as definition,
                v.is_updatable = 'YES' as is_updatable,
                v.check_option
            FROM information_schema.views v
            WHERE v.table_schema = $1
            ORDER BY v.table_name
        "#;

        let rows = sqlx::query(sql)
            .bind(schema)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get views: {}", e)))?;

        let views = rows
            .iter()
            .map(|row| ViewInfo {
                name: row.get::<String, _>("name"),
                schema: row.get::<Option<String>, _>("schema"),
                definition: row.get::<Option<String>, _>("definition"),
                is_updatable: row.get::<bool, _>("is_updatable"),
                check_option: row.get::<Option<String>, _>("check_option"),
            })
            .collect();

        Ok(views)
    }

    async fn get_view_ddl(&self, pool: PoolRef<'_>, view_name: &str) -> AppResult<String> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        // Parse schema.view_name format
        let (schema, name) = if view_name.contains('.') {
            let parts: Vec<&str> = view_name.splitn(2, '.').collect();
            (Some(parts[0].to_string()), parts[1].to_string())
        } else {
            (None, view_name.to_string())
        };

        // Get view definition from information_schema
        let sql = r#"
            SELECT
                v.table_schema,
                v.table_name,
                v.view_definition,
                v.check_option,
                v.is_updatable
            FROM information_schema.views v
            WHERE v.table_name = $1
              AND ($2::text IS NULL OR v.table_schema = $2)
            LIMIT 1
        "#;

        let row = sqlx::query(sql)
            .bind(&name)
            .bind(&schema)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get view DDL: {}", e)))?
            .ok_or_else(|| AppError::QueryError(format!("View '{}' not found", view_name)))?;

        let view_schema: String = row.get("table_schema");
        let view_name: String = row.get("table_name");
        let definition: Option<String> = row.get("view_definition");
        let check_option: Option<String> = row.get("check_option");

        let mut ddl = format!(
            "CREATE OR REPLACE VIEW {}.{} AS\n{}",
            quote_identifier_single(&view_schema, &DatabaseType::PostgreSQL),
            quote_identifier_single(&view_name, &DatabaseType::PostgreSQL),
            definition.unwrap_or_default().trim()
        );

        if let Some(check) = check_option {
            if check != "NONE" {
                ddl.push_str(&format!("\nWITH {} CHECK OPTION", check));
            }
        }

        ddl.push(';');
        Ok(ddl)
    }

    async fn create_view(
        &self,
        pool: PoolRef<'_>,
        view_def: &NewViewDefinition,
    ) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let start = Instant::now();

        let schema_prefix = view_def
            .schema
            .as_ref()
            .map(|s| format!("{}.", quote_identifier_single(s, &DatabaseType::PostgreSQL)))
            .unwrap_or_default();

        let or_replace = if view_def.or_replace { "OR REPLACE " } else { "" };

        let check_option = view_def
            .check_option
            .as_ref()
            .filter(|c| *c != "NONE" && !c.is_empty())
            .map(|c| format!("\nWITH {} CHECK OPTION", c))
            .unwrap_or_default();

        let sql = format!(
            "CREATE {}VIEW {}{} AS\n{}{}",
            or_replace,
            schema_prefix,
            quote_identifier_single(&view_def.name, &DatabaseType::PostgreSQL),
            view_def.definition.trim(),
            check_option
        );

        let result = sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to create view: {}", e)))?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: Some(result.rows_affected()),
            execution_time_ms: start.elapsed().as_millis() as u64,
        })
    }

    async fn drop_view(&self, pool: PoolRef<'_>, view_name: &str) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let start = Instant::now();

        let sql = format!(
            "DROP VIEW IF EXISTS {}",
            quote_identifier(view_name, &DatabaseType::PostgreSQL)
        );

        let result = sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to drop view: {}", e)))?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: Some(result.rows_affected()),
            execution_time_ms: start.elapsed().as_millis() as u64,
        })
    }

    // ============ Index Management Methods ============

    async fn get_all_indexes(
        &self,
        pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<StandaloneIndexInfo>> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        // PostgreSQL defaults to "public" schema
        let schema = "public";

        let sql = r#"
            SELECT
                i.relname as index_name,
                n.nspname as schema_name,
                t.relname as table_name,
                array_agg(a.attname ORDER BY x.ordinality) as columns,
                ix.indisunique as is_unique,
                ix.indisprimary as is_primary,
                am.amname as index_type
            FROM pg_index ix
            JOIN pg_class i ON i.oid = ix.indexrelid
            JOIN pg_class t ON t.oid = ix.indrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            JOIN pg_am am ON am.oid = i.relam
            CROSS JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS x(attnum, ordinality)
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.attnum
            WHERE n.nspname = $1
            GROUP BY i.relname, n.nspname, t.relname, ix.indisunique, ix.indisprimary, am.amname
            ORDER BY t.relname, i.relname
        "#;

        let rows = sqlx::query(sql)
            .bind(schema)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get indexes: {}", e)))?;

        let indexes = rows
            .iter()
            .map(|row| {
                let columns: Vec<String> = row.get("columns");
                StandaloneIndexInfo {
                    name: row.get::<String, _>("index_name"),
                    schema: row.get::<Option<String>, _>("schema_name"),
                    table_name: row.get::<String, _>("table_name"),
                    columns,
                    is_unique: row.get::<bool, _>("is_unique"),
                    is_primary: row.get::<bool, _>("is_primary"),
                    index_type: row.get::<Option<String>, _>("index_type"),
                }
            })
            .collect();

        Ok(indexes)
    }

    async fn get_index_ddl(
        &self,
        pool: PoolRef<'_>,
        index_name: &str,
        _table_name: Option<&str>,
    ) -> AppResult<String> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        // Parse schema.index_name format
        let (schema, name) = if index_name.contains('.') {
            let parts: Vec<&str> = index_name.splitn(2, '.').collect();
            (Some(parts[0].to_string()), parts[1].to_string())
        } else {
            (None, index_name.to_string())
        };

        let sql = r#"
            SELECT pg_get_indexdef(i.oid) as ddl
            FROM pg_index ix
            JOIN pg_class i ON i.oid = ix.indexrelid
            JOIN pg_namespace n ON n.oid = i.relnamespace
            WHERE i.relname = $1
              AND ($2::text IS NULL OR n.nspname = $2)
            LIMIT 1
        "#;

        let row = sqlx::query(sql)
            .bind(&name)
            .bind(&schema)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get index DDL: {}", e)))?
            .ok_or_else(|| AppError::QueryError(format!("Index '{}' not found", index_name)))?;

        let ddl: String = row.get("ddl");
        Ok(format!("{};", ddl))
    }

    async fn create_index(
        &self,
        pool: PoolRef<'_>,
        index_def: &CreateIndexDefinition,
    ) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let start = Instant::now();

        let schema_prefix = index_def
            .schema
            .as_ref()
            .map(|s| format!("{}.", quote_identifier_single(s, &DatabaseType::PostgreSQL)))
            .unwrap_or_default();

        let unique = if index_def.is_unique { "UNIQUE " } else { "" };

        // Generate index name if not provided
        let index_name = index_def.name.clone().unwrap_or_else(|| {
            format!(
                "idx_{}_{}",
                index_def.table_name,
                index_def.columns.join("_")
            )
        });

        let columns = index_def
            .columns
            .iter()
            .map(|c| quote_identifier_single(c, &DatabaseType::PostgreSQL))
            .collect::<Vec<_>>()
            .join(", ");

        let index_type = index_def
            .index_type
            .as_ref()
            .filter(|t| !t.is_empty() && t.to_uppercase() != "BTREE")
            .map(|t| format!(" USING {}", t))
            .unwrap_or_default();

        let where_clause = index_def
            .where_clause
            .as_ref()
            .filter(|w| !w.is_empty())
            .map(|w| format!(" WHERE {}", w))
            .unwrap_or_default();

        let sql = format!(
            "CREATE {}INDEX {} ON {}{}({}){}{}",
            unique,
            quote_identifier_single(&index_name, &DatabaseType::PostgreSQL),
            schema_prefix,
            quote_identifier_single(&index_def.table_name, &DatabaseType::PostgreSQL),
            columns,
            index_type,
            where_clause
        );

        let result = sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to create index: {}", e)))?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: Some(result.rows_affected()),
            execution_time_ms: start.elapsed().as_millis() as u64,
        })
    }

    async fn drop_index(
        &self,
        pool: PoolRef<'_>,
        index_name: &str,
        _table_name: Option<&str>,
    ) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let start = Instant::now();

        let sql = format!(
            "DROP INDEX IF EXISTS {}",
            quote_identifier(index_name, &DatabaseType::PostgreSQL)
        );

        let result = sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to drop index: {}", e)))?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: Some(result.rows_affected()),
            execution_time_ms: start.elapsed().as_millis() as u64,
        })
    }

    // ============ Stored Procedure Management Methods ============

    async fn get_procedures(
        &self,
        pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<ProcedureInfo>> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let schema = "public";

        // Query pg_proc for stored procedures (prokind = 'p' for procedures in PG 11+)
        let sql = r#"
            SELECT
                p.proname as name,
                n.nspname as schema,
                l.lanname as language,
                p.pronargs as parameter_count
            FROM pg_catalog.pg_proc p
            JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
            JOIN pg_catalog.pg_language l ON l.oid = p.prolang
            WHERE n.nspname = $1
              AND p.prokind = 'p'
            ORDER BY p.proname
        "#;

        let rows = sqlx::query(sql)
            .bind(schema)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get procedures: {}", e)))?;

        let procedures = rows
            .iter()
            .map(|row| ProcedureInfo {
                name: row.get::<String, _>("name"),
                schema: row.get::<Option<String>, _>("schema"),
                language: row.get::<Option<String>, _>("language"),
                parameter_count: row.get::<Option<i32>, _>("parameter_count"),
            })
            .collect();

        Ok(procedures)
    }

    async fn get_procedure_ddl(
        &self,
        pool: PoolRef<'_>,
        procedure_name: &str,
    ) -> AppResult<String> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        // Parse schema.procedure_name format
        let (schema, name) = if procedure_name.contains('.') {
            let parts: Vec<&str> = procedure_name.splitn(2, '.').collect();
            (parts[0].to_string(), parts[1].to_string())
        } else {
            ("public".to_string(), procedure_name.to_string())
        };

        // Use pg_get_functiondef to get the complete DDL
        let sql = r#"
            SELECT pg_get_functiondef(p.oid) as ddl
            FROM pg_catalog.pg_proc p
            JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = $1
              AND p.proname = $2
              AND p.prokind = 'p'
            LIMIT 1
        "#;

        let row = sqlx::query(sql)
            .bind(&schema)
            .bind(&name)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get procedure DDL: {}", e)))?
            .ok_or_else(|| AppError::QueryError(format!("Procedure '{}' not found", procedure_name)))?;

        let ddl: String = row.get("ddl");
        Ok(ddl)
    }

    async fn create_procedure(
        &self,
        pool: PoolRef<'_>,
        procedure_def: &NewProcedureDefinition,
    ) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let start = Instant::now();

        // The definition should be the complete CREATE PROCEDURE statement
        let sql = &procedure_def.definition;

        let result = sqlx::query(sql)
            .execute(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to create procedure: {}", e)))?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: Some(result.rows_affected()),
            execution_time_ms: start.elapsed().as_millis() as u64,
        })
    }

    async fn drop_procedure(
        &self,
        pool: PoolRef<'_>,
        procedure_name: &str,
    ) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let start = Instant::now();

        let sql = format!(
            "DROP PROCEDURE IF EXISTS {}",
            quote_identifier(procedure_name, &DatabaseType::PostgreSQL)
        );

        let result = sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to drop procedure: {}", e)))?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: Some(result.rows_affected()),
            execution_time_ms: start.elapsed().as_millis() as u64,
        })
    }

    // ============ Function Management Methods ============

    async fn get_functions(
        &self,
        pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<FunctionInfo>> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let schema = "public";

        // Query pg_proc for functions (prokind = 'f' for normal functions, 'w' for window functions)
        let sql = r#"
            SELECT
                p.proname as name,
                n.nspname as schema,
                l.lanname as language,
                pg_catalog.pg_get_function_result(p.oid) as return_type,
                p.pronargs as parameter_count
            FROM pg_catalog.pg_proc p
            JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
            JOIN pg_catalog.pg_language l ON l.oid = p.prolang
            WHERE n.nspname = $1
              AND p.prokind IN ('f', 'w')
            ORDER BY p.proname
        "#;

        let rows = sqlx::query(sql)
            .bind(schema)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get functions: {}", e)))?;

        let functions = rows
            .iter()
            .map(|row| FunctionInfo {
                name: row.get::<String, _>("name"),
                schema: row.get::<Option<String>, _>("schema"),
                language: row.get::<Option<String>, _>("language"),
                return_type: row.get::<Option<String>, _>("return_type"),
                parameter_count: row.get::<Option<i32>, _>("parameter_count"),
            })
            .collect();

        Ok(functions)
    }

    async fn get_function_ddl(&self, pool: PoolRef<'_>, function_name: &str) -> AppResult<String> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        // Parse schema.function_name format
        let (schema, name) = if function_name.contains('.') {
            let parts: Vec<&str> = function_name.splitn(2, '.').collect();
            (parts[0].to_string(), parts[1].to_string())
        } else {
            ("public".to_string(), function_name.to_string())
        };

        // Use pg_get_functiondef to get the complete DDL
        let sql = r#"
            SELECT pg_get_functiondef(p.oid) as ddl
            FROM pg_catalog.pg_proc p
            JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = $1
              AND p.proname = $2
              AND p.prokind IN ('f', 'w')
            LIMIT 1
        "#;

        let row = sqlx::query(sql)
            .bind(&schema)
            .bind(&name)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get function DDL: {}", e)))?
            .ok_or_else(|| AppError::QueryError(format!("Function '{}' not found", function_name)))?;

        let ddl: String = row.get("ddl");
        Ok(ddl)
    }

    async fn create_function(
        &self,
        pool: PoolRef<'_>,
        function_def: &NewFunctionDefinition,
    ) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let start = Instant::now();

        // The definition should be the complete CREATE FUNCTION statement
        let sql = &function_def.definition;

        let result = sqlx::query(sql)
            .execute(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to create function: {}", e)))?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: Some(result.rows_affected()),
            execution_time_ms: start.elapsed().as_millis() as u64,
        })
    }

    async fn drop_function(
        &self,
        pool: PoolRef<'_>,
        function_name: &str,
    ) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let start = Instant::now();

        let sql = format!(
            "DROP FUNCTION IF EXISTS {}",
            quote_identifier(function_name, &DatabaseType::PostgreSQL)
        );

        let result = sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to drop function: {}", e)))?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: Some(result.rows_affected()),
            execution_time_ms: start.elapsed().as_millis() as u64,
        })
    }

    // ============ Trigger Management Methods ============

    async fn get_triggers(
        &self,
        pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<TriggerInfo>> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let schema = "public";

        let sql = r#"
            SELECT
                t.tgname as name,
                n.nspname as schema,
                c.relname as table_name,
                CASE
                    WHEN t.tgtype & 2 = 2 THEN 'BEFORE'
                    WHEN t.tgtype & 64 = 64 THEN 'INSTEAD OF'
                    ELSE 'AFTER'
                END as timing,
                CONCAT_WS(' OR ',
                    CASE WHEN t.tgtype & 4 = 4 THEN 'INSERT' END,
                    CASE WHEN t.tgtype & 8 = 8 THEN 'DELETE' END,
                    CASE WHEN t.tgtype & 16 = 16 THEN 'UPDATE' END,
                    CASE WHEN t.tgtype & 32 = 32 THEN 'TRUNCATE' END
                ) as event,
                t.tgenabled != 'D' as enabled
            FROM pg_catalog.pg_trigger t
            JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = $1
              AND NOT t.tgisinternal
            ORDER BY t.tgname
        "#;

        let rows = sqlx::query(sql)
            .bind(schema)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get triggers: {}", e)))?;

        let triggers = rows
            .iter()
            .map(|row| TriggerInfo {
                name: row.get::<String, _>("name"),
                schema: row.get::<Option<String>, _>("schema"),
                table_name: row.get::<String, _>("table_name"),
                timing: row.get::<Option<String>, _>("timing"),
                event: row.get::<Option<String>, _>("event"),
                enabled: row.get::<bool, _>("enabled"),
            })
            .collect();

        Ok(triggers)
    }

    async fn get_trigger_ddl(&self, pool: PoolRef<'_>, trigger_name: &str, _table_name: Option<&str>) -> AppResult<String> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        // Parse schema.trigger_name format
        let (schema, name) = if trigger_name.contains('.') {
            let parts: Vec<&str> = trigger_name.splitn(2, '.').collect();
            (parts[0].to_string(), parts[1].to_string())
        } else {
            ("public".to_string(), trigger_name.to_string())
        };

        // Use pg_get_triggerdef to get the DDL
        let sql = r#"
            SELECT pg_get_triggerdef(t.oid, true) as ddl
            FROM pg_catalog.pg_trigger t
            JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = $1
              AND t.tgname = $2
            LIMIT 1
        "#;

        let row = sqlx::query(sql)
            .bind(&schema)
            .bind(&name)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get trigger DDL: {}", e)))?
            .ok_or_else(|| AppError::QueryError(format!("Trigger '{}' not found", trigger_name)))?;

        let ddl: String = row.get("ddl");
        Ok(format!("{};\n", ddl))
    }

    async fn create_trigger(
        &self,
        pool: PoolRef<'_>,
        trigger_def: &NewTriggerDefinition,
    ) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let start = Instant::now();

        // The definition should be the complete CREATE TRIGGER statement
        let sql = &trigger_def.definition;

        let result = sqlx::query(sql)
            .execute(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to create trigger: {}", e)))?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: Some(result.rows_affected()),
            execution_time_ms: start.elapsed().as_millis() as u64,
        })
    }

    async fn drop_trigger(
        &self,
        pool: PoolRef<'_>,
        trigger_name: &str,
        table_name: Option<&str>,
    ) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let start = Instant::now();

        // In PostgreSQL, DROP TRIGGER requires the table name
        let table = table_name.ok_or_else(|| {
            AppError::QueryError("Table name is required to drop a trigger in PostgreSQL".to_string())
        })?;

        let sql = format!(
            "DROP TRIGGER IF EXISTS {} ON {}",
            quote_identifier_single(trigger_name, &DatabaseType::PostgreSQL),
            quote_identifier(table, &DatabaseType::PostgreSQL)
        );

        let result = sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to drop trigger: {}", e)))?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: Some(result.rows_affected()),
            execution_time_ms: start.elapsed().as_millis() as u64,
        })
    }

    // ============ Sequence Management Methods ============

    async fn get_sequences(
        &self,
        pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<SequenceInfo>> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let schema = "public";

        let sql = r#"
            SELECT
                s.sequencename as name,
                s.schemaname as schema,
                s.last_value as current_value,
                s.increment_by,
                s.min_value,
                s.max_value,
                s.cycle as is_cycle
            FROM pg_catalog.pg_sequences s
            WHERE s.schemaname = $1
            ORDER BY s.sequencename
        "#;

        let rows = sqlx::query(sql)
            .bind(schema)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get sequences: {}", e)))?;

        let sequences = rows
            .iter()
            .map(|row| SequenceInfo {
                name: row.get::<String, _>("name"),
                schema: row.get::<Option<String>, _>("schema"),
                current_value: row.get::<Option<i64>, _>("current_value"),
                increment_by: row.get::<Option<i64>, _>("increment_by"),
                min_value: row.get::<Option<i64>, _>("min_value"),
                max_value: row.get::<Option<i64>, _>("max_value"),
                cycle: row.get::<bool, _>("is_cycle"),
            })
            .collect();

        Ok(sequences)
    }

    async fn get_sequence_ddl(&self, pool: PoolRef<'_>, sequence_name: &str) -> AppResult<String> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        // Parse schema.sequence_name format
        let (schema, name) = if sequence_name.contains('.') {
            let parts: Vec<&str> = sequence_name.splitn(2, '.').collect();
            (parts[0].to_string(), parts[1].to_string())
        } else {
            ("public".to_string(), sequence_name.to_string())
        };

        let sql = r#"
            SELECT
                s.sequencename,
                s.schemaname,
                s.start_value,
                s.increment_by,
                s.min_value,
                s.max_value,
                s.cache_size,
                s.cycle
            FROM pg_catalog.pg_sequences s
            WHERE s.schemaname = $1
              AND s.sequencename = $2
            LIMIT 1
        "#;

        let row = sqlx::query(sql)
            .bind(&schema)
            .bind(&name)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to get sequence DDL: {}", e)))?
            .ok_or_else(|| AppError::QueryError(format!("Sequence '{}' not found", sequence_name)))?;

        let seq_schema: String = row.get("schemaname");
        let seq_name: String = row.get("sequencename");
        let start_value: i64 = row.get("start_value");
        let increment_by: i64 = row.get("increment_by");
        let min_value: i64 = row.get("min_value");
        let max_value: i64 = row.get("max_value");
        let cache_size: i64 = row.get("cache_size");
        let cycle: bool = row.get("cycle");

        let cycle_str = if cycle { "CYCLE" } else { "NO CYCLE" };

        let ddl = format!(
            "CREATE SEQUENCE {}.{}\n    START WITH {}\n    INCREMENT BY {}\n    MINVALUE {}\n    MAXVALUE {}\n    CACHE {}\n    {};",
            quote_identifier_single(&seq_schema, &DatabaseType::PostgreSQL),
            quote_identifier_single(&seq_name, &DatabaseType::PostgreSQL),
            start_value,
            increment_by,
            min_value,
            max_value,
            cache_size,
            cycle_str
        );

        Ok(ddl)
    }

    async fn create_sequence(
        &self,
        pool: PoolRef<'_>,
        sequence_def: &NewSequenceDefinition,
    ) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let start = Instant::now();

        let schema_prefix = sequence_def
            .schema
            .as_ref()
            .map(|s| format!("{}.", quote_identifier_single(s, &DatabaseType::PostgreSQL)))
            .unwrap_or_default();

        let mut parts = vec![format!(
            "CREATE SEQUENCE {}{}",
            schema_prefix,
            quote_identifier_single(&sequence_def.name, &DatabaseType::PostgreSQL)
        )];

        if let Some(start_value) = sequence_def.start_value {
            parts.push(format!("START WITH {}", start_value));
        }
        if let Some(increment) = sequence_def.increment_by {
            parts.push(format!("INCREMENT BY {}", increment));
        }
        if let Some(min) = sequence_def.min_value {
            parts.push(format!("MINVALUE {}", min));
        }
        if let Some(max) = sequence_def.max_value {
            parts.push(format!("MAXVALUE {}", max));
        }
        if sequence_def.cycle {
            parts.push("CYCLE".to_string());
        } else {
            parts.push("NO CYCLE".to_string());
        }

        let sql = parts.join(" ");

        let result = sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to create sequence: {}", e)))?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: Some(result.rows_affected()),
            execution_time_ms: start.elapsed().as_millis() as u64,
        })
    }

    async fn drop_sequence(
        &self,
        pool: PoolRef<'_>,
        sequence_name: &str,
    ) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::Postgres(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Postgres driver".to_string())),
        };

        let start = Instant::now();

        let sql = format!(
            "DROP SEQUENCE IF EXISTS {}",
            quote_identifier(sequence_name, &DatabaseType::PostgreSQL)
        );

        let result = sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(|e| AppError::QueryError(format!("Failed to drop sequence: {}", e)))?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: Some(result.rows_affected()),
            execution_time_ms: start.elapsed().as_millis() as u64,
        })
    }
}

