use crate::error::{AppError, AppResult};
use crate::models::{ConnectionConfig, SslMode};
use async_trait::async_trait;
use scylla::{Session, SessionBuilder};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Instant;

/// Pool type for Cassandra connections (Session acts as connection pool)
pub type CassandraPool = Arc<Session>;

/// Information about a Cassandra keyspace
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CassandraKeyspaceInfo {
    pub name: String,
    pub replication_strategy: String,
    pub replication_factor: i32,
    pub durable_writes: bool,
    pub table_count: i64,
}

/// Information about a Cassandra table
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CassandraTableInfo {
    pub name: String,
    pub keyspace: String,
    pub partition_keys: Vec<String>,
    pub clustering_keys: Vec<CassandraClusteringKey>,
    pub column_count: i32,
}

/// Clustering key with order direction
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CassandraClusteringKey {
    pub name: String,
    pub order: String, // "ASC" or "DESC"
}

/// Information about a Cassandra column
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CassandraColumnInfo {
    pub name: String,
    pub data_type: String,
    pub kind: String, // "partition_key", "clustering", "regular", "static"
    pub position: i32,
}

/// Result from CQL query execution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CassandraQueryResult {
    pub rows: Vec<String>, // JSON strings
    pub columns: Vec<CassandraColumnDef>,
    pub execution_time_ms: u64,
    pub row_count: i64,
    pub has_more: bool,
    pub paging_state: Option<String>,
}

/// Column definition from query result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CassandraColumnDef {
    pub name: String,
    pub data_type: String,
}

/// Information about a Cassandra index
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CassandraIndexInfo {
    pub name: String,
    pub table_name: String,
    pub column_name: String,
    pub index_type: String,
    pub options: String, // JSON
}

/// Cassandra server information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CassandraServerInfo {
    pub cluster_name: String,
    pub release_version: String,
    pub datacenter: String,
    pub nodes: Vec<CassandraNodeInfo>,
}

/// Cassandra node information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CassandraNodeInfo {
    pub address: String,
    pub datacenter: String,
    pub rack: String,
    pub is_up: bool,
}

/// Build Cassandra connection string/nodes from config
pub fn build_cassandra_connection_string(config: &ConnectionConfig) -> String {
    // Check if user provided a full connection string
    if let Some(conn_str) = &config.connection_string {
        if config.use_connection_string.unwrap_or(false) && !conn_str.is_empty() {
            return conn_str.clone();
        }
    }

    let host = config.host.as_deref().unwrap_or("localhost");
    let port = config.port.unwrap_or(9042);

    format!("{}:{}", host, port)
}

/// Create a Cassandra session (connection pool)
pub async fn create_cassandra_pool(config: &ConnectionConfig) -> AppResult<CassandraPool> {
    let host = config.host.as_deref().unwrap_or("localhost");
    let port = config.port.unwrap_or(9042);

    let mut builder = SessionBuilder::new().known_node(format!("{}:{}", host, port));

    // Add authentication if provided
    if let (Some(username), Some(password)) = (&config.username, &config.password) {
        if !username.is_empty() {
            builder = builder.user(username, password);
        }
    }

    // Check for SSL configuration
    // Note: Cassandra SSL support requires building with OpenSSL support.
    // The scylla driver's SSL is handled at the transport level.
    // For now, if SSL is requested but not available, we proceed without SSL
    // and the connection will work if the server accepts plain connections.
    if let Some(ssl_config) = &config.ssl {
        if !matches!(ssl_config.mode, SslMode::Disable) {
            // SSL is requested - log that it's configured
            // The actual SSL context would be set here if the 'ssl' feature was enabled
            // For now, this is a placeholder that acknowledges SSL is requested
            eprintln!("Note: Cassandra SSL requested but requires additional native SSL setup. Connecting without SSL.");
        }
    }

    let session = builder
        .build()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to connect to Cassandra: {}", e)))?;

    Ok(Arc::new(session))
}

/// Get server version for test connection
pub async fn get_server_version(pool: &CassandraPool) -> AppResult<String> {
    let query = "SELECT release_version FROM system.local";
    let result = pool
        .query_unpaged(query, &[])
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to get server version: {}", e)))?;

    if let Some(rows) = result.rows {
        if let Some(row) = rows.into_iter().next() {
            if let Some(version) = row.columns[0].as_ref() {
                if let Some(v) = version.as_text() {
                    return Ok(v.to_string());
                }
            }
        }
    }

    Ok("Unknown".to_string())
}

