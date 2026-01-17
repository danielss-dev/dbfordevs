use crate::db::get_connection_manager;
use crate::db::redis::{
    self, RedisCommandResult, RedisHashField, RedisHashValue, RedisKeyInfo, RedisListValue,
    RedisMemoryStats, RedisScanHashResult, RedisScanMembersResult, RedisScanResult,
    RedisServerInfo, RedisSetValue, RedisStreamValue, RedisStringValue, RedisZSetMember,
    RedisZSetValue, RedisPool,
};
use crate::error::{AppError, AppResult};
use crate::db::ConnectionPool;
use std::collections::HashMap;

/// Helper to get Redis pool from connection
async fn get_redis_pool(connection_id: &str) -> AppResult<&'static RedisPool> {
    let manager = get_connection_manager().read().await;
    let pool = manager
        .get_pool(connection_id)
        .ok_or_else(|| AppError::ConnectionError("Connection not found".to_string()))?;

    match pool {
        ConnectionPool::Redis(p) => {
            // SAFETY: We're returning a reference to a pool that lives as long as the connection manager
            // This is safe because the connection manager is a static singleton
            Ok(unsafe { std::mem::transmute::<&RedisPool, &'static RedisPool>(p) })
        }
        _ => Err(AppError::ConnectionError(
            "Connection is not a Redis connection".to_string(),
        )),
    }
}

// ===== Key Management Commands =====

#[tauri::command]
pub async fn redis_scan_keys(
    connection_id: String,
    pattern: String,
    count: usize,
    cursor: u64,
) -> AppResult<RedisScanResult> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::scan_keys(pool, &pattern, count, cursor).await
}

#[tauri::command]
pub async fn redis_get_key_info(connection_id: String, key: String) -> AppResult<RedisKeyInfo> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::get_key_info(pool, &key).await
}

#[tauri::command]
pub async fn redis_delete_key(connection_id: String, key: String) -> AppResult<bool> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::delete_key(pool, &key).await
}

#[tauri::command]
pub async fn redis_delete_keys(connection_id: String, keys: Vec<String>) -> AppResult<u64> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::delete_keys(pool, &keys).await
}

#[tauri::command]
pub async fn redis_set_ttl(
    connection_id: String,
    key: String,
    ttl_seconds: i64,
) -> AppResult<bool> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::set_ttl(pool, &key, ttl_seconds).await
}

#[tauri::command]
pub async fn redis_rename_key(
    connection_id: String,
    old_key: String,
    new_key: String,
) -> AppResult<bool> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::rename_key(pool, &old_key, &new_key).await
}

// ===== String Commands =====

#[tauri::command]
pub async fn redis_get_string(connection_id: String, key: String) -> AppResult<RedisStringValue> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::get_string(pool, &key).await
}

#[tauri::command]
pub async fn redis_set_string(
    connection_id: String,
    key: String,
    value: String,
    ttl_seconds: Option<i64>,
) -> AppResult<bool> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::set_string(pool, &key, &value, ttl_seconds).await
}

// ===== List Commands =====

#[tauri::command]
pub async fn redis_get_list(
    connection_id: String,
    key: String,
    start: i64,
    stop: i64,
) -> AppResult<RedisListValue> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::get_list(pool, &key, start, stop).await
}

#[tauri::command]
pub async fn redis_list_push(
    connection_id: String,
    key: String,
    values: Vec<String>,
    left: bool,
) -> AppResult<u64> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::list_push(pool, &key, &values, left).await
}

#[tauri::command]
pub async fn redis_list_set(
    connection_id: String,
    key: String,
    index: i64,
    value: String,
) -> AppResult<bool> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::list_set(pool, &key, index, &value).await
}

#[tauri::command]
pub async fn redis_list_remove(
    connection_id: String,
    key: String,
    count: i64,
    value: String,
) -> AppResult<u64> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::list_remove(pool, &key, count, &value).await
}

// ===== Set Commands =====

#[tauri::command]
pub async fn redis_get_set(
    connection_id: String,
    key: String,
    cursor: u64,
    count: usize,
) -> AppResult<RedisScanMembersResult> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::get_set(pool, &key, cursor, count).await
}

#[tauri::command]
pub async fn redis_get_set_full(connection_id: String, key: String) -> AppResult<RedisSetValue> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::get_set_full(pool, &key).await
}

