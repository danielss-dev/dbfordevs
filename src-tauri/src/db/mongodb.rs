use crate::error::{AppError, AppResult};
use crate::models::ConnectionConfig;
use async_trait::async_trait;
use bson::{doc, oid::ObjectId, Bson, Document};
use mongodb::{
    options::{ClientOptions, CreateCollectionOptions, FindOptions, IndexOptions},
    Client, IndexModel,
};
use serde::{Deserialize, Serialize};
use std::time::Instant;

/// Pool type for MongoDB connections (Client acts as connection pool)
pub type MongoPool = Client;

/// Information about a MongoDB database
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MongoDatabaseInfo {
    pub name: String,
    pub size_bytes: i64,
    pub collection_count: i64,
    pub is_empty: bool,
}

/// Information about a MongoDB collection
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MongoCollectionInfo {
    pub name: String,
    pub document_count: i64,
    pub size_bytes: i64,
    pub index_count: i64,
    pub capped: bool,
}

/// Result from document query
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MongoQueryResult {
    pub documents: Vec<String>, // JSON strings
    pub total_count: i64,
    pub execution_time_ms: u64,
    pub has_more: bool,
}

/// Information about a MongoDB index
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MongoIndexInfo {
    pub name: String,
    pub keys: String, // JSON representation of key fields
    pub unique: bool,
    pub sparse: bool,
    pub ttl_seconds: Option<i64>,
}

/// Result from aggregation pipeline
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MongoAggregationResult {
    pub documents: Vec<String>, // JSON strings
    pub execution_time_ms: u64,
    pub stages_executed: i32,
}

/// MongoDB server information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MongoServerInfo {
    pub version: String,
    pub host: String,
    pub uptime_seconds: i64,
    pub connections_current: i64,
    pub connections_available: i64,
    pub storage_engine: String,
    pub replica_set: Option<String>,
}

/// Result from executing a MongoDB command
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MongoCommandResult {
    pub output: String,
    pub execution_time_ms: u64,
    pub ok: bool,
    pub error: Option<String>,
}

/// Result from update operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MongoUpdateResult {
    pub matched_count: i64,
    pub modified_count: i64,
    pub upserted_id: Option<String>,
}

/// Build MongoDB connection string from config
pub fn build_mongodb_connection_string(config: &ConnectionConfig) -> String {
    // Check if user provided a full connection string (e.g., for Atlas)
    if let Some(conn_str) = &config.connection_string {
        if config.use_connection_string.unwrap_or(false) && !conn_str.is_empty() {
            return conn_str.clone();
        }
    }

    let host = config.host.as_deref().unwrap_or("localhost");
    let port = config.port.unwrap_or(27017);
    let username = config.username.as_deref().unwrap_or("");
    let password = config.password.as_deref().unwrap_or("");
    let database = if config.database.is_empty() {
        "admin"
    } else {
        &config.database
    };

    // Build connection string
    if username.is_empty() {
        format!("mongodb://{}:{}/{}", host, port, database)
    } else {
        // URL encode credentials
        let encoded_user = urlencoding::encode(username);
        let encoded_pass = urlencoding::encode(password);
        format!(
            "mongodb://{}:{}@{}:{}/{}?authSource=admin",
            encoded_user, encoded_pass, host, port, database
        )
    }
}

/// Create a MongoDB client (connection pool)
pub async fn create_mongodb_pool(connection_string: &str) -> AppResult<MongoPool> {
    let client_options = ClientOptions::parse(connection_string)
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to parse MongoDB URI: {}", e)))?;

    let client = Client::with_options(client_options)
        .map_err(|e| AppError::ConnectionError(format!("Failed to create MongoDB client: {}", e)))?;

    // Test the connection with a ping
    client
        .database("admin")
        .run_command(doc! { "ping": 1 })
        .await
        .map_err(|e| AppError::ConnectionError(format!("MongoDB connection test failed: {}", e)))?;

    Ok(client)
}

/// Get server version for test connection
pub async fn get_server_version(pool: &MongoPool) -> AppResult<String> {
    let result = pool
        .database("admin")
        .run_command(doc! { "buildInfo": 1 })
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to get build info: {}", e)))?;

    let version = result
        .get_str("version")
        .unwrap_or("Unknown")
        .to_string();

    Ok(version)
}

// ===== Database Operations =====

