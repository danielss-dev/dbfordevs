use crate::error::{AppError, AppResult};
use crate::models::{ConnectionConfig, SslMode};
use async_trait::async_trait;
use deadpool_redis::{Config, Pool, Runtime};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Instant;

/// Pool type for Redis connections
pub type RedisPool = Pool;

/// Redis key types
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RedisKeyType {
    String,
    List,
    Set,
    ZSet,
    Hash,
    Stream,
    Unknown,
}

impl From<&str> for RedisKeyType {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "string" => RedisKeyType::String,
            "list" => RedisKeyType::List,
            "set" => RedisKeyType::Set,
            "zset" => RedisKeyType::ZSet,
            "hash" => RedisKeyType::Hash,
            "stream" => RedisKeyType::Stream,
            _ => RedisKeyType::Unknown,
        }
    }
}

/// Information about a Redis key
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedisKeyInfo {
    pub key: String,
    pub key_type: RedisKeyType,
    pub ttl: i64, // -1 = no expiry, -2 = key doesn't exist
    pub size: Option<i64>, // Memory size in bytes (if available)
}

/// Result from SCAN operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedisScanResult {
    pub cursor: u64,
    pub keys: Vec<RedisKeyInfo>,
    pub has_more: bool,
}

/// Scan result for set/hash members
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedisScanMembersResult {
    pub cursor: u64,
    pub members: Vec<String>,
    pub has_more: bool,
}

/// Scan result for hash fields
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedisScanHashResult {
    pub cursor: u64,
    pub fields: Vec<RedisHashField>,
    pub has_more: bool,
}

/// String value with encoding info
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedisStringValue {
    pub value: String,
    pub encoding: Option<String>,
}

/// List value with pagination info
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedisListValue {
    pub values: Vec<String>,
    pub total_length: i64,
}

/// Set value with cardinality
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedisSetValue {
    pub members: Vec<String>,
    pub cardinality: i64,
}

/// Hash field
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedisHashField {
    pub field: String,
    pub value: String,
}

/// Hash value with total field count
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedisHashValue {
    pub fields: Vec<RedisHashField>,
    pub total_fields: i64,
}

/// Sorted set member with score
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedisZSetMember {
    pub member: String,
    pub score: f64,
}

/// Sorted set value with cardinality
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedisZSetValue {
    pub members: Vec<RedisZSetMember>,
    pub cardinality: i64,
}

/// Stream entry
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedisStreamEntry {
    pub id: String,
    pub fields: HashMap<String, String>,
}

/// Stream value with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedisStreamValue {
    pub entries: Vec<RedisStreamEntry>,
    pub length: i64,
    pub first_entry_id: Option<String>,
    pub last_entry_id: Option<String>,
}

/// Redis server information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedisServerInfo {
    pub version: String,
    pub mode: String, // standalone, cluster, sentinel
    pub os: String,
    pub uptime_seconds: i64,
    pub connected_clients: i64,
    pub used_memory: i64,
    pub used_memory_human: String,
    pub used_memory_peak: i64,
    pub used_memory_peak_human: String,
    pub total_system_memory: Option<i64>,
    pub total_connections_received: i64,
    pub total_commands_processed: i64,
    pub keyspace: HashMap<String, RedisKeyspaceInfo>,
    pub role: String, // master, slave
}

/// Keyspace info per database
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedisKeyspaceInfo {
    pub keys: i64,
    pub expires: i64,
    pub avg_ttl: Option<i64>,
}

/// Memory statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedisMemoryStats {
    pub used_memory: i64,
    pub used_memory_human: String,
    pub used_memory_rss: i64,
    pub used_memory_peak: i64,
    pub used_memory_peak_human: String,
    pub used_memory_lua: i64,
    pub maxmemory: i64,
    pub maxmemory_policy: String,
    pub mem_fragmentation_ratio: f64,
    pub mem_allocator: String,
}

/// Result from executing a Redis command
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedisCommandResult {
    pub output: String,
    pub execution_time_ms: u64,
    pub error: Option<String>,
}

/// Pub/Sub message
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedisPubSubMessage {
    pub channel: String,
    pub message: String,
    pub timestamp: i64,
}

/// Build Redis connection string from config
pub fn build_redis_connection_string(config: &ConnectionConfig) -> String {
    let host = config.host.as_deref().unwrap_or("localhost");
    let port = config.port.unwrap_or(6379);
    let password = config.password.as_deref().unwrap_or("");
    let database = config.database.parse::<u32>().unwrap_or(0);

    // Determine if TLS should be used based on SSL config
    let use_tls = config.ssl.as_ref()
        .map(|ssl| !matches!(ssl.mode, SslMode::Disable))
        .unwrap_or(false);

    // Use rediss:// for TLS connections, redis:// for plain connections
    let protocol = if use_tls { "rediss" } else { "redis" };

    if password.is_empty() {
        format!("{}://{}:{}/{}", protocol, host, port, database)
    } else {
        format!("{}://:{}@{}:{}/{}", protocol, password, host, port, database)
    }
}

/// Create a Redis connection pool
pub async fn create_redis_pool(connection_string: &str) -> AppResult<RedisPool> {
    let cfg = Config::from_url(connection_string);
    let pool = cfg
        .create_pool(Some(Runtime::Tokio1))
        .map_err(|e| AppError::ConnectionError(format!("Failed to create Redis pool: {}", e)))?;

    // Test the connection
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to connect to Redis: {}", e)))?;

    // Ping to verify connection
    let _: String = redis::cmd("PING")
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::ConnectionError(format!("Redis PING failed: {}", e)))?;

    Ok(pool)
}

