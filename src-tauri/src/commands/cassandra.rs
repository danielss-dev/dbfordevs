use crate::db::get_connection_manager;
use crate::db::cassandra::{
    self, CassandraColumnInfo, CassandraIndexInfo, CassandraKeyspaceInfo, CassandraPool,
    CassandraQueryResult, CassandraServerInfo, CassandraTableInfo,
};
use crate::db::ConnectionPool;
use crate::error::{AppError, AppResult};

/// Helper to get Cassandra pool from connection
async fn get_cassandra_pool(connection_id: &str) -> AppResult<&'static CassandraPool> {
    let manager = get_connection_manager().read().await;
    let pool = manager
        .get_pool(connection_id)
        .ok_or_else(|| AppError::ConnectionError("Connection not found".to_string()))?;

    match pool {
        ConnectionPool::Cassandra(p) => {
            // SAFETY: We're returning a reference to a pool that lives as long as the connection manager
            // This is safe because the connection manager is a static singleton
            Ok(unsafe { std::mem::transmute::<&CassandraPool, &'static CassandraPool>(p) })
        }
        _ => Err(AppError::ConnectionError(
            "Connection is not a Cassandra connection".to_string(),
        )),
    }
}

// ===== Keyspace Commands =====

#[tauri::command]
pub async fn cassandra_list_keyspaces(connection_id: String) -> AppResult<Vec<CassandraKeyspaceInfo>> {
    let pool = get_cassandra_pool(&connection_id).await?;
    cassandra::list_keyspaces(pool).await
}

#[tauri::command]
pub async fn cassandra_create_keyspace(
    connection_id: String,
    name: String,
    replication_strategy: String,
    replication_factor: i32,
    durable_writes: bool,
) -> AppResult<bool> {
    let pool = get_cassandra_pool(&connection_id).await?;
    cassandra::create_keyspace(pool, &name, &replication_strategy, replication_factor, durable_writes).await
}

#[tauri::command]
pub async fn cassandra_drop_keyspace(connection_id: String, keyspace: String) -> AppResult<bool> {
    let pool = get_cassandra_pool(&connection_id).await?;
    cassandra::drop_keyspace(pool, &keyspace).await
}

// ===== Table Commands =====

#[tauri::command]
pub async fn cassandra_list_tables(
    connection_id: String,
    keyspace: String,
) -> AppResult<Vec<CassandraTableInfo>> {
    let pool = get_cassandra_pool(&connection_id).await?;
    cassandra::list_tables(pool, &keyspace).await
}

#[tauri::command]
pub async fn cassandra_describe_table(
    connection_id: String,
    keyspace: String,
    table: String,
) -> AppResult<Vec<CassandraColumnInfo>> {
    let pool = get_cassandra_pool(&connection_id).await?;
    cassandra::describe_table(pool, &keyspace, &table).await
}

#[tauri::command]
pub async fn cassandra_drop_table(
    connection_id: String,
    keyspace: String,
    table: String,
) -> AppResult<bool> {
    let pool = get_cassandra_pool(&connection_id).await?;
    cassandra::drop_table(pool, &keyspace, &table).await
}

#[tauri::command]
pub async fn cassandra_truncate_table(
    connection_id: String,
    keyspace: String,
    table: String,
) -> AppResult<bool> {
    let pool = get_cassandra_pool(&connection_id).await?;
    cassandra::truncate_table(pool, &keyspace, &table).await
}

// ===== Query Commands =====

#[tauri::command]
pub async fn cassandra_execute_cql(
    connection_id: String,
    keyspace: Option<String>,
    cql: String,
    page_size: i32,
    paging_state: Option<String>,
    consistency: Option<String>,
) -> AppResult<CassandraQueryResult> {
    let pool = get_cassandra_pool(&connection_id).await?;
    cassandra::execute_cql(
        pool,
        keyspace.as_deref(),
        &cql,
        page_size,
        paging_state.as_deref(),
        consistency.as_deref(),
    )
    .await
}

// ===== Index Commands =====

#[tauri::command]
pub async fn cassandra_list_indexes(
    connection_id: String,
    keyspace: String,
) -> AppResult<Vec<CassandraIndexInfo>> {
    let pool = get_cassandra_pool(&connection_id).await?;
    cassandra::list_indexes(pool, &keyspace).await
}

// ===== Server Commands =====

#[tauri::command]
pub async fn cassandra_get_server_info(connection_id: String) -> AppResult<CassandraServerInfo> {
    let pool = get_cassandra_pool(&connection_id).await?;
    cassandra::get_server_info(pool).await
}
