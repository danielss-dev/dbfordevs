use crate::db::{DatabaseDriver, PoolRef};
use crate::error::{AppError, AppResult};
use crate::models::{ConnectionConfig, QueryResult, TableInfo, TableSchema, TestConnectionResult, ColumnInfo, ForeignKeyInfo};
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

    async fn get_tables(&self, pool: PoolRef<'_>) -> AppResult<Vec<TableInfo>> {
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
}