/// List all databases
pub async fn list_databases(pool: &MongoPool) -> AppResult<Vec<MongoDatabaseInfo>> {
    let result = pool
        .database("admin")
        .run_command(doc! { "listDatabases": 1 })
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to list databases: {}", e)))?;

    let databases = result
        .get_array("databases")
        .map_err(|_| AppError::QueryError("Invalid response format".to_string()))?;

    let mut db_infos = Vec::new();
    for db in databases {
        if let Bson::Document(doc) = db {
            let name = doc.get_str("name").unwrap_or("").to_string();
            let size_bytes = doc.get_i64("sizeOnDisk").unwrap_or(0);
            let is_empty = doc.get_bool("empty").unwrap_or(false);

            // Get collection count
            let collection_count = pool
                .database(&name)
                .list_collection_names()
                .await
                .map(|names| names.len() as i64)
                .unwrap_or(0);

            db_infos.push(MongoDatabaseInfo {
                name,
                size_bytes,
                collection_count,
                is_empty,
            });
        }
    }

    Ok(db_infos)
}

/// Get database statistics
pub async fn get_database_stats(pool: &MongoPool, db_name: &str) -> AppResult<MongoDatabaseInfo> {
    let db = pool.database(db_name);

    let stats = db
        .run_command(doc! { "dbStats": 1 })
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to get database stats: {}", e)))?;

    let collection_count = db
        .list_collection_names()
        .await
        .map(|names| names.len() as i64)
        .unwrap_or(0);

    Ok(MongoDatabaseInfo {
        name: db_name.to_string(),
        size_bytes: stats.get_i64("dataSize").unwrap_or(0),
        collection_count,
        is_empty: collection_count == 0,
    })
}

/// Drop a database
pub async fn drop_database(pool: &MongoPool, db_name: &str) -> AppResult<bool> {
    pool.database(db_name)
        .drop()
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to drop database: {}", e)))?;

    Ok(true)
}

// ===== Collection Operations =====

/// List collections in a database
pub async fn list_collections(pool: &MongoPool, db_name: &str) -> AppResult<Vec<MongoCollectionInfo>> {
    let db = pool.database(db_name);
    let collections = db
        .list_collections()
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to list collections: {}", e)))?;

    use futures_util::TryStreamExt;
    let collection_specs: Vec<mongodb::results::CollectionSpecification> = collections
        .try_collect()
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to collect collections: {}", e)))?;

    let mut infos = Vec::new();
    for spec in collection_specs {
        let coll = db.collection::<Document>(&spec.name);

        // Get document count
        let document_count = coll
            .estimated_document_count()
            .await
            .unwrap_or(0) as i64;

        // Get collection stats
        let stats = db
            .run_command(doc! { "collStats": &spec.name })
            .await
            .ok();

        let size_bytes = stats
            .as_ref()
            .and_then(|s| s.get_i64("size").ok())
            .unwrap_or(0);

        // Get index count
        let index_count = coll
            .list_index_names()
            .await
            .map(|names| names.len() as i64)
            .unwrap_or(0);

        let capped = spec.options.capped.unwrap_or(false);

        infos.push(MongoCollectionInfo {
            name: spec.name,
            document_count,
            size_bytes,
            index_count,
            capped,
        });
    }

    Ok(infos)
}

/// Get collection statistics
pub async fn get_collection_stats(
    pool: &MongoPool,
    db_name: &str,
    collection_name: &str,
) -> AppResult<MongoCollectionInfo> {
    let db = pool.database(db_name);
    let coll = db.collection::<Document>(collection_name);

    let document_count = coll
        .estimated_document_count()
        .await
        .unwrap_or(0) as i64;

    let stats = db
        .run_command(doc! { "collStats": collection_name })
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to get collection stats: {}", e)))?;

    let size_bytes = stats.get_i64("size").unwrap_or(0);
    let capped = stats.get_bool("capped").unwrap_or(false);

    let index_count = coll
        .list_index_names()
        .await
        .map(|names| names.len() as i64)
        .unwrap_or(0);

    Ok(MongoCollectionInfo {
        name: collection_name.to_string(),
        document_count,
        size_bytes,
        index_count,
        capped,
    })
}

/// Create a new collection
pub async fn create_collection(
    pool: &MongoPool,
    db_name: &str,
    collection_name: &str,
    capped: bool,
    size: Option<i64>,
    max_docs: Option<i64>,
) -> AppResult<bool> {
    let db = pool.database(db_name);

    let mut options = CreateCollectionOptions::default();
    if capped {
        options.capped = Some(true);
        options.size = size.map(|s| s as u64);
        options.max = max_docs.map(|m| m as u64);
    }

    db.create_collection(collection_name)
        .with_options(options)
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to create collection: {}", e)))?;

    Ok(true)
}

/// Drop a collection
pub async fn drop_collection(
    pool: &MongoPool,
    db_name: &str,
    collection_name: &str,
) -> AppResult<bool> {
    pool.database(db_name)
        .collection::<Document>(collection_name)
        .drop()
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to drop collection: {}", e)))?;

    Ok(true)
}