// ===== Keyspace Operations =====

/// List all keyspaces
pub async fn list_keyspaces(pool: &CassandraPool) -> AppResult<Vec<CassandraKeyspaceInfo>> {
    let query = r#"
        SELECT keyspace_name, replication, durable_writes
        FROM system_schema.keyspaces
    "#;

    let result = pool
        .query_unpaged(query, &[])
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to list keyspaces: {}", e)))?;

    let mut keyspaces = Vec::new();

    if let Some(rows) = result.rows {
        for row in rows {
            let name: String = row
                .columns[0]
                .as_ref()
                .and_then(|v| v.as_text())
                .cloned()
                .unwrap_or_default();

            // Parse replication map
            let replication_map: String = row
                .columns[1]
                .as_ref()
                .map(|v| format!("{:?}", v))
                .unwrap_or_default();

            let (strategy, factor) = parse_replication(&replication_map);

            let durable_writes: bool = row
                .columns[2]
                .as_ref()
                .and_then(|v| v.as_boolean())
                .unwrap_or(true);

            // Get table count for this keyspace
            let table_count = get_table_count(pool, &name).await.unwrap_or(0);

            keyspaces.push(CassandraKeyspaceInfo {
                name,
                replication_strategy: strategy,
                replication_factor: factor,
                durable_writes,
                table_count,
            });
        }
    }

    Ok(keyspaces)
}

/// Parse replication strategy from map string
fn parse_replication(map_str: &str) -> (String, i32) {
    // Extract class from replication map
    let strategy = if map_str.contains("SimpleStrategy") {
        "SimpleStrategy".to_string()
    } else if map_str.contains("NetworkTopologyStrategy") {
        "NetworkTopologyStrategy".to_string()
    } else if map_str.contains("LocalStrategy") {
        "LocalStrategy".to_string()
    } else {
        "Unknown".to_string()
    };

    // Try to extract replication_factor
    let factor = if let Some(idx) = map_str.find("replication_factor") {
        let rest = &map_str[idx..];
        rest.chars()
            .filter(|c| c.is_ascii_digit())
            .collect::<String>()
            .parse()
            .unwrap_or(1)
    } else {
        1
    };

    (strategy, factor)
}

/// Get table count for a keyspace
async fn get_table_count(pool: &CassandraPool, keyspace: &str) -> AppResult<i64> {
    let query = "SELECT COUNT(*) FROM system_schema.tables WHERE keyspace_name = ?";
    let result = pool
        .query_unpaged(query, (keyspace,))
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to count tables: {}", e)))?;

    if let Some(rows) = result.rows {
        if let Some(row) = rows.into_iter().next() {
            if let Some(count) = row.columns[0].as_ref() {
                if let Some(c) = count.as_bigint() {
                    return Ok(c);
                }
            }
        }
    }

    Ok(0)
}

/// Create a new keyspace
pub async fn create_keyspace(
    pool: &CassandraPool,
    name: &str,
    replication_strategy: &str,
    replication_factor: i32,
    durable_writes: bool,
) -> AppResult<bool> {
    let query = if replication_strategy == "SimpleStrategy" {
        format!(
            "CREATE KEYSPACE IF NOT EXISTS {} WITH replication = {{'class': 'SimpleStrategy', 'replication_factor': {}}} AND durable_writes = {}",
            name, replication_factor, durable_writes
        )
    } else {
        format!(
            "CREATE KEYSPACE IF NOT EXISTS {} WITH replication = {{'class': 'NetworkTopologyStrategy', 'datacenter1': {}}} AND durable_writes = {}",
            name, replication_factor, durable_writes
        )
    };

    pool.query_unpaged(query, &[])
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to create keyspace: {}", e)))?;

    Ok(true)
}

/// Drop a keyspace
pub async fn drop_keyspace(pool: &CassandraPool, name: &str) -> AppResult<bool> {
    let query = format!("DROP KEYSPACE IF EXISTS {}", name);
    pool.query_unpaged(query, &[])
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to drop keyspace: {}", e)))?;

    Ok(true)
}

// ===== Table Operations =====

/// List tables in a keyspace
pub async fn list_tables(pool: &CassandraPool, keyspace: &str) -> AppResult<Vec<CassandraTableInfo>> {
    let query = "SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?";

    let result = pool
        .query_unpaged(query, (keyspace,))
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to list tables: {}", e)))?;

    let mut tables = Vec::new();

    if let Some(rows) = result.rows {
        for row in rows {
            let table_name: String = row
                .columns[0]
                .as_ref()
                .and_then(|v| v.as_text())
                .cloned()
                .unwrap_or_default();

            // Get table details
            let table_info = get_table_info(pool, keyspace, &table_name).await?;
            tables.push(table_info);
        }
    }

    Ok(tables)
}