/// Get server version for test connection
pub async fn get_server_version(pool: &RedisPool) -> AppResult<String> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let info: String = redis::cmd("INFO")
        .arg("server")
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to get Redis info: {}", e)))?;

    // Parse redis_version from info string
    for line in info.lines() {
        if line.starts_with("redis_version:") {
            return Ok(line.trim_start_matches("redis_version:").trim().to_string());
        }
    }

    Ok("Unknown".to_string())
}

/// Scan keys with pattern matching
pub async fn scan_keys(
    pool: &RedisPool,
    pattern: &str,
    count: usize,
    cursor: u64,
) -> AppResult<RedisScanResult> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let (new_cursor, keys): (u64, Vec<String>) = redis::cmd("SCAN")
        .arg(cursor)
        .arg("MATCH")
        .arg(pattern)
        .arg("COUNT")
        .arg(count)
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::QueryError(format!("SCAN failed: {}", e)))?;

    // Get key info for each key
    let mut key_infos = Vec::with_capacity(keys.len());
    for key in keys {
        let key_type: String = redis::cmd("TYPE")
            .arg(&key)
            .query_async(&mut conn)
            .await
            .unwrap_or_else(|_| "unknown".to_string());

        let ttl: i64 = conn.ttl(&key).await.unwrap_or(-2);

        // Try to get memory usage (Redis 4.0+)
        let size: Option<i64> = redis::cmd("MEMORY")
            .arg("USAGE")
            .arg(&key)
            .query_async(&mut conn)
            .await
            .ok();

        key_infos.push(RedisKeyInfo {
            key,
            key_type: RedisKeyType::from(key_type.as_str()),
            ttl,
            size,
        });
    }

    Ok(RedisScanResult {
        cursor: new_cursor,
        keys: key_infos,
        has_more: new_cursor != 0,
    })
}

/// Get info for a single key
pub async fn get_key_info(pool: &RedisPool, key: &str) -> AppResult<RedisKeyInfo> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let key_type: String = redis::cmd("TYPE")
        .arg(key)
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::QueryError(format!("TYPE failed: {}", e)))?;

    if key_type == "none" {
        return Err(AppError::QueryError(format!("Key '{}' does not exist", key)));
    }

    let ttl: i64 = conn
        .ttl(key)
        .await
        .map_err(|e| AppError::QueryError(format!("TTL failed: {}", e)))?;

    let size: Option<i64> = redis::cmd("MEMORY")
        .arg("USAGE")
        .arg(key)
        .query_async(&mut conn)
        .await
        .ok();

    Ok(RedisKeyInfo {
        key: key.to_string(),
        key_type: RedisKeyType::from(key_type.as_str()),
        ttl,
        size,
    })
}

/// Delete a key
pub async fn delete_key(pool: &RedisPool, key: &str) -> AppResult<bool> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let deleted: i64 = conn
        .del(key)
        .await
        .map_err(|e| AppError::QueryError(format!("DEL failed: {}", e)))?;

    Ok(deleted > 0)
}

/// Delete multiple keys
pub async fn delete_keys(pool: &RedisPool, keys: &[String]) -> AppResult<u64> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let deleted: u64 = conn
        .del(keys)
        .await
        .map_err(|e| AppError::QueryError(format!("DEL failed: {}", e)))?;

    Ok(deleted)
}

/// Set TTL on a key
pub async fn set_ttl(pool: &RedisPool, key: &str, ttl_seconds: i64) -> AppResult<bool> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let result = if ttl_seconds < 0 {
        // Remove expiry
        let persisted: i64 = redis::cmd("PERSIST")
            .arg(key)
            .query_async(&mut conn)
            .await
            .map_err(|e| AppError::QueryError(format!("PERSIST failed: {}", e)))?;
        persisted == 1
    } else {
        // Set expiry
        let expired: i64 = conn
            .expire(key, ttl_seconds)
            .await
            .map_err(|e| AppError::QueryError(format!("EXPIRE failed: {}", e)))?;
        expired == 1
    };

    Ok(result)
}

/// Rename a key
pub async fn rename_key(pool: &RedisPool, old_key: &str, new_key: &str) -> AppResult<bool> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let _: () = conn
        .rename(old_key, new_key)
        .await
        .map_err(|e| AppError::QueryError(format!("RENAME failed: {}", e)))?;

    Ok(true)
}

// ===== String Operations =====

/// Get a string value
pub async fn get_string(pool: &RedisPool, key: &str) -> AppResult<RedisStringValue> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let value: String = conn
        .get(key)
        .await
        .map_err(|e| AppError::QueryError(format!("GET failed: {}", e)))?;

    let encoding: Option<String> = redis::cmd("OBJECT")
        .arg("ENCODING")
        .arg(key)
        .query_async(&mut conn)
        .await
        .ok();

    Ok(RedisStringValue { value, encoding })
}

/// Set a string value
pub async fn set_string(
    pool: &RedisPool,
    key: &str,
    value: &str,
    ttl_seconds: Option<i64>,
) -> AppResult<bool> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    if let Some(ttl) = ttl_seconds {
        if ttl > 0 {
            let _: () = conn
                .set_ex(key, value, ttl as u64)
                .await
                .map_err(|e| AppError::QueryError(format!("SETEX failed: {}", e)))?;
        } else {
            let _: () = conn
                .set(key, value)
                .await
                .map_err(|e| AppError::QueryError(format!("SET failed: {}", e)))?;
        }
    } else {
        let _: () = conn
            .set(key, value)
            .await
            .map_err(|e| AppError::QueryError(format!("SET failed: {}", e)))?;
    }

    Ok(true)
}