/// Rename a collection
pub async fn rename_collection(
    pool: &MongoPool,
    db_name: &str,
    old_name: &str,
    new_name: &str,
) -> AppResult<bool> {
    let admin = pool.database("admin");
    admin
        .run_command(doc! {
            "renameCollection": format!("{}.{}", db_name, old_name),
            "to": format!("{}.{}", db_name, new_name)
        })
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to rename collection: {}", e)))?;

    Ok(true)
}

// ===== Document Operations =====

/// Find documents in a collection
pub async fn find_documents(
    pool: &MongoPool,
    db_name: &str,
    collection_name: &str,
    filter: Option<&str>,
    projection: Option<&str>,
    sort: Option<&str>,
    skip: u64,
    limit: i64,
) -> AppResult<MongoQueryResult> {
    let start = Instant::now();
    let coll = pool.database(db_name).collection::<Document>(collection_name);

    // Parse filter
    let filter_doc = if let Some(f) = filter {
        if f.trim().is_empty() {
            doc! {}
        } else {
            bson::from_slice(f.as_bytes())
                .or_else(|_| serde_json::from_str::<Document>(f).map_err(|e| e.to_string()))
                .map_err(|e| AppError::QueryError(format!("Invalid filter JSON: {}", e)))?
        }
    } else {
        doc! {}
    };

    // Parse projection
    let projection_doc = if let Some(p) = projection {
        if p.trim().is_empty() {
            None
        } else {
            Some(
                serde_json::from_str::<Document>(p)
                    .map_err(|e| AppError::QueryError(format!("Invalid projection JSON: {}", e)))?,
            )
        }
    } else {
        None
    };

    // Parse sort
    let sort_doc = if let Some(s) = sort {
        if s.trim().is_empty() {
            None
        } else {
            Some(
                serde_json::from_str::<Document>(s)
                    .map_err(|e| AppError::QueryError(format!("Invalid sort JSON: {}", e)))?,
            )
        }
    } else {
        None
    };

    // Get total count (without skip/limit)
    let total_count = coll
        .count_documents(filter_doc.clone())
        .await
        .unwrap_or(0) as i64;

    // Build find options
    let mut find_options = FindOptions::default();
    find_options.skip = Some(skip);
    find_options.limit = Some(limit);
    find_options.projection = projection_doc;
    find_options.sort = sort_doc;

    // Execute query
    use futures_util::TryStreamExt;
    let cursor = coll
        .find(filter_doc)
        .with_options(find_options)
        .await
        .map_err(|e| AppError::QueryError(format!("Find failed: {}", e)))?;

    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to collect documents: {}", e)))?;

    // Convert documents to JSON strings
    let documents: Vec<String> = docs
        .iter()
        .map(|doc| serde_json::to_string(doc).unwrap_or_else(|_| "{}".to_string()))
        .collect();

    let execution_time_ms = start.elapsed().as_millis() as u64;
    let has_more = (skip + documents.len() as u64) < total_count as u64;

    Ok(MongoQueryResult {
        documents,
        total_count,
        execution_time_ms,
        has_more,
    })
}

/// Insert a single document
pub async fn insert_one(
    pool: &MongoPool,
    db_name: &str,
    collection_name: &str,
    document: &str,
) -> AppResult<String> {
    let coll = pool.database(db_name).collection::<Document>(collection_name);

    let doc: Document = serde_json::from_str(document)
        .map_err(|e| AppError::QueryError(format!("Invalid document JSON: {}", e)))?;

    let result = coll
        .insert_one(doc)
        .await
        .map_err(|e| AppError::QueryError(format!("Insert failed: {}", e)))?;

    // Return the inserted ID as string
    match result.inserted_id {
        Bson::ObjectId(oid) => Ok(oid.to_hex()),
        other => Ok(format!("{}", other)),
    }
}

/// Insert multiple documents
pub async fn insert_many(
    pool: &MongoPool,
    db_name: &str,
    collection_name: &str,
    documents: &[String],
) -> AppResult<Vec<String>> {
    let coll = pool.database(db_name).collection::<Document>(collection_name);

    let docs: Vec<Document> = documents
        .iter()
        .map(|d| serde_json::from_str(d))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::QueryError(format!("Invalid document JSON: {}", e)))?;

    let result = coll
        .insert_many(docs)
        .await
        .map_err(|e| AppError::QueryError(format!("Insert many failed: {}", e)))?;

    // Return inserted IDs as strings
    let ids: Vec<String> = result
        .inserted_ids
        .values()
        .map(|id| match id {
            Bson::ObjectId(oid) => oid.to_hex(),
            other => format!("{}", other),
        })
        .collect();

    Ok(ids)
}