#[tauri::command]
pub async fn redis_set_add(
    connection_id: String,
    key: String,
    members: Vec<String>,
) -> AppResult<u64> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::set_add(pool, &key, &members).await
}

#[tauri::command]
pub async fn redis_set_remove(
    connection_id: String,
    key: String,
    members: Vec<String>,
) -> AppResult<u64> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::set_remove(pool, &key, &members).await
}

// ===== Hash Commands =====

#[tauri::command]
pub async fn redis_get_hash(
    connection_id: String,
    key: String,
    cursor: u64,
    count: usize,
) -> AppResult<RedisScanHashResult> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::get_hash(pool, &key, cursor, count).await
}

#[tauri::command]
pub async fn redis_get_hash_full(connection_id: String, key: String) -> AppResult<RedisHashValue> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::get_hash_full(pool, &key).await
}

#[tauri::command]
pub async fn redis_hash_set(
    connection_id: String,
    key: String,
    fields: Vec<RedisHashField>,
) -> AppResult<u64> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::hash_set(pool, &key, &fields).await
}

#[tauri::command]
pub async fn redis_hash_delete(
    connection_id: String,
    key: String,
    fields: Vec<String>,
) -> AppResult<u64> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::hash_delete(pool, &key, &fields).await
}

// ===== Sorted Set Commands =====

#[tauri::command]
pub async fn redis_get_zset(
    connection_id: String,
    key: String,
    start: i64,
    stop: i64,
    reverse: bool,
) -> AppResult<RedisZSetValue> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::get_zset(pool, &key, start, stop, reverse).await
}

#[tauri::command]
pub async fn redis_zset_add(
    connection_id: String,
    key: String,
    members: Vec<RedisZSetMember>,
) -> AppResult<u64> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::zset_add(pool, &key, &members).await
}

#[tauri::command]
pub async fn redis_zset_remove(
    connection_id: String,
    key: String,
    members: Vec<String>,
) -> AppResult<u64> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::zset_remove(pool, &key, &members).await
}

#[tauri::command]
pub async fn redis_zset_update_score(
    connection_id: String,
    key: String,
    member: String,
    score: f64,
) -> AppResult<bool> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::zset_update_score(pool, &key, &member, score).await
}

// ===== Stream Commands =====

#[tauri::command]
pub async fn redis_get_stream(
    connection_id: String,
    key: String,
    start: String,
    end: String,
    count: Option<usize>,
) -> AppResult<RedisStreamValue> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::get_stream(pool, &key, &start, &end, count).await
}

#[tauri::command]
pub async fn redis_stream_add(
    connection_id: String,
    key: String,
    fields: HashMap<String, String>,
    id: Option<String>,
) -> AppResult<String> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::stream_add(pool, &key, &fields, id.as_deref()).await
}

#[tauri::command]
pub async fn redis_stream_delete(
    connection_id: String,
    key: String,
    ids: Vec<String>,
) -> AppResult<u64> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::stream_delete(pool, &key, &ids).await
}

// ===== CLI Commands =====

#[tauri::command]
pub async fn redis_execute_command(
    connection_id: String,
    command: String,
) -> AppResult<RedisCommandResult> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::execute_command(pool, &command).await
}

// ===== Server Info Commands =====

#[tauri::command]
pub async fn redis_get_info(connection_id: String) -> AppResult<RedisServerInfo> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::get_server_info(pool).await
}

#[tauri::command]
pub async fn redis_get_memory_stats(connection_id: String) -> AppResult<RedisMemoryStats> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::get_memory_stats(pool).await
}

#[tauri::command]
pub async fn redis_flush_db(connection_id: String, async_mode: bool) -> AppResult<bool> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::flush_db(pool, async_mode).await
}

// ===== Pub/Sub Commands =====

#[tauri::command]
pub async fn redis_pubsub_channels(
    connection_id: String,
    pattern: Option<String>,
) -> AppResult<Vec<String>> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::pubsub_channels(pool, pattern.as_deref()).await
}

#[tauri::command]
pub async fn redis_pubsub_publish(
    connection_id: String,
    channel: String,
    message: String,
) -> AppResult<u64> {
    let pool = get_redis_pool(&connection_id).await?;
    redis::pubsub_publish(pool, &channel, &message).await
}