// ===== List Operations =====

/// Get list values with range
pub async fn get_list(pool: &RedisPool, key: &str, start: i64, stop: i64) -> AppResult<RedisListValue> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let values: Vec<String> = conn
        .lrange(key, start as isize, stop as isize)
        .await
        .map_err(|e| AppError::QueryError(format!("LRANGE failed: {}", e)))?;

    let total_length: i64 = conn
        .llen(key)
        .await
        .map_err(|e| AppError::QueryError(format!("LLEN failed: {}", e)))?;

    Ok(RedisListValue {
        values,
        total_length,
    })
}

/// Push values to a list
pub async fn list_push(
    pool: &RedisPool,
    key: &str,
    values: &[String],
    left: bool,
) -> AppResult<u64> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let length: u64 = if left {
        conn.lpush(key, values)
            .await
            .map_err(|e| AppError::QueryError(format!("LPUSH failed: {}", e)))?
    } else {
        conn.rpush(key, values)
            .await
            .map_err(|e| AppError::QueryError(format!("RPUSH failed: {}", e)))?
    };

    Ok(length)
}

/// Set a list element at index
pub async fn list_set(pool: &RedisPool, key: &str, index: i64, value: &str) -> AppResult<bool> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let _: () = conn
        .lset(key, index as isize, value)
        .await
        .map_err(|e| AppError::QueryError(format!("LSET failed: {}", e)))?;

    Ok(true)
}

/// Remove elements from a list
pub async fn list_remove(pool: &RedisPool, key: &str, count: i64, value: &str) -> AppResult<u64> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let removed: u64 = conn
        .lrem(key, count as isize, value)
        .await
        .map_err(|e| AppError::QueryError(format!("LREM failed: {}", e)))?;

    Ok(removed)
}

// ===== Set Operations =====

/// Get set members with SSCAN
pub async fn get_set(
    pool: &RedisPool,
    key: &str,
    cursor: u64,
    count: usize,
) -> AppResult<RedisScanMembersResult> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let (new_cursor, members): (u64, Vec<String>) = redis::cmd("SSCAN")
        .arg(key)
        .arg(cursor)
        .arg("COUNT")
        .arg(count)
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::QueryError(format!("SSCAN failed: {}", e)))?;

    Ok(RedisScanMembersResult {
        cursor: new_cursor,
        members,
        has_more: new_cursor != 0,
    })
}

/// Get full set value
pub async fn get_set_full(pool: &RedisPool, key: &str) -> AppResult<RedisSetValue> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let members: Vec<String> = conn
        .smembers(key)
        .await
        .map_err(|e| AppError::QueryError(format!("SMEMBERS failed: {}", e)))?;

    let cardinality: i64 = conn
        .scard(key)
        .await
        .map_err(|e| AppError::QueryError(format!("SCARD failed: {}", e)))?;

    Ok(RedisSetValue {
        members,
        cardinality,
    })
}

/// Add members to a set
pub async fn set_add(pool: &RedisPool, key: &str, members: &[String]) -> AppResult<u64> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let added: u64 = conn
        .sadd(key, members)
        .await
        .map_err(|e| AppError::QueryError(format!("SADD failed: {}", e)))?;

    Ok(added)
}

/// Remove members from a set
pub async fn set_remove(pool: &RedisPool, key: &str, members: &[String]) -> AppResult<u64> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let removed: u64 = conn
        .srem(key, members)
        .await
        .map_err(|e| AppError::QueryError(format!("SREM failed: {}", e)))?;

    Ok(removed)
}

// ===== Hash Operations =====

/// Get hash fields with HSCAN
pub async fn get_hash(
    pool: &RedisPool,
    key: &str,
    cursor: u64,
    count: usize,
) -> AppResult<RedisScanHashResult> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let (new_cursor, field_values): (u64, Vec<String>) = redis::cmd("HSCAN")
        .arg(key)
        .arg(cursor)
        .arg("COUNT")
        .arg(count)
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::QueryError(format!("HSCAN failed: {}", e)))?;

    // Convert alternating field/value pairs to RedisHashField structs
    let mut fields = Vec::new();
    let mut iter = field_values.into_iter();
    while let (Some(field), Some(value)) = (iter.next(), iter.next()) {
        fields.push(RedisHashField { field, value });
    }

    Ok(RedisScanHashResult {
        cursor: new_cursor,
        fields,
        has_more: new_cursor != 0,
    })
}

/// Get full hash value
pub async fn get_hash_full(pool: &RedisPool, key: &str) -> AppResult<RedisHashValue> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let all_fields: HashMap<String, String> = conn
        .hgetall(key)
        .await
        .map_err(|e| AppError::QueryError(format!("HGETALL failed: {}", e)))?;

    let fields: Vec<RedisHashField> = all_fields
        .into_iter()
        .map(|(field, value)| RedisHashField { field, value })
        .collect();

    let total_fields: i64 = conn
        .hlen(key)
        .await
        .map_err(|e| AppError::QueryError(format!("HLEN failed: {}", e)))?;

    Ok(RedisHashValue {
        fields,
        total_fields,
    })
}

/// Set hash fields
pub async fn hash_set(pool: &RedisPool, key: &str, fields: &[RedisHashField]) -> AppResult<u64> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let field_values: Vec<(&str, &str)> = fields
        .iter()
        .map(|f| (f.field.as_str(), f.value.as_str()))
        .collect();

    let added: u64 = conn
        .hset_multiple(key, &field_values)
        .await
        .map_err(|e| AppError::QueryError(format!("HSET failed: {}", e)))?;

    Ok(added)
}