/// Update a document
pub async fn update_one(
    pool: &MongoPool,
    db_name: &str,
    collection_name: &str,
    filter: &str,
    update: &str,
    upsert: bool,
) -> AppResult<MongoUpdateResult> {
    let coll = pool.database(db_name).collection::<Document>(collection_name);

    let filter_doc: Document = serde_json::from_str(filter)
        .map_err(|e| AppError::QueryError(format!("Invalid filter JSON: {}", e)))?;

    let update_doc: Document = serde_json::from_str(update)
        .map_err(|e| AppError::QueryError(format!("Invalid update JSON: {}", e)))?;

    let result = coll
        .update_one(filter_doc, update_doc)
        .upsert(upsert)
        .await
        .map_err(|e| AppError::QueryError(format!("Update failed: {}", e)))?;

    let upserted_id = result.upserted_id.map(|id| match id {
        Bson::ObjectId(oid) => oid.to_hex(),
        other => format!("{}", other),
    });

    Ok(MongoUpdateResult {
        matched_count: result.matched_count as i64,
        modified_count: result.modified_count as i64,
        upserted_id,
    })
}

/// Update multiple documents
pub async fn update_many(
    pool: &MongoPool,
    db_name: &str,
    collection_name: &str,
    filter: &str,
    update: &str,
) -> AppResult<MongoUpdateResult> {
    let coll = pool.database(db_name).collection::<Document>(collection_name);

    let filter_doc: Document = serde_json::from_str(filter)
        .map_err(|e| AppError::QueryError(format!("Invalid filter JSON: {}", e)))?;

    let update_doc: Document = serde_json::from_str(update)
        .map_err(|e| AppError::QueryError(format!("Invalid update JSON: {}", e)))?;

    let result = coll
        .update_many(filter_doc, update_doc)
        .await
        .map_err(|e| AppError::QueryError(format!("Update many failed: {}", e)))?;

    Ok(MongoUpdateResult {
        matched_count: result.matched_count as i64,
        modified_count: result.modified_count as i64,
        upserted_id: None,
    })
}

/// Delete a single document
pub async fn delete_one(
    pool: &MongoPool,
    db_name: &str,
    collection_name: &str,
    filter: &str,
) -> AppResult<i64> {
    let coll = pool.database(db_name).collection::<Document>(collection_name);

    let filter_doc: Document = serde_json::from_str(filter)
        .map_err(|e| AppError::QueryError(format!("Invalid filter JSON: {}", e)))?;

    let result = coll
        .delete_one(filter_doc)
        .await
        .map_err(|e| AppError::QueryError(format!("Delete failed: {}", e)))?;

    Ok(result.deleted_count as i64)
}

/// Delete multiple documents
pub async fn delete_many(
    pool: &MongoPool,
    db_name: &str,
    collection_name: &str,
    filter: &str,
) -> AppResult<i64> {
    let coll = pool.database(db_name).collection::<Document>(collection_name);

    let filter_doc: Document = serde_json::from_str(filter)
        .map_err(|e| AppError::QueryError(format!("Invalid filter JSON: {}", e)))?;

    let result = coll
        .delete_many(filter_doc)
        .await
        .map_err(|e| AppError::QueryError(format!("Delete many failed: {}", e)))?;

    Ok(result.deleted_count as i64)
}

// ===== Index Operations =====

/// List indexes on a collection
pub async fn list_indexes(
    pool: &MongoPool,
    db_name: &str,
    collection_name: &str,
) -> AppResult<Vec<MongoIndexInfo>> {
    let coll = pool.database(db_name).collection::<Document>(collection_name);

    use futures_util::TryStreamExt;
    let cursor = coll
        .list_indexes()
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to list indexes: {}", e)))?;

    let indexes: Vec<IndexModel> = cursor
        .try_collect()
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to collect indexes: {}", e)))?;

    let mut infos = Vec::new();
    for index in indexes {
        let keys_json = serde_json::to_string(&index.keys).unwrap_or_else(|_| "{}".to_string());
        let options = index.options.as_ref();

        infos.push(MongoIndexInfo {
            name: options
                .and_then(|o| o.name.clone())
                .unwrap_or_else(|| "".to_string()),
            keys: keys_json,
            unique: options.and_then(|o| o.unique).unwrap_or(false),
            sparse: options.and_then(|o| o.sparse).unwrap_or(false),
            ttl_seconds: options
                .and_then(|o| o.expire_after)
                .map(|d| d.as_secs() as i64),
        });
    }

    Ok(infos)
}

