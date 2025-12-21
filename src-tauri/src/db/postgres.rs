use crate::db::{DatabaseDriver, PoolRef};
use crate::error::{AppError, AppResult};
use crate::models::{
    ConnectionConfig, ConstraintInfo, ExtendedColumnInfo, ForeignKeyInfo, IndexInfo,
    QueryResult, TableInfo, TableProperties, TableRelationship, TableSchema,
    TestConnectionResult, ColumnInfo
};
use async_trait::async_trait;
use sqlx::{postgres::PgPool, Row, Column};
use std::time::Instant;

pub struct PostgresDriver;

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
                        .map(|i| {
                            // Try different types
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
                            } else if let Ok(val) = row.try_get::<serde_json::Value, _>(i) {
                                val
                            } else {
                                // Fallback for unsupported types
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
            // Execute as execute (INSERT, UPDATE, DELETE)
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