/// Delete hash fields
pub async fn hash_delete(pool: &RedisPool, key: &str, fields: &[String]) -> AppResult<u64> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let deleted: u64 = conn
        .hdel(key, fields)
        .await
        .map_err(|e| AppError::QueryError(format!("HDEL failed: {}", e)))?;

    Ok(deleted)
}

// ===== Sorted Set Operations =====

/// Get sorted set members with range
pub async fn get_zset(
    pool: &RedisPool,
    key: &str,
    start: i64,
    stop: i64,
    reverse: bool,
) -> AppResult<RedisZSetValue> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let members_with_scores: Vec<(String, f64)> = if reverse {
        conn.zrevrange_withscores(key, start as isize, stop as isize)
            .await
            .map_err(|e| AppError::QueryError(format!("ZREVRANGE failed: {}", e)))?
    } else {
        conn.zrange_withscores(key, start as isize, stop as isize)
            .await
            .map_err(|e| AppError::QueryError(format!("ZRANGE failed: {}", e)))?
    };

    let members: Vec<RedisZSetMember> = members_with_scores
        .into_iter()
        .map(|(member, score)| RedisZSetMember { member, score })
        .collect();

    let cardinality: i64 = conn
        .zcard(key)
        .await
        .map_err(|e| AppError::QueryError(format!("ZCARD failed: {}", e)))?;

    Ok(RedisZSetValue {
        members,
        cardinality,
    })
}

/// Add members to a sorted set
pub async fn zset_add(pool: &RedisPool, key: &str, members: &[RedisZSetMember]) -> AppResult<u64> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let items: Vec<(f64, &str)> = members
        .iter()
        .map(|m| (m.score, m.member.as_str()))
        .collect();

    let added: u64 = conn
        .zadd_multiple(key, &items)
        .await
        .map_err(|e| AppError::QueryError(format!("ZADD failed: {}", e)))?;

    Ok(added)
}

/// Remove members from a sorted set
pub async fn zset_remove(pool: &RedisPool, key: &str, members: &[String]) -> AppResult<u64> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let removed: u64 = conn
        .zrem(key, members)
        .await
        .map_err(|e| AppError::QueryError(format!("ZREM failed: {}", e)))?;

    Ok(removed)
}

/// Update score for a sorted set member
pub async fn zset_update_score(
    pool: &RedisPool,
    key: &str,
    member: &str,
    score: f64,
) -> AppResult<bool> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    // Use ZADD with XX flag to only update existing members
    let _: () = redis::cmd("ZADD")
        .arg(key)
        .arg("XX")
        .arg(score)
        .arg(member)
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::QueryError(format!("ZADD XX failed: {}", e)))?;

    Ok(true)
}

// ===== Stream Operations =====

/// Get stream entries
pub async fn get_stream(
    pool: &RedisPool,
    key: &str,
    start: &str,
    end: &str,
    count: Option<usize>,
) -> AppResult<RedisStreamValue> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    // Use XRANGE to get entries
    let mut cmd = redis::cmd("XRANGE");
    cmd.arg(key).arg(start).arg(end);
    if let Some(c) = count {
        cmd.arg("COUNT").arg(c);
    }

    let raw_entries: Vec<(String, Vec<(String, String)>)> = cmd
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::QueryError(format!("XRANGE failed: {}", e)))?;

    let entries: Vec<RedisStreamEntry> = raw_entries
        .into_iter()
        .map(|(id, field_values)| {
            let mut fields = HashMap::new();
            let mut iter = field_values.into_iter();
            while let Some((field, value)) = iter.next() {
                fields.insert(field, value);
            }
            RedisStreamEntry { id, fields }
        })
        .collect();

    // Get stream length
    let length: i64 = redis::cmd("XLEN")
        .arg(key)
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::QueryError(format!("XLEN failed: {}", e)))?;

    // Get stream info for first/last entry IDs
    let info: HashMap<String, redis::Value> = redis::cmd("XINFO")
        .arg("STREAM")
        .arg(key)
        .query_async(&mut conn)
        .await
        .unwrap_or_default();

    let first_entry_id = extract_stream_id(&info, "first-entry");
    let last_entry_id = extract_stream_id(&info, "last-entry");

    Ok(RedisStreamValue {
        entries,
        length,
        first_entry_id,
        last_entry_id,
    })
}

fn extract_stream_id(info: &HashMap<String, redis::Value>, key: &str) -> Option<String> {
    if let Some(redis::Value::Array(entry)) = info.get(key) {
        if let Some(redis::Value::BulkString(id)) = entry.first() {
            return String::from_utf8(id.clone()).ok();
        }
    }
    None
}

/// Add entry to a stream
pub async fn stream_add(
    pool: &RedisPool,
    key: &str,
    fields: &HashMap<String, String>,
    id: Option<&str>,
) -> AppResult<String> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let mut cmd = redis::cmd("XADD");
    cmd.arg(key).arg(id.unwrap_or("*"));

    for (field, value) in fields {
        cmd.arg(field).arg(value);
    }

    let entry_id: String = cmd
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::QueryError(format!("XADD failed: {}", e)))?;

    Ok(entry_id)
}