/// Create an index
pub async fn create_index(
    pool: &MongoPool,
    db_name: &str,
    collection_name: &str,
    keys: &str,
    unique: bool,
    sparse: bool,
    name: Option<&str>,
) -> AppResult<String> {
    let coll = pool.database(db_name).collection::<Document>(collection_name);

    let keys_doc: Document = serde_json::from_str(keys)
        .map_err(|e| AppError::QueryError(format!("Invalid keys JSON: {}", e)))?;

    let mut options = IndexOptions::default();
    options.unique = Some(unique);
    options.sparse = Some(sparse);
    if let Some(n) = name {
        options.name = Some(n.to_string());
    }

    let index = IndexModel::builder()
        .keys(keys_doc)
        .options(options)
        .build();

    let result = coll
        .create_index(index)
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to create index: {}", e)))?;

    Ok(result.index_name)
}

/// Drop an index
pub async fn drop_index(
    pool: &MongoPool,
    db_name: &str,
    collection_name: &str,
    index_name: &str,
) -> AppResult<bool> {
    let coll = pool.database(db_name).collection::<Document>(collection_name);

    coll.drop_index(index_name)
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to drop index: {}", e)))?;

    Ok(true)
}

// ===== Aggregation Operations =====

/// Run an aggregation pipeline
pub async fn aggregate(
    pool: &MongoPool,
    db_name: &str,
    collection_name: &str,
    pipeline: &[String],
) -> AppResult<MongoAggregationResult> {
    let start = Instant::now();
    let coll = pool.database(db_name).collection::<Document>(collection_name);

    // Parse pipeline stages
    let stages: Vec<Document> = pipeline
        .iter()
        .map(|s| serde_json::from_str(s))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::QueryError(format!("Invalid pipeline stage JSON: {}", e)))?;

    let stages_executed = stages.len() as i32;

    use futures_util::TryStreamExt;
    let cursor = coll
        .aggregate(stages)
        .await
        .map_err(|e| AppError::QueryError(format!("Aggregation failed: {}", e)))?;

    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to collect aggregation results: {}", e)))?;

    let documents: Vec<String> = docs
        .iter()
        .map(|doc| serde_json::to_string(doc).unwrap_or_else(|_| "{}".to_string()))
        .collect();

    let execution_time_ms = start.elapsed().as_millis() as u64;

    Ok(MongoAggregationResult {
        documents,
        execution_time_ms,
        stages_executed,
    })
}

// ===== Server Operations =====

/// Get server information
pub async fn get_server_info(pool: &MongoPool) -> AppResult<MongoServerInfo> {
    let admin = pool.database("admin");

    // Get server status
    let status = admin
        .run_command(doc! { "serverStatus": 1 })
        .await
        .map_err(|e| AppError::QueryError(format!("Failed to get server status: {}", e)))?;

    // Get build info
    let build_info = admin
        .run_command(doc! { "buildInfo": 1 })
        .await
        .ok();

    let version = build_info
        .as_ref()
        .and_then(|b| b.get_str("version").ok())
        .unwrap_or("Unknown")
        .to_string();

    let host = status.get_str("host").unwrap_or("Unknown").to_string();
    let uptime_seconds = status.get_i64("uptime").unwrap_or(0);

    // Get connection info
    let connections = status.get_document("connections").ok();
    let connections_current = connections
        .and_then(|c| c.get_i64("current").ok())
        .unwrap_or(0);
    let connections_available = connections
        .and_then(|c| c.get_i64("available").ok())
        .unwrap_or(0);

    // Get storage engine
    let storage_engine = status
        .get_document("storageEngine")
        .ok()
        .and_then(|s| s.get_str("name").ok())
        .unwrap_or("Unknown")
        .to_string();

    // Get replica set name if applicable
    let replica_set = status
        .get_document("repl")
        .ok()
        .and_then(|r| r.get_str("setName").ok())
        .map(|s| s.to_string());

    Ok(MongoServerInfo {
        version,
        host,
        uptime_seconds,
        connections_current,
        connections_available,
        storage_engine,
        replica_set,
    })
}

/// Run an arbitrary MongoDB command
pub async fn run_command(
    pool: &MongoPool,
    db_name: &str,
    command: &str,
) -> AppResult<MongoCommandResult> {
    let start = Instant::now();
    let db = pool.database(db_name);

    let cmd_doc: Document = serde_json::from_str(command)
        .map_err(|e| AppError::QueryError(format!("Invalid command JSON: {}", e)))?;

    let result = db.run_command(cmd_doc).await;
    let execution_time_ms = start.elapsed().as_millis() as u64;

    match result {
        Ok(doc) => {
            let ok = doc.get_f64("ok").unwrap_or(0.0) == 1.0
                || doc.get_i32("ok").unwrap_or(0) == 1;
            let output = serde_json::to_string_pretty(&doc).unwrap_or_else(|_| "{}".to_string());
            Ok(MongoCommandResult {
                output,
                execution_time_ms,
                ok,
                error: None,
            })
        }
        Err(e) => Ok(MongoCommandResult {
            output: String::new(),
            execution_time_ms,
            ok: false,
            error: Some(e.to_string()),
        }),
    }
}

