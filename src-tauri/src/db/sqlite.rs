use crate::db::{DatabaseDriver, PoolRef};
use crate::error::{AppError, AppResult};
use crate::models::{
    ConnectionConfig, ConstraintInfo, ExtendedColumnInfo, ForeignKeyInfo, IndexInfo,
    QueryResult, TableInfo, TableProperties, TableRelationship, TableSchema,
    TestConnectionResult, ColumnInfo
};
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

        // SQLite stores the original DDL in sqlite_master
        let query = "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?";

        let ddl: Option<String> = sqlx::query_scalar(query)
            .bind(table_name)
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

        // SQLite doesn't have a direct way to query constraints, but we can parse them from the DDL
        let query = "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?";

        let ddl: Option<String> = sqlx::query_scalar(query)
            .bind(table_name)
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
}