/// Delete entries from a stream
pub async fn stream_delete(pool: &RedisPool, key: &str, ids: &[String]) -> AppResult<u64> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let mut cmd = redis::cmd("XDEL");
    cmd.arg(key);
    for id in ids {
        cmd.arg(id);
    }

    let deleted: u64 = cmd
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::QueryError(format!("XDEL failed: {}", e)))?;

    Ok(deleted)
}

// ===== CLI Operations =====

/// Parse a Redis command string respecting quoted arguments
fn parse_redis_command(command: &str) -> Vec<String> {
    let mut args = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut quote_char = ' ';
    let mut chars = command.chars().peekable();

    while let Some(c) = chars.next() {
        match c {
            '"' | '\'' if !in_quotes => {
                in_quotes = true;
                quote_char = c;
            }
            c if in_quotes && c == quote_char => {
                in_quotes = false;
            }
            ' ' | '\t' if !in_quotes => {
                if !current.is_empty() {
                    args.push(current.clone());
                    current.clear();
                }
            }
            '\\' if in_quotes => {
                // Handle escape sequences
                if let Some(&next) = chars.peek() {
                    match next {
                        'n' => { current.push('\n'); chars.next(); }
                        't' => { current.push('\t'); chars.next(); }
                        'r' => { current.push('\r'); chars.next(); }
                        '\\' => { current.push('\\'); chars.next(); }
                        '"' => { current.push('"'); chars.next(); }
                        '\'' => { current.push('\''); chars.next(); }
                        _ => current.push(c),
                    }
                } else {
                    current.push(c);
                }
            }
            _ => current.push(c),
        }
    }

    if !current.is_empty() {
        args.push(current);
    }

    args
}

/// Execute arbitrary Redis command
pub async fn execute_command(pool: &RedisPool, command: &str) -> AppResult<RedisCommandResult> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let start = Instant::now();

    // Parse command into parts, respecting quoted strings
    let parts = parse_redis_command(command.trim());
    if parts.is_empty() {
        return Ok(RedisCommandResult {
            output: String::new(),
            execution_time_ms: 0,
            error: Some("Empty command".to_string()),
        });
    }

    let mut cmd = redis::cmd(&parts[0]);
    for arg in &parts[1..] {
        cmd.arg(arg);
    }

    let result: Result<redis::Value, redis::RedisError> = cmd.query_async(&mut conn).await;
    let execution_time_ms = start.elapsed().as_millis() as u64;

    match result {
        Ok(value) => Ok(RedisCommandResult {
            output: format_redis_value(&value),
            execution_time_ms,
            error: None,
        }),
        Err(e) => Ok(RedisCommandResult {
            output: String::new(),
            execution_time_ms,
            error: Some(e.to_string()),
        }),
    }
}

fn format_redis_value(value: &redis::Value) -> String {
    match value {
        redis::Value::Nil => "(nil)".to_string(),
        redis::Value::Int(i) => format!("(integer) {}", i),
        redis::Value::BulkString(bytes) => {
            String::from_utf8_lossy(bytes).to_string()
        }
        redis::Value::Array(arr) => {
            if arr.is_empty() {
                "(empty array)".to_string()
            } else {
                arr.iter()
                    .enumerate()
                    .map(|(i, v)| format!("{}) {}", i + 1, format_redis_value(v)))
                    .collect::<Vec<_>>()
                    .join("\n")
            }
        }
        redis::Value::SimpleString(s) => s.clone(),
        redis::Value::Okay => "OK".to_string(),
        redis::Value::Map(map) => {
            map.iter()
                .map(|(k, v)| format!("{}: {}", format_redis_value(k), format_redis_value(v)))
                .collect::<Vec<_>>()
                .join("\n")
        }
        redis::Value::Set(set) => {
            set.iter()
                .enumerate()
                .map(|(i, v)| format!("{}) {}", i + 1, format_redis_value(v)))
                .collect::<Vec<_>>()
                .join("\n")
        }
        redis::Value::Double(d) => format!("(double) {}", d),
        redis::Value::Boolean(b) => if *b { "(true)" } else { "(false)" }.to_string(),
        redis::Value::VerbatimString { format: _, text } => text.clone(),
        redis::Value::BigNumber(n) => format!("(big number) {}", n),
        redis::Value::Push { kind, data } => {
            format!(
                "(push) {} [{}]",
                kind,
                data.iter()
                    .map(format_redis_value)
                    .collect::<Vec<_>>()
                    .join(", ")
            )
        }
        redis::Value::ServerError(e) => format!("(error) {}", e.details().unwrap_or("Unknown error")),
        redis::Value::Attribute { data, attributes } => {
            let attrs: String = attributes
                .iter()
                .map(|(k, v)| format!("{}: {}", format_redis_value(k), format_redis_value(v)))
                .collect::<Vec<_>>()
                .join(", ");
            format!("{} (attributes: {{{}}})", format_redis_value(data), attrs)
        }
    }
}

// ===== Server Info Operations =====