/// Get a document by its ObjectId
pub async fn get_document_by_id(
    pool: &MongoPool,
    db_name: &str,
    collection_name: &str,
    id: &str,
) -> AppResult<Option<String>> {
    let coll = pool.database(db_name).collection::<Document>(collection_name);

    // Try to parse as ObjectId first, then as a string
    let filter = if let Ok(oid) = ObjectId::parse_str(id) {
        doc! { "_id": oid }
    } else {
        doc! { "_id": id }
    };

    let result = coll
        .find_one(filter)
        .await
        .map_err(|e| AppError::QueryError(format!("Find one failed: {}", e)))?;

    Ok(result.map(|doc| serde_json::to_string(&doc).unwrap_or_else(|_| "{}".to_string())))
}

/// Replace a document entirely
pub async fn replace_one(
    pool: &MongoPool,
    db_name: &str,
    collection_name: &str,
    filter: &str,
    replacement: &str,
) -> AppResult<MongoUpdateResult> {
    let coll = pool.database(db_name).collection::<Document>(collection_name);

    let filter_doc: Document = serde_json::from_str(filter)
        .map_err(|e| AppError::QueryError(format!("Invalid filter JSON: {}", e)))?;

    let replacement_doc: Document = serde_json::from_str(replacement)
        .map_err(|e| AppError::QueryError(format!("Invalid replacement JSON: {}", e)))?;

    let result = coll
        .replace_one(filter_doc, replacement_doc)
        .await
        .map_err(|e| AppError::QueryError(format!("Replace failed: {}", e)))?;

    Ok(MongoUpdateResult {
        matched_count: result.matched_count as i64,
        modified_count: result.modified_count as i64,
        upserted_id: result.upserted_id.map(|id| match id {
            Bson::ObjectId(oid) => oid.to_hex(),
            other => format!("{}", other),
        }),
    })
}

// ===== DatabaseDriver trait implementation =====
// MongoDB doesn't fit the SQL-centric DatabaseDriver trait, but we implement it
// with NotSupported for most operations (same pattern as Redis)

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

pub struct MongoDriver;