/// Get detailed information about a table
async fn get_table_info(
    pool: &CassandraPool,
    keyspace: &str,
    table_name: &str,
) -> AppResult<CassandraTableInfo> {
    // Get columns to count and identify keys
    let columns = describe_table(pool, keyspace, table_name).await?;

    let partition_keys: Vec<String> = columns
        .iter()
        .filter(|c| c.kind == "partition_key")
        .map(|c| c.name.clone())
        .collect();

    let clustering_keys: Vec<CassandraClusteringKey> = columns
        .iter()
        .filter(|c| c.kind == "clustering")
        .map(|c| CassandraClusteringKey {
            name: c.name.clone(),
            order: "ASC".to_string(), // Default, would need to query clustering_order
        })
        .collect();

    Ok(CassandraTableInfo {
        name: table_name.to_string(),
        keyspace: keyspace.to_string(),
        partition_keys,
        clustering_keys,
        column_count: columns.len() as i32,
    })
}

/// Describe table columns
pub async fn describe_table(
    pool: &CassandraPool,
    keyspace: &str,
    table_name: &str,
) -> AppResult<Vec<CassandraColumnInfo>> {
    let query = r#"
        SELECT column_name, type, kind, position
        FROM system_schema.columns
        WHERE keyspace_name = ? AND table_name = ?
    "#;

    let result = pool
        .query_unpaged(query, (keyspace, table_name))
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to describe table: {}", e)))?;

    let mut columns = Vec::new();

    if let Some(rows) = result.rows {
        for row in rows {
            let name: String = row
                .columns[0]
                .as_ref()
                .and_then(|v| v.as_text())
                .cloned()
                .unwrap_or_default();

            let data_type: String = row
                .columns[1]
                .as_ref()
                .and_then(|v| v.as_text())
                .cloned()
                .unwrap_or_default();

            let kind: String = row
                .columns[2]
                .as_ref()
                .and_then(|v| v.as_text())
                .cloned()
                .unwrap_or_else(|| "regular".to_string());

            let position: i32 = row
                .columns[3]
                .as_ref()
                .and_then(|v| v.as_int())
                .unwrap_or(0);

            columns.push(CassandraColumnInfo {
                name,
                data_type,
                kind,
                position,
            });
        }
    }

    // Sort by kind priority (partition_key first, then clustering, then others) and position
    columns.sort_by(|a, b| {
        let kind_order = |k: &str| match k {
            "partition_key" => 0,
            "clustering" => 1,
            "static" => 2,
            _ => 3,
        };
        kind_order(&a.kind)
            .cmp(&kind_order(&b.kind))
            .then_with(|| a.position.cmp(&b.position))
    });

    Ok(columns)
}

/// Drop a table
pub async fn drop_table(pool: &CassandraPool, keyspace: &str, table_name: &str) -> AppResult<bool> {
    let query = format!("DROP TABLE IF EXISTS {}.{}", keyspace, table_name);
    pool.query_unpaged(query, &[])
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to drop table: {}", e)))?;

    Ok(true)
}

/// Truncate a table
pub async fn truncate_table(pool: &CassandraPool, keyspace: &str, table_name: &str) -> AppResult<bool> {
    let query = format!("TRUNCATE {}.{}", keyspace, table_name);
    pool.query_unpaged(query, &[])
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to truncate table: {}", e)))?;

    Ok(true)
}

// ===== Query Operations =====