/// Get Redis server info
pub async fn get_server_info(pool: &RedisPool) -> AppResult<RedisServerInfo> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let info: String = redis::cmd("INFO")
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::QueryError(format!("INFO failed: {}", e)))?;

    let mut version = String::new();
    let mut mode = "standalone".to_string();
    let mut os = String::new();
    let mut uptime_seconds: i64 = 0;
    let mut connected_clients: i64 = 0;
    let mut used_memory: i64 = 0;
    let mut used_memory_human = String::new();
    let mut used_memory_peak: i64 = 0;
    let mut used_memory_peak_human = String::new();
    let mut total_system_memory: Option<i64> = None;
    let mut total_connections_received: i64 = 0;
    let mut total_commands_processed: i64 = 0;
    let mut role = "master".to_string();
    let mut keyspace: HashMap<String, RedisKeyspaceInfo> = HashMap::new();

    for line in info.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        if let Some((key, value)) = line.split_once(':') {
            match key {
                "redis_version" => version = value.to_string(),
                "redis_mode" => mode = value.to_string(),
                "os" => os = value.to_string(),
                "uptime_in_seconds" => uptime_seconds = value.parse().unwrap_or(0),
                "connected_clients" => connected_clients = value.parse().unwrap_or(0),
                "used_memory" => used_memory = value.parse().unwrap_or(0),
                "used_memory_human" => used_memory_human = value.to_string(),
                "used_memory_peak" => used_memory_peak = value.parse().unwrap_or(0),
                "used_memory_peak_human" => used_memory_peak_human = value.to_string(),
                "total_system_memory" => total_system_memory = value.parse().ok(),
                "total_connections_received" => {
                    total_connections_received = value.parse().unwrap_or(0)
                }
                "total_commands_processed" => total_commands_processed = value.parse().unwrap_or(0),
                "role" => role = value.to_string(),
                k if k.starts_with("db") => {
                    // Parse keyspace info: db0:keys=123,expires=45,avg_ttl=0
                    let mut keys: i64 = 0;
                    let mut expires: i64 = 0;
                    let mut avg_ttl: Option<i64> = None;

                    for part in value.split(',') {
                        if let Some((pk, pv)) = part.split_once('=') {
                            match pk {
                                "keys" => keys = pv.parse().unwrap_or(0),
                                "expires" => expires = pv.parse().unwrap_or(0),
                                "avg_ttl" => avg_ttl = pv.parse().ok(),
                                _ => {}
                            }
                        }
                    }

                    keyspace.insert(
                        k.to_string(),
                        RedisKeyspaceInfo {
                            keys,
                            expires,
                            avg_ttl,
                        },
                    );
                }
                _ => {}
            }
        }
    }

    Ok(RedisServerInfo {
        version,
        mode,
        os,
        uptime_seconds,
        connected_clients,
        used_memory,
        used_memory_human,
        used_memory_peak,
        used_memory_peak_human,
        total_system_memory,
        total_connections_received,
        total_commands_processed,
        keyspace,
        role,
    })
}

/// Get memory stats
pub async fn get_memory_stats(pool: &RedisPool) -> AppResult<RedisMemoryStats> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let info: String = redis::cmd("INFO")
        .arg("memory")
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::QueryError(format!("INFO memory failed: {}", e)))?;

    let mut stats = RedisMemoryStats {
        used_memory: 0,
        used_memory_human: String::new(),
        used_memory_rss: 0,
        used_memory_peak: 0,
        used_memory_peak_human: String::new(),
        used_memory_lua: 0,
        maxmemory: 0,
        maxmemory_policy: String::new(),
        mem_fragmentation_ratio: 0.0,
        mem_allocator: String::new(),
    };

    for line in info.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        if let Some((key, value)) = line.split_once(':') {
            match key {
                "used_memory" => stats.used_memory = value.parse().unwrap_or(0),
                "used_memory_human" => stats.used_memory_human = value.to_string(),
                "used_memory_rss" => stats.used_memory_rss = value.parse().unwrap_or(0),
                "used_memory_peak" => stats.used_memory_peak = value.parse().unwrap_or(0),
                "used_memory_peak_human" => stats.used_memory_peak_human = value.to_string(),
                "used_memory_lua" => stats.used_memory_lua = value.parse().unwrap_or(0),
                "maxmemory" => stats.maxmemory = value.parse().unwrap_or(0),
                "maxmemory_policy" => stats.maxmemory_policy = value.to_string(),
                "mem_fragmentation_ratio" => {
                    stats.mem_fragmentation_ratio = value.parse().unwrap_or(0.0)
                }
                "mem_allocator" => stats.mem_allocator = value.to_string(),
                _ => {}
            }
        }
    }

    Ok(stats)
}

/// Flush the current database
pub async fn flush_db(pool: &RedisPool, async_mode: bool) -> AppResult<bool> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let mut cmd = redis::cmd("FLUSHDB");
    if async_mode {
        cmd.arg("ASYNC");
    }

    let _: () = cmd
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::QueryError(format!("FLUSHDB failed: {}", e)))?;

    Ok(true)
}

// ===== Pub/Sub Operations =====

/// Get list of active channels
pub async fn pubsub_channels(pool: &RedisPool, pattern: Option<&str>) -> AppResult<Vec<String>> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let mut cmd = redis::cmd("PUBSUB");
    cmd.arg("CHANNELS");
    if let Some(p) = pattern {
        cmd.arg(p);
    }

    let channels: Vec<String> = cmd
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::QueryError(format!("PUBSUB CHANNELS failed: {}", e)))?;

    Ok(channels)
}

/// Publish a message to a channel
pub async fn pubsub_publish(pool: &RedisPool, channel: &str, message: &str) -> AppResult<u64> {
    let mut conn = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

    let received: u64 = conn
        .publish(channel, message)
        .await
        .map_err(|e| AppError::QueryError(format!("PUBLISH failed: {}", e)))?;

    Ok(received)
}

// ===== DatabaseDriver trait implementation =====
// Redis doesn't fit the SQL-centric DatabaseDriver trait, but we implement it
// with NotSupported for most operations

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

pub struct RedisDriver;