#[async_trait]
impl DatabaseDriver for MongoDriver {
    async fn test_connection(&self, config: &ConnectionConfig) -> AppResult<TestConnectionResult> {
        let connection_string = build_mongodb_connection_string(config);
        match create_mongodb_pool(&connection_string).await {
            Ok(pool) => {
                let version = get_server_version(&pool).await.unwrap_or_else(|_| "Unknown".to_string());
                Ok(TestConnectionResult {
                    success: true,
                    message: "Connection successful".to_string(),
                    server_version: Some(format!("MongoDB {}", version)),
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
            "MongoDB does not support SQL queries. Use MongoDB-specific operations.".to_string(),
        ))
    }

    async fn get_tables(&self, _pool: PoolRef<'_>, _config: &ConnectionConfig) -> AppResult<Vec<TableInfo>> {
        Err(AppError::NotSupported("MongoDB does not have tables. Use collections.".to_string()))
    }

    async fn get_table_schema(&self, _pool: PoolRef<'_>, _table_name: &str) -> AppResult<TableSchema> {
        Err(AppError::NotSupported("MongoDB does not have table schemas".to_string()))
    }

    async fn get_all_table_schemas(
        &self,
        _pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<TableSchema>> {
        Err(AppError::NotSupported("MongoDB does not have table schemas".to_string()))
    }

    fn build_connection_string(&self, config: &ConnectionConfig) -> String {
        build_mongodb_connection_string(config)
    }

    async fn generate_table_ddl(&self, _pool: PoolRef<'_>, _table_name: &str) -> AppResult<String> {
        Err(AppError::NotSupported("MongoDB does not have DDL".to_string()))
    }

    async fn rename_table(
        &self,
        _pool: PoolRef<'_>,
        _old_name: &str,
        _new_name: &str,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("MongoDB does not have tables".to_string()))
    }

    async fn get_indexes(&self, _pool: PoolRef<'_>, _table_name: &str) -> AppResult<Vec<IndexInfo>> {
        Err(AppError::NotSupported("Use MongoDB-specific index operations".to_string()))
    }

    async fn get_constraints(
        &self,
        _pool: PoolRef<'_>,
        _table_name: &str,
    ) -> AppResult<Vec<ConstraintInfo>> {
        Err(AppError::NotSupported("MongoDB does not have SQL constraints".to_string()))
    }

    async fn get_table_properties(
        &self,
        _pool: PoolRef<'_>,
        _table_name: &str,
    ) -> AppResult<TableProperties> {
        Err(AppError::NotSupported("MongoDB does not have table properties".to_string()))
    }

    async fn get_table_relationships(
        &self,
        _pool: PoolRef<'_>,
        _table_name: &str,
    ) -> AppResult<Vec<TableRelationship>> {
        Err(AppError::NotSupported("MongoDB does not have SQL relationships".to_string()))
    }

    async fn preview_query(&self, _pool: PoolRef<'_>, _sql: &str) -> AppResult<PreviewResult> {
        Err(AppError::NotSupported("MongoDB does not support SQL query preview".to_string()))
    }

    async fn explain_query(
        &self,
        _pool: PoolRef<'_>,
        _sql: &str,
        _analyze: bool,
    ) -> AppResult<ExplainResult> {
        Err(AppError::NotSupported("MongoDB does not support SQL EXPLAIN".to_string()))
    }

    fn generate_create_table_ddl(&self, _table_def: &NewTableDefinition) -> AppResult<String> {
        Err(AppError::NotSupported("MongoDB does not have DDL".to_string()))
    }

    async fn get_referenceable_tables(
        &self,
        _pool: PoolRef<'_>,
    ) -> AppResult<Vec<TableReferenceInfo>> {
        Err(AppError::NotSupported("MongoDB does not have tables".to_string()))
    }

    fn supports_user_management(&self) -> bool {
        false
    }

    async fn get_users(&self, _pool: PoolRef<'_>) -> AppResult<Vec<DatabaseUser>> {
        Err(AppError::NotSupported(
            "MongoDB user management requires specific commands".to_string(),
        ))
    }

    async fn create_user(&self, _pool: PoolRef<'_>, _request: &CreateUserRequest) -> AppResult<()> {
        Err(AppError::NotSupported(
            "MongoDB user management requires specific commands".to_string(),
        ))
    }

    async fn delete_user(
        &self,
        _pool: PoolRef<'_>,
        _username: &str,
        _host: Option<&str>,
    ) -> AppResult<()> {
        Err(AppError::NotSupported(
            "MongoDB user management requires specific commands".to_string(),
        ))
    }

    async fn change_password(
        &self,
        _pool: PoolRef<'_>,
        _request: &ChangePasswordRequest,
    ) -> AppResult<()> {
        Err(AppError::NotSupported(
            "MongoDB user management requires specific commands".to_string(),
        ))
    }

    async fn get_roles(&self, _pool: PoolRef<'_>) -> AppResult<Vec<DatabaseRole>> {
        Err(AppError::NotSupported("Use MongoDB-specific role commands".to_string()))
    }

    async fn create_role(&self, _pool: PoolRef<'_>, _request: &CreateRoleRequest) -> AppResult<()> {
        Err(AppError::NotSupported("Use MongoDB-specific role commands".to_string()))
    }

    async fn delete_role(&self, _pool: PoolRef<'_>, _role_name: &str) -> AppResult<()> {
        Err(AppError::NotSupported("Use MongoDB-specific role commands".to_string()))
    }

    async fn get_permissions(
        &self,
        _pool: PoolRef<'_>,
        _grantee: &str,
        _host: Option<&str>,
    ) -> AppResult<Vec<DatabasePermission>> {
        Err(AppError::NotSupported("MongoDB does not have SQL permissions".to_string()))
    }

    async fn get_available_privileges(
        &self,
        _pool: PoolRef<'_>,
    ) -> AppResult<AvailablePrivileges> {
        Err(AppError::NotSupported("MongoDB does not have SQL privileges".to_string()))
    }

    async fn grant_permission(
        &self,
        _pool: PoolRef<'_>,
        _request: &PermissionRequest,
    ) -> AppResult<()> {
        Err(AppError::NotSupported("MongoDB does not have SQL permissions".to_string()))
    }

    async fn revoke_permission(
        &self,
        _pool: PoolRef<'_>,
        _request: &PermissionRequest,
    ) -> AppResult<()> {
        Err(AppError::NotSupported("MongoDB does not have SQL permissions".to_string()))
    }

    async fn grant_role(
        &self,
        _pool: PoolRef<'_>,
        _request: &RoleMembershipRequest,
    ) -> AppResult<()> {
        Err(AppError::NotSupported("Use MongoDB-specific role commands".to_string()))
    }

    async fn revoke_role(
        &self,
        _pool: PoolRef<'_>,
        _request: &RoleMembershipRequest,
    ) -> AppResult<()> {
        Err(AppError::NotSupported("Use MongoDB-specific role commands".to_string()))
    }

    async fn get_views(
        &self,
        _pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<ViewInfo>> {
        Err(AppError::NotSupported("MongoDB does not have SQL views".to_string()))
    }

    async fn get_view_ddl(&self, _pool: PoolRef<'_>, _view_name: &str) -> AppResult<String> {
        Err(AppError::NotSupported("MongoDB does not have SQL views".to_string()))
    }

    async fn create_view(
        &self,
        _pool: PoolRef<'_>,
        _view_def: &NewViewDefinition,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("MongoDB does not have SQL views".to_string()))
    }

    async fn drop_view(&self, _pool: PoolRef<'_>, _view_name: &str) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("MongoDB does not have SQL views".to_string()))
    }

    async fn get_all_indexes(
        &self,
        _pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<StandaloneIndexInfo>> {
        Err(AppError::NotSupported("Use MongoDB-specific index operations".to_string()))
    }

    async fn get_index_ddl(
        &self,
        _pool: PoolRef<'_>,
        _index_name: &str,
        _table_name: Option<&str>,
    ) -> AppResult<String> {
        Err(AppError::NotSupported("MongoDB does not have index DDL".to_string()))
    }

    async fn create_index(
        &self,
        _pool: PoolRef<'_>,
        _index_def: &CreateIndexDefinition,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Use MongoDB-specific index operations".to_string()))
    }

    async fn drop_index(
        &self,
        _pool: PoolRef<'_>,
        _index_name: &str,
        _table_name: Option<&str>,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("Use MongoDB-specific index operations".to_string()))
    }

    async fn get_procedures(
        &self,
        _pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<ProcedureInfo>> {
        Err(AppError::NotSupported("MongoDB does not have stored procedures".to_string()))
    }

    async fn get_procedure_ddl(
        &self,
        _pool: PoolRef<'_>,
        _procedure_name: &str,
    ) -> AppResult<String> {
        Err(AppError::NotSupported("MongoDB does not have stored procedures".to_string()))
    }

    async fn create_procedure(
        &self,
        _pool: PoolRef<'_>,
        _procedure_def: &NewProcedureDefinition,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("MongoDB does not have stored procedures".to_string()))
    }

    async fn drop_procedure(
        &self,
        _pool: PoolRef<'_>,
        _procedure_name: &str,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("MongoDB does not have stored procedures".to_string()))
    }

    async fn get_functions(
        &self,
        _pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<FunctionInfo>> {
        Err(AppError::NotSupported("MongoDB does not have SQL functions".to_string()))
    }

    async fn get_function_ddl(&self, _pool: PoolRef<'_>, _function_name: &str) -> AppResult<String> {
        Err(AppError::NotSupported("MongoDB does not have SQL functions".to_string()))
    }

    async fn create_function(
        &self,
        _pool: PoolRef<'_>,
        _function_def: &NewFunctionDefinition,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("MongoDB does not have SQL functions".to_string()))
    }

    async fn drop_function(
        &self,
        _pool: PoolRef<'_>,
        _function_name: &str,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("MongoDB does not have SQL functions".to_string()))
    }