/// Execute a CQL query
pub async fn execute_cql(
    pool: &CassandraPool,
    keyspace: Option<&str>,
    cql: &str,
    page_size: i32,
    _paging_state: Option<&str>,
    _consistency: Option<&str>,
) -> AppResult<CassandraQueryResult> {
    let start = Instant::now();

    // If keyspace is specified, prepend USE statement or qualify tables
    let _full_cql = if let Some(ks) = keyspace {
        if cql.to_uppercase().starts_with("USE ") || cql.to_uppercase().starts_with("CREATE KEYSPACE") {
            cql.to_string()
        } else {
            // Try to execute with keyspace context
            format!("USE {}; {}", ks, cql)
        }
    } else {
        cql.to_string()
    };

    // For simple queries, just execute directly
    // Note: Scylla driver doesn't easily support USE statements mid-session
    // So we'll execute the query directly
    let result = pool
        .query_unpaged(cql, &[])
        .await
        .map_err(|e| AppError::QueryError(format!("CQL execution failed: {}", e)))?;

    let execution_time_ms = start.elapsed().as_millis() as u64;

    // Extract column definitions from result metadata
    let columns: Vec<CassandraColumnDef> = result
        .col_specs()
        .iter()
        .map(|spec| CassandraColumnDef {
            name: spec.name.clone(),
            data_type: format!("{:?}", spec.typ),
        })
        .collect();

    // Convert rows to JSON strings
    let mut rows_json = Vec::new();
    let row_count;

    if let Some(rows) = result.rows {
        row_count = rows.len() as i64;
        for row in rows.iter().take(page_size as usize) {
            let mut map = serde_json::Map::new();
            for (i, col_def) in columns.iter().enumerate() {
                if let Some(value) = &row.columns[i] {
                    map.insert(col_def.name.clone(), cql_value_to_json(value));
                } else {
                    map.insert(col_def.name.clone(), serde_json::Value::Null);
                }
            }
            rows_json.push(serde_json::to_string(&map).unwrap_or_else(|_| "{}".to_string()));
        }
    } else {
        row_count = 0;
    }

    Ok(CassandraQueryResult {
        rows: rows_json,
        columns,
        execution_time_ms,
        row_count,
        has_more: false, // Simplified - would need paging implementation
        paging_state: None,
    })
}

/// Convert a CQL value to JSON
fn cql_value_to_json(value: &scylla::frame::response::result::CqlValue) -> serde_json::Value {
    use scylla::frame::response::result::CqlValue;

    match value {
        CqlValue::Ascii(s) | CqlValue::Text(s) => serde_json::Value::String(s.clone()),
        CqlValue::Boolean(b) => serde_json::Value::Bool(*b),
        CqlValue::Int(i) => serde_json::Value::Number((*i).into()),
        CqlValue::BigInt(i) => serde_json::Value::Number((*i).into()),
        CqlValue::SmallInt(i) => serde_json::Value::Number((*i).into()),
        CqlValue::TinyInt(i) => serde_json::Value::Number((*i).into()),
        CqlValue::Float(f) => serde_json::Number::from_f64(*f as f64)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        CqlValue::Double(d) => serde_json::Number::from_f64(*d)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        CqlValue::Uuid(u) => serde_json::Value::String(u.to_string()),
        CqlValue::Timeuuid(u) => serde_json::Value::String(u.to_string()),
        CqlValue::Timestamp(ts) => serde_json::Value::String(format!("{:?}", ts)),
        CqlValue::Date(d) => serde_json::Value::String(format!("{:?}", d)),
        CqlValue::Time(t) => serde_json::Value::String(format!("{:?}", t)),
        CqlValue::Blob(bytes) => serde_json::Value::String(base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            bytes,
        )),
        CqlValue::Inet(addr) => serde_json::Value::String(addr.to_string()),
        CqlValue::List(list) => {
            serde_json::Value::Array(list.iter().map(cql_value_to_json).collect())
        }
        CqlValue::Set(set) => serde_json::Value::Array(set.iter().map(cql_value_to_json).collect()),
        CqlValue::Map(map) => {
            let mut obj = serde_json::Map::new();
            for (k, v) in map {
                let key = match k {
                    CqlValue::Text(s) | CqlValue::Ascii(s) => s.clone(),
                    _ => format!("{:?}", k),
                };
                obj.insert(key, cql_value_to_json(v));
            }
            serde_json::Value::Object(obj)
        }
        CqlValue::Tuple(tuple) => {
            serde_json::Value::Array(tuple.iter().filter_map(|v| v.as_ref().map(cql_value_to_json)).collect())
        }
        CqlValue::Counter(c) => serde_json::Value::Number(c.0.into()),
        CqlValue::Varint(v) => serde_json::Value::String(format!("{:?}", v)),
        CqlValue::Decimal(d) => serde_json::Value::String(format!("{:?}", d)),
        CqlValue::Duration(d) => serde_json::Value::String(format!("{:?}", d)),
        CqlValue::Empty => serde_json::Value::Null,
        CqlValue::UserDefinedType { fields, .. } => {
            let mut obj = serde_json::Map::new();
            for (name, val) in fields {
                if let Some(v) = val {
                    obj.insert(name.clone(), cql_value_to_json(v));
                } else {
                    obj.insert(name.clone(), serde_json::Value::Null);
                }
            }
            serde_json::Value::Object(obj)
        }
    }
}