#[async_trait]
impl DatabaseDriver for RedisDriver {
    async fn test_connection(&self, config: &ConnectionConfig) -> AppResult<TestConnectionResult> {
        let connection_string = build_redis_connection_string(config);
        match create_redis_pool(&connection_string).await {
            Ok(pool) => {
                let version = get_server_version(&pool).await.unwrap_or_else(|_| "Unknown".to_string());
                Ok(TestConnectionResult {
                    success: true,
                    message: "Connection successful".to_string(),
                    server_version: Some(format!("Redis {}", version)),
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
            "Redis does not support SQL queries. Use Redis-specific commands via the CLI.".to_string(),
        ))
    }

    async fn get_tables(&self, _pool: PoolRef<'_>, _config: &ConnectionConfig) -> AppResult<Vec<TableInfo>> {
        Err(AppError::NotSupported("Redis does not have tables".to_string()))
    }

    async fn get_table_schema(&self, _pool: PoolRef<'_>, _table_name: &str) -> AppResult<TableSchema> {
        Err(AppError::NotSupported("Redis does not have table schemas".to_string()))
    }

    async fn get_all_table_schemas(
        &self,
        _pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<TableSchema>> {
        Err(AppError::NotSupported("Redis does not have table schemas".to_string()))
    }

    fn build_connection_string(&self, config: &ConnectionConfig) -> String {
        build_redis_connection_string(config)
    }

    async fn generate_table_ddl(&self, _pool: PoolRef<'_>, _table_name: &str) -> AppResult<String> {
        Err(AppError::NotSupported("Redis does not have DDL".to_string()))
    }

    async fn rename_table(
        &self,
        _pool: PoolRef<'_>,
        _old_name: &str,
        _new_name: &str,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Redis does not have tables".to_string()))
    }

    async fn get_indexes(&self, _pool: PoolRef<'_>, _table_name: &str) -> AppResult<Vec<IndexInfo>> {
        Err(AppError::NotSupported("Redis does not have indexes".to_string()))
    }

    async fn get_constraints(
        &self,
        _pool: PoolRef<'_>,
        _table_name: &str,
    ) -> AppResult<Vec<ConstraintInfo>> {
        Err(AppError::NotSupported("Redis does not have constraints".to_string()))
    }

    async fn get_table_properties(
        &self,
        _pool: PoolRef<'_>,
        _table_name: &str,
    ) -> AppResult<TableProperties> {
        Err(AppError::NotSupported("Redis does not have table properties".to_string()))
    }

    async fn get_table_relationships(
        &self,
        _pool: PoolRef<'_>,
        _table_name: &str,
    ) -> AppResult<Vec<TableRelationship>> {
        Err(AppError::NotSupported("Redis does not have relationships".to_string()))
    }

    async fn preview_query(&self, _pool: PoolRef<'_>, _sql: &str) -> AppResult<PreviewResult> {
        Err(AppError::NotSupported("Redis does not support query preview".to_string()))
    }

    async fn explain_query(
        &self,
        _pool: PoolRef<'_>,
        _sql: &str,
        _analyze: bool,
    ) -> AppResult<ExplainResult> {
        Err(AppError::NotSupported("Redis does not support EXPLAIN".to_string()))
    }

    fn generate_create_table_ddl(&self, _table_def: &NewTableDefinition) -> AppResult<String> {
        Err(AppError::NotSupported("Redis does not have DDL".to_string()))
    }

    async fn get_referenceable_tables(
        &self,
        _pool: PoolRef<'_>,
    ) -> AppResult<Vec<TableReferenceInfo>> {
        Err(AppError::NotSupported("Redis does not have tables".to_string()))
    }

    fn supports_user_management(&self) -> bool {
        false
    }

    async fn get_users(&self, _pool: PoolRef<'_>) -> AppResult<Vec<DatabaseUser>> {
        Err(AppError::NotSupported(
            "Redis user management requires ACL commands".to_string(),
        ))
    }

    async fn create_user(&self, _pool: PoolRef<'_>, _request: &CreateUserRequest) -> AppResult<()> {
        Err(AppError::NotSupported(
            "Redis user management requires ACL commands".to_string(),
        ))
    }

    async fn delete_user(
        &self,
        _pool: PoolRef<'_>,
        _username: &str,
        _host: Option<&str>,
    ) -> AppResult<()> {
        Err(AppError::NotSupported(
            "Redis user management requires ACL commands".to_string(),
        ))
    }

    async fn change_password(
        &self,
        _pool: PoolRef<'_>,
        _request: &ChangePasswordRequest,
    ) -> AppResult<()> {
        Err(AppError::NotSupported(
            "Redis user management requires ACL commands".to_string(),
        ))
    }

    async fn get_roles(&self, _pool: PoolRef<'_>) -> AppResult<Vec<DatabaseRole>> {
        Err(AppError::NotSupported("Redis does not have roles".to_string()))
    }

    async fn create_role(&self, _pool: PoolRef<'_>, _request: &CreateRoleRequest) -> AppResult<()> {
        Err(AppError::NotSupported("Redis does not have roles".to_string()))
    }

    async fn delete_role(&self, _pool: PoolRef<'_>, _role_name: &str) -> AppResult<()> {
        Err(AppError::NotSupported("Redis does not have roles".to_string()))
    }

    async fn get_permissions(
        &self,
        _pool: PoolRef<'_>,
        _grantee: &str,
        _host: Option<&str>,
    ) -> AppResult<Vec<DatabasePermission>> {
        Err(AppError::NotSupported("Redis does not have SQL permissions".to_string()))
    }

    async fn get_available_privileges(
        &self,
        _pool: PoolRef<'_>,
    ) -> AppResult<AvailablePrivileges> {
        Err(AppError::NotSupported("Redis does not have SQL privileges".to_string()))
    }

    async fn grant_permission(
        &self,
        _pool: PoolRef<'_>,
        _request: &PermissionRequest,
    ) -> AppResult<()> {
        Err(AppError::NotSupported("Redis does not have SQL permissions".to_string()))
    }

    async fn revoke_permission(
        &self,
        _pool: PoolRef<'_>,
        _request: &PermissionRequest,
    ) -> AppResult<()> {
        Err(AppError::NotSupported("Redis does not have SQL permissions".to_string()))
    }

    async fn grant_role(
        &self,
        _pool: PoolRef<'_>,
        _request: &RoleMembershipRequest,
    ) -> AppResult<()> {
        Err(AppError::NotSupported("Redis does not have roles".to_string()))
    }

    async fn revoke_role(
        &self,
        _pool: PoolRef<'_>,
        _request: &RoleMembershipRequest,
    ) -> AppResult<()> {
        Err(AppError::NotSupported("Redis does not have roles".to_string()))
    }

    async fn get_views(
        &self,
        _pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<ViewInfo>> {
        Err(AppError::NotSupported("Redis does not have views".to_string()))
    }

    async fn get_view_ddl(&self, _pool: PoolRef<'_>, _view_name: &str) -> AppResult<String> {
        Err(AppError::NotSupported("Redis does not have views".to_string()))
    }

    async fn create_view(
        &self,
        _pool: PoolRef<'_>,
        _view_def: &NewViewDefinition,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Redis does not have views".to_string()))
    }

    async fn drop_view(&self, _pool: PoolRef<'_>, _view_name: &str) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Redis does not have views".to_string()))
    }

    async fn get_all_indexes(
        &self,
        _pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<StandaloneIndexInfo>> {
        Err(AppError::NotSupported("Redis does not have indexes".to_string()))
    }

    async fn get_index_ddl(
        &self,
        _pool: PoolRef<'_>,
        _index_name: &str,
        _table_name: Option<&str>,
    ) -> AppResult<String> {
        Err(AppError::NotSupported("Redis does not have indexes".to_string()))
    }

    async fn create_index(
        &self,
        _pool: PoolRef<'_>,
        _index_def: &CreateIndexDefinition,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Redis does not have indexes".to_string()))
    }

    async fn drop_index(
        &self,
        _pool: PoolRef<'_>,
        _index_name: &str,
        _table_name: Option<&str>,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Redis does not have indexes".to_string()))
    }

    async fn get_procedures(
        &self,
        _pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<ProcedureInfo>> {
        Err(AppError::NotSupported("Redis does not have stored procedures".to_string()))
    }

    async fn get_procedure_ddl(
        &self,
        _pool: PoolRef<'_>,
        _procedure_name: &str,
    ) -> AppResult<String> {
        Err(AppError::NotSupported("Redis does not have stored procedures".to_string()))
    }

    async fn create_procedure(
        &self,
        _pool: PoolRef<'_>,
        _procedure_def: &NewProcedureDefinition,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Redis does not have stored procedures".to_string()))
    }

    async fn drop_procedure(
        &self,
        _pool: PoolRef<'_>,
        _procedure_name: &str,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Redis does not have stored procedures".to_string()))
    }

    async fn get_functions(
        &self,
        _pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<FunctionInfo>> {
        Err(AppError::NotSupported("Redis does not have functions".to_string()))
    }

    async fn get_function_ddl(&self, _pool: PoolRef<'_>, _function_name: &str) -> AppResult<String> {
        Err(AppError::NotSupported("Redis does not have functions".to_string()))
    }

    async fn create_function(
        &self,
        _pool: PoolRef<'_>,
        _function_def: &NewFunctionDefinition,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Redis does not have functions".to_string()))
    }

    async fn drop_function(
        &self,
        _pool: PoolRef<'_>,
        _function_name: &str,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Redis does not have functions".to_string()))
    }

    async fn get_triggers(
        &self,
        _pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<TriggerInfo>> {
        Err(AppError::NotSupported("Redis does not have triggers".to_string()))
    }

    async fn get_trigger_ddl(
        &self,
        _pool: PoolRef<'_>,
        _trigger_name: &str,
        _table_name: Option<&str>,
    ) -> AppResult<String> {
        Err(AppError::NotSupported("Redis does not have triggers".to_string()))
    }

    async fn create_trigger(
        &self,
        _pool: PoolRef<'_>,
        _trigger_def: &NewTriggerDefinition,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Redis does not have triggers".to_string()))
    }

    async fn drop_trigger(
        &self,
        _pool: PoolRef<'_>,
        _trigger_name: &str,
        _table_name: Option<&str>,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Redis does not have triggers".to_string()))
    }

    async fn get_sequences(
        &self,
        _pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<SequenceInfo>> {
        Err(AppError::NotSupported("Redis does not have sequences".to_string()))
    }

    async fn get_sequence_ddl(&self, _pool: PoolRef<'_>, _sequence_name: &str) -> AppResult<String> {
        Err(AppError::NotSupported("Redis does not have sequences".to_string()))
    }

    async fn create_sequence(
        &self,
        _pool: PoolRef<'_>,
        _sequence_def: &NewSequenceDefinition,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Redis does not have sequences".to_string()))
    }

    async fn drop_sequence(
        &self,
        _pool: PoolRef<'_>,
        _sequence_name: &str,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Redis does not have sequences".to_string()))
    }
}