    async fn get_triggers(
        &self,
        _pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<TriggerInfo>> {
        Err(AppError::NotSupported("MongoDB does not have SQL triggers".to_string()))
    }

    async fn get_trigger_ddl(
        &self,
        _pool: PoolRef<'_>,
        _trigger_name: &str,
        _table_name: Option<&str>,
    ) -> AppResult<String> {
        Err(AppError::NotSupported("MongoDB does not have SQL triggers".to_string()))
    }

    async fn create_trigger(
        &self,
        _pool: PoolRef<'_>,
        _trigger_def: &NewTriggerDefinition,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("MongoDB does not have SQL triggers".to_string()))
    }

    async fn drop_trigger(
        &self,
        _pool: PoolRef<'_>,
        _trigger_name: &str,
        _table_name: Option<&str>,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("MongoDB does not have SQL triggers".to_string()))
    }

    async fn get_sequences(
        &self,
        _pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<SequenceInfo>> {
        Err(AppError::NotSupported("MongoDB does not have sequences".to_string()))
    }

    async fn get_sequence_ddl(&self, _pool: PoolRef<'_>, _sequence_name: &str) -> AppResult<String> {
        Err(AppError::NotSupported("MongoDB does not have sequences".to_string()))
    }

    async fn create_sequence(
        &self,
        _pool: PoolRef<'_>,
        _sequence_def: &NewSequenceDefinition,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("MongoDB does not have sequences".to_string()))
    }

    async fn drop_sequence(
        &self,
        _pool: PoolRef<'_>,
        _sequence_name: &str,
    ) -> AppResult<QueryResult> {
        Err(AppError::NotSupported("MongoDB does not have sequences".to_string()))
    }
}