// ===== Index Operations =====

/// List indexes in a keyspace
pub async fn list_indexes(pool: &CassandraPool, keyspace: &str) -> AppResult<Vec<CassandraIndexInfo>> {
    let query = r#"
        SELECT index_name, table_name, options
        FROM system_schema.indexes
        WHERE keyspace_name = ?
    "#;

    let result = pool
        .query_unpaged(query, (keyspace,))
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to list indexes: {}", e)))?;

    let mut indexes = Vec::new();

    if let Some(rows) = result.rows {
        for row in rows {
            let name: String = row
                .columns[0]
                .as_ref()
                .and_then(|v| v.as_text())
                .cloned()
                .unwrap_or_default();

            let table_name: String = row
                .columns[1]
                .as_ref()
                .and_then(|v| v.as_text())
                .cloned()
                .unwrap_or_default();

            let options: String = row
                .columns[2]
                .as_ref()
                .map(|v| format!("{:?}", v))
                .unwrap_or_default();

            // Extract target column from options
            let column_name = extract_index_target(&options);
            let index_type = extract_index_class(&options);

            indexes.push(CassandraIndexInfo {
                name,
                table_name,
                column_name,
                index_type,
                options,
            });
        }
    }

    Ok(indexes)
}

fn extract_index_target(options: &str) -> String {
    // Options typically contains "target" -> "column_name"
    if let Some(idx) = options.find("target") {
        let rest = &options[idx..];
        if let Some(start) = rest.find('"') {
            let rest = &rest[start + 1..];
            if let Some(end) = rest.find('"') {
                return rest[..end].to_string();
            }
        }
    }
    "unknown".to_string()
}

fn extract_index_class(options: &str) -> String {
    if options.contains("SASI") {
        "SASI".to_string()
    } else if options.contains("keys") {
        "KEYS".to_string()
    } else if options.contains("entries") {
        "ENTRIES".to_string()
    } else if options.contains("values") {
        "VALUES".to_string()
    } else if options.contains("full") {
        "FULL".to_string()
    } else {
        "COMPOSITES".to_string()
    }
}

// ===== Server Operations =====

/// Get server information
pub async fn get_server_info(pool: &CassandraPool) -> AppResult<CassandraServerInfo> {
    // Get local node info
    let local_query = "SELECT cluster_name, release_version, data_center FROM system.local";
    let local_result = pool
        .query_unpaged(local_query, &[])
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to get local info: {}", e)))?;

    let mut cluster_name = "Unknown".to_string();
    let mut release_version = "Unknown".to_string();
    let mut datacenter = "Unknown".to_string();

    if let Some(rows) = local_result.rows {
        if let Some(row) = rows.into_iter().next() {
            cluster_name = row.columns[0]
                .as_ref()
                .and_then(|v| v.as_text())
                .cloned()
                .unwrap_or_else(|| "Unknown".to_string());
            release_version = row.columns[1]
                .as_ref()
                .and_then(|v| v.as_text())
                .cloned()
                .unwrap_or_else(|| "Unknown".to_string());
            datacenter = row.columns[2]
                .as_ref()
                .and_then(|v| v.as_text())
                .cloned()
                .unwrap_or_else(|| "Unknown".to_string());
        }
    }

    // Get peer nodes
    let peers_query = "SELECT peer, data_center, rack FROM system.peers";
    let peers_result = pool.query_unpaged(peers_query, &[]).await.ok();

    let mut nodes = vec![CassandraNodeInfo {
        address: "local".to_string(),
        datacenter: datacenter.clone(),
        rack: "rack1".to_string(),
        is_up: true,
    }];

    if let Some(result) = peers_result {
        if let Some(rows) = result.rows {
            for row in rows {
                let address: String = row
                    .columns[0]
                    .as_ref()
                    .and_then(|v| {
                        if let scylla::frame::response::result::CqlValue::Inet(addr) = v {
                            Some(addr.to_string())
                        } else {
                            None
                        }
                    })
                    .unwrap_or("unknown".to_string());

                let dc: String = row
                    .columns[1]
                    .as_ref()
                    .and_then(|v| v.as_text())
                    .cloned()
                    .unwrap_or_else(|| "unknown".to_string());

                let rack: String = row
                    .columns[2]
                    .as_ref()
                    .and_then(|v| v.as_text())
                    .cloned()
                    .unwrap_or_else(|| "unknown".to_string());

                nodes.push(CassandraNodeInfo {
                    address,
                    datacenter: dc,
                    rack,
                    is_up: true, // Assuming up if in peers table
                });
            }
        }
    }

    Ok(CassandraServerInfo {
        cluster_name,
        release_version,
        datacenter,
        nodes,
    })
}

