use crate::db::{DatabaseDriver, PoolRef};
use crate::error::{AppError, AppResult};
use crate::models::{
    ConnectionConfig, ConstraintInfo, ExtendedColumnInfo, ForeignKeyInfo, IndexInfo,
    QueryResult, TableInfo, TableProperties, TableRelationship, TableSchema,
    TestConnectionResult, ColumnInfo
};
use async_trait::async_trait;
use sqlx::{mysql::MySqlPool, Row, Column};
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
        let is_select = sql_upper.starts_with("SELECT") || sql_upper.starts_with("WITH") || sql_upper.starts_with("SHOW") || sql_upper.starts_with("DESCRIBE");
        
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

    async fn get_all_table_schemas(&self, pool: PoolRef<'_>, config: &ConnectionConfig) -> AppResult<Vec<TableSchema>> {
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
}

