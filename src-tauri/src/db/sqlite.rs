use crate::db::{DatabaseDriver, PoolRef};
use crate::error::{AppError, AppResult};
use crate::models::{ConnectionConfig, QueryResult, TableInfo, TableSchema, TestConnectionResult, ColumnInfo, ForeignKeyInfo};
use async_trait::async_trait;
use sqlx::{sqlite::SqlitePool, Row, Column};
use std::time::Instant;

pub struct SqliteDriver;

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
                    data_type: "unknown".to_string(),
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

    fn build_connection_string(&self, config: &ConnectionConfig) -> String {
        let path = config.file_path.as_deref()
            .unwrap_or_else(|| config.database.as_str());
        
        if path.starts_with("sqlite:") {
            path.to_string()
        } else {
            format!("sqlite:{}", path)
        }
    }
}