// ===== DatabaseDriver trait implementation =====
// Cassandra doesn't fit the SQL-centric DatabaseDriver trait,
// but we implement it with NotSupported for SQL operations (same pattern as MongoDB)

use super::connection::PoolRef;
use super::DatabaseDriver;
use crate::models::{
    AvailablePrivileges, ChangePasswordRequest, ConstraintInfo, CreateIndexDefinition,
    CreateRoleRequest, CreateUserRequest, DatabasePermission, DatabaseRole, DatabaseUser,
    ExplainResult, FunctionInfo, IndexInfo, NewFunctionDefinition, NewProcedureDefinition,
    NewSequenceDefinition, NewTableDefinition, NewTriggerDefinition, NewViewDefinition,
    PermissionRequest, PreviewResult, ProcedureInfo, QueryResult, RoleMembershipRequest,
    SequenceInfo, StandaloneIndexInfo, TableInfo, TableProperties, TableReferenceInfo,
    TableRelationship, TableSchema, TestConnectionResult, TriggerInfo, ViewInfo,
};

pub struct CassandraDriver;

#[async_trait]
impl DatabaseDriver for CassandraDriver {
    async fn test_connection(&self, config: &ConnectionConfig) -> AppResult<TestConnectionResult> {
        match create_cassandra_pool(config).await {
            Ok(pool) => {
                let version = get_server_version(&pool).await.unwrap_or_else(|_| "Unknown".to_string());
                Ok(TestConnectionResult {
                    success: true,
                    message: "Connection successful".to_string(),
                    server_version: Some(format!("Cassandra {}", version)),
                })
            }
            Err(e) => Ok(TestConnectionResult {
                success: false,
                message: e.to_string(),
                server_version: None,
            }),
        }
    }

    async fn execute_query(&self, _pool: PoolRef<'_>, _sql: &str) -> AppResult<QueryResult> {
        Err(AppError::NotSupported(
            "Cassandra does not support SQL queries. Use CQL-specific operations.".to_string(),
        ))
    }

    async fn get_tables(&self, _pool: PoolRef<'_>, _config: &ConnectionConfig) -> AppResult<Vec<TableInfo>> {
        Err(AppError::NotSupported("Cassandra uses keyspaces and tables. Use Cassandra-specific operations.".to_string()))
    }

    async fn get_table_schema(&self, _pool: PoolRef<'_>, _table_name: &str) -> AppResult<TableSchema> {
        Err(AppError::NotSupported("Use Cassandra-specific describe_table operation".to_string()))
    }

    async fn get_all_table_schemas(
        &self,
        _pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<TableSchema>> {
        Err(AppError::NotSupported("Use Cassandra-specific operations".to_string()))
    }

    fn build_connection_string(&self, config: &ConnectionConfig) -> String {
        build_cassandra_connection_string(config)
    }

    async fn generate_table_ddl(&self, _pool: PoolRef<'_>, _table_name: &str) -> AppResult<String> {
        Err(AppError::NotSupported("Cassandra does not have DDL generation in this interface".to_string()))
    }

    async fn rename_table(
        &self,
        _pool: PoolRef<'_>,
        _old_name: &str,
        _new_name: &str,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Cassandra does not support table renaming".to_string()))
    }

    async fn get_indexes(&self, _pool: PoolRef<'_>, _table_name: &str) -> AppResult<Vec<IndexInfo>> {
        Err(AppError::NotSupported("Use Cassandra-specific index operations".to_string()))
    }

    async fn get_constraints(
        &self,
        _pool: PoolRef<'_>,
        _table_name: &str,
    ) -> AppResult<Vec<ConstraintInfo>> {
        Err(AppError::NotSupported("Cassandra does not have SQL constraints".to_string()))
    }

    async fn get_table_properties(
        &self,
        _pool: PoolRef<'_>,
        _table_name: &str,
    ) -> AppResult<TableProperties> {
        Err(AppError::NotSupported("Cassandra does not have table properties in SQL format".to_string()))
    }

    async fn get_table_relationships(
        &self,
        _pool: PoolRef<'_>,
        _table_name: &str,
    ) -> AppResult<Vec<TableRelationship>> {
        Err(AppError::NotSupported("Cassandra does not have SQL relationships".to_string()))
    }

    async fn preview_query(&self, _pool: PoolRef<'_>, _sql: &str) -> AppResult<PreviewResult> {
        Err(AppError::NotSupported("Cassandra does not support SQL query preview".to_string()))
    }

    async fn explain_query(
        &self,
        _pool: PoolRef<'_>,
        _sql: &str,
        _analyze: bool,
    ) -> AppResult<ExplainResult> {
        Err(AppError::NotSupported("Cassandra does not support SQL EXPLAIN".to_string()))
    }

    fn generate_create_table_ddl(&self, _table_def: &NewTableDefinition) -> AppResult<String> {
        Err(AppError::NotSupported("Cassandra does not have DDL generation in this interface".to_string()))
    }

    async fn get_referenceable_tables(
        &self,
        _pool: PoolRef<'_>,
    ) -> AppResult<Vec<TableReferenceInfo>> {
        Err(AppError::NotSupported("Cassandra does not have foreign keys".to_string()))
    }

    fn supports_user_management(&self) -> bool {
        false
    }

    async fn get_users(&self, _pool: PoolRef<'_>) -> AppResult<Vec<DatabaseUser>> {
        Err(AppError::NotSupported(
            "Cassandra user management requires specific CQL commands".to_string(),
        ))
    }

    async fn create_user(&self, _pool: PoolRef<'_>, _request: &CreateUserRequest) -> AppResult<()> {
        Err(AppError::NotSupported(
            "Cassandra user management requires specific CQL commands".to_string(),
        ))
    }

    async fn delete_user(
        &self,
        _pool: PoolRef<'_>,
        _username: &str,
        _host: Option<&str>,
    ) -> AppResult<()> {
        Err(AppError::NotSupported(
            "Cassandra user management requires specific CQL commands".to_string(),
        ))
    }

    async fn change_password(
        &self,
        _pool: PoolRef<'_>,
        _request: &ChangePasswordRequest,
    ) -> AppResult<()> {
        Err(AppError::NotSupported(
            "Cassandra user management requires specific CQL commands".to_string(),
        ))
    }

    async fn get_roles(&self, _pool: PoolRef<'_>) -> AppResult<Vec<DatabaseRole>> {
        Err(AppError::NotSupported("Use Cassandra-specific role commands".to_string()))
    }

    async fn create_role(&self, _pool: PoolRef<'_>, _request: &CreateRoleRequest) -> AppResult<()> {
        Err(AppError::NotSupported("Use Cassandra-specific role commands".to_string()))
    }

    async fn delete_role(&self, _pool: PoolRef<'_>, _role_name: &str) -> AppResult<()> {
        Err(AppError::NotSupported("Use Cassandra-specific role commands".to_string()))
    }

    async fn get_permissions(
        &self,
        _pool: PoolRef<'_>,
        _grantee: &str,
        _host: Option<&str>,
    ) -> AppResult<Vec<DatabasePermission>> {
        Err(AppError::NotSupported("Cassandra does not have SQL permissions".to_string()))
    }

    async fn get_available_privileges(
        &self,
        _pool: PoolRef<'_>,
    ) -> AppResult<AvailablePrivileges> {
        Err(AppError::NotSupported("Cassandra does not have SQL privileges".to_string()))
    }

    async fn grant_permission(
        &self,
        _pool: PoolRef<'_>,
        _request: &PermissionRequest,
    ) -> AppResult<()> {
        Err(AppError::NotSupported("Cassandra does not have SQL permissions".to_string()))
    }

    async fn revoke_permission(
        &self,
        _pool: PoolRef<'_>,
        _request: &PermissionRequest,
    ) -> AppResult<()> {
        Err(AppError::NotSupported("Cassandra does not have SQL permissions".to_string()))
    }

    async fn grant_role(
        &self,
        _pool: PoolRef<'_>,
        _request: &RoleMembershipRequest,
    ) -> AppResult<()> {
        Err(AppError::NotSupported("Use Cassandra-specific role commands".to_string()))
    }

    async fn revoke_role(
        &self,
        _pool: PoolRef<'_>,
        _request: &RoleMembershipRequest,
    ) -> AppResult<()> {
        Err(AppError::NotSupported("Use Cassandra-specific role commands".to_string()))
    }

    async fn get_views(
        &self,
        _pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<ViewInfo>> {
        Err(AppError::NotSupported("Cassandra materialized views require specific CQL".to_string()))
    }

    async fn get_view_ddl(&self, _pool: PoolRef<'_>, _view_name: &str) -> AppResult<String> {
        Err(AppError::NotSupported("Cassandra materialized views require specific CQL".to_string()))
    }

    async fn create_view(
        &self,
        _pool: PoolRef<'_>,
        _view_def: &NewViewDefinition,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Cassandra materialized views require specific CQL".to_string()))
    }

    async fn drop_view(&self, _pool: PoolRef<'_>, _view_name: &str) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Cassandra materialized views require specific CQL".to_string()))
    }

    async fn get_all_indexes(
        &self,
        _pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<StandaloneIndexInfo>> {
        Err(AppError::NotSupported("Use Cassandra-specific index operations".to_string()))
    }

    async fn get_index_ddl(
        &self,
        _pool: PoolRef<'_>,
        _index_name: &str,
        _table_name: Option<&str>,
    ) -> AppResult<String> {
        Err(AppError::NotSupported("Cassandra does not have index DDL".to_string()))
    }

    async fn create_index(
        &self,
        _pool: PoolRef<'_>,
        _index_def: &CreateIndexDefinition,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Use Cassandra-specific index operations".to_string()))
    }

    async fn drop_index(
        &self,
        _pool: PoolRef<'_>,
        _index_name: &str,
        _table_name: Option<&str>,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Use Cassandra-specific index operations".to_string()))
    }

    async fn get_procedures(
        &self,
        _pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<ProcedureInfo>> {
        Err(AppError::NotSupported("Cassandra does not have stored procedures".to_string()))
    }

    async fn get_procedure_ddl(
        &self,
        _pool: PoolRef<'_>,
        _procedure_name: &str,
    ) -> AppResult<String> {
        Err(AppError::NotSupported("Cassandra does not have stored procedures".to_string()))
    }

    async fn create_procedure(
        &self,
        _pool: PoolRef<'_>,
        _procedure_def: &NewProcedureDefinition,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Cassandra does not have stored procedures".to_string()))
    }

    async fn drop_procedure(
        &self,
        _pool: PoolRef<'_>,
        _procedure_name: &str,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Cassandra does not have stored procedures".to_string()))
    }

    async fn get_functions(
        &self,
        _pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<FunctionInfo>> {
        Err(AppError::NotSupported("Use Cassandra-specific UDF operations".to_string()))
    }

    async fn get_function_ddl(&self, _pool: PoolRef<'_>, _function_name: &str) -> AppResult<String> {
        Err(AppError::NotSupported("Use Cassandra-specific UDF operations".to_string()))
    }

    async fn create_function(
        &self,
        _pool: PoolRef<'_>,
        _function_def: &NewFunctionDefinition,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Use Cassandra-specific UDF operations".to_string()))
    }

    async fn drop_function(
        &self,
        _pool: PoolRef<'_>,
        _function_name: &str,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Use Cassandra-specific UDF operations".to_string()))
    }

    async fn get_triggers(
        &self,
        _pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<TriggerInfo>> {
        Err(AppError::NotSupported("Cassandra does not have SQL triggers".to_string()))
    }

    async fn get_trigger_ddl(
        &self,
        _pool: PoolRef<'_>,
        _trigger_name: &str,
        _table_name: Option<&str>,
    ) -> AppResult<String> {
        Err(AppError::NotSupported("Cassandra does not have SQL triggers".to_string()))
    }

    async fn create_trigger(
        &self,
        _pool: PoolRef<'_>,
        _trigger_def: &NewTriggerDefinition,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Cassandra does not have SQL triggers".to_string()))
    }

    async fn drop_trigger(
        &self,
        _pool: PoolRef<'_>,
        _trigger_name: &str,
        _table_name: Option<&str>,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Cassandra does not have SQL triggers".to_string()))
    }

    async fn get_sequences(
        &self,
        _pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<SequenceInfo>> {
        Err(AppError::NotSupported("Cassandra does not have sequences".to_string()))
    }

    async fn get_sequence_ddl(&self, _pool: PoolRef<'_>, _sequence_name: &str) -> AppResult<String> {
        Err(AppError::NotSupported("Cassandra does not have sequences".to_string()))
    }

    async fn create_sequence(
        &self,
        _pool: PoolRef<'_>,
        _sequence_def: &NewSequenceDefinition,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Cassandra does not have sequences".to_string()))
    }

    async fn drop_sequence(
        &self,
        _pool: PoolRef<'_>,
        _sequence_name: &str,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Cassandra does not have sequences".to_string()))
    }
}
