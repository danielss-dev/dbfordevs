use crate::db::get_connection_manager;
use crate::db::mongodb::{
    self, MongoAggregationResult, MongoCollectionInfo, MongoCommandResult, MongoDatabaseInfo,
    MongoIndexInfo, MongoPool, MongoQueryResult, MongoServerInfo, MongoUpdateResult,
};
use crate::db::ConnectionPool;
use crate::error::{AppError, AppResult};

/// Helper to get MongoDB pool from connection
async fn get_mongodb_pool(connection_id: &str) -> AppResult<&'static MongoPool> {
    let manager = get_connection_manager().read().await;
    let pool = manager
        .get_pool(connection_id)
        .ok_or_else(|| AppError::ConnectionError("Connection not found".to_string()))?;

    match pool {
        ConnectionPool::MongoDB(p) => {
            // SAFETY: We're returning a reference to a pool that lives as long as the connection manager
            // This is safe because the connection manager is a static singleton
            Ok(unsafe { std::mem::transmute::<&MongoPool, &'static MongoPool>(p) })
        }
        _ => Err(AppError::ConnectionError(
            "Connection is not a MongoDB connection".to_string(),
        )),
    }
}

// ===== Database Commands =====

#[tauri::command]
pub async fn mongodb_list_databases(connection_id: String) -> AppResult<Vec<MongoDatabaseInfo>> {
    let pool = get_mongodb_pool(&connection_id).await?;
    mongodb::list_databases(pool).await
}

#[tauri::command]
pub async fn mongodb_get_database_stats(
    connection_id: String,
    db_name: String,
) -> AppResult<MongoDatabaseInfo> {
    let pool = get_mongodb_pool(&connection_id).await?;
    mongodb::get_database_stats(pool, &db_name).await
}

#[tauri::command]
pub async fn mongodb_drop_database(connection_id: String, db_name: String) -> AppResult<bool> {
    let pool = get_mongodb_pool(&connection_id).await?;
    mongodb::drop_database(pool, &db_name).await
}

// ===== Collection Commands =====

#[tauri::command]
pub async fn mongodb_list_collections(
    connection_id: String,
    db_name: String,
) -> AppResult<Vec<MongoCollectionInfo>> {
    let pool = get_mongodb_pool(&connection_id).await?;
    mongodb::list_collections(pool, &db_name).await
}

#[tauri::command]
pub async fn mongodb_get_collection_stats(
    connection_id: String,
    db_name: String,
    collection_name: String,
) -> AppResult<MongoCollectionInfo> {
    let pool = get_mongodb_pool(&connection_id).await?;
    mongodb::get_collection_stats(pool, &db_name, &collection_name).await
}

#[tauri::command]
pub async fn mongodb_create_collection(
    connection_id: String,
    db_name: String,
    collection_name: String,
    capped: bool,
    size: Option<i64>,
    max_docs: Option<i64>,
) -> AppResult<bool> {
    let pool = get_mongodb_pool(&connection_id).await?;
    mongodb::create_collection(pool, &db_name, &collection_name, capped, size, max_docs).await
}

#[tauri::command]
pub async fn mongodb_drop_collection(
    connection_id: String,
    db_name: String,
    collection_name: String,
) -> AppResult<bool> {
    let pool = get_mongodb_pool(&connection_id).await?;
    mongodb::drop_collection(pool, &db_name, &collection_name).await
}

#[tauri::command]
pub async fn mongodb_rename_collection(
    connection_id: String,
    db_name: String,
    old_name: String,
    new_name: String,
) -> AppResult<bool> {
    let pool = get_mongodb_pool(&connection_id).await?;
    mongodb::rename_collection(pool, &db_name, &old_name, &new_name).await
}

// ===== Document Commands =====

#[tauri::command]
pub async fn mongodb_find_documents(
    connection_id: String,
    db_name: String,
    collection_name: String,
    filter: Option<String>,
    projection: Option<String>,
    sort: Option<String>,
    skip: u64,
    limit: i64,
) -> AppResult<MongoQueryResult> {
    let pool = get_mongodb_pool(&connection_id).await?;
    mongodb::find_documents(
        pool,
        &db_name,
        &collection_name,
        filter.as_deref(),
        projection.as_deref(),
        sort.as_deref(),
        skip,
        limit,
    )
    .await
}

#[tauri::command]
pub async fn mongodb_insert_document(
    connection_id: String,
    db_name: String,
    collection_name: String,
    document: String,
) -> AppResult<String> {
    let pool = get_mongodb_pool(&connection_id).await?;
    mongodb::insert_one(pool, &db_name, &collection_name, &document).await
}

#[tauri::command]
pub async fn mongodb_insert_documents(
    connection_id: String,
    db_name: String,
    collection_name: String,
    documents: Vec<String>,
) -> AppResult<Vec<String>> {
    let pool = get_mongodb_pool(&connection_id).await?;
    mongodb::insert_many(pool, &db_name, &collection_name, &documents).await
}

#[tauri::command]
pub async fn mongodb_update_document(
    connection_id: String,
    db_name: String,
    collection_name: String,
    filter: String,
    update: String,
    upsert: bool,
) -> AppResult<MongoUpdateResult> {
    let pool = get_mongodb_pool(&connection_id).await?;
    mongodb::update_one(pool, &db_name, &collection_name, &filter, &update, upsert).await
}

#[tauri::command]
pub async fn mongodb_update_documents(
    connection_id: String,
    db_name: String,
    collection_name: String,
    filter: String,
    update: String,
) -> AppResult<MongoUpdateResult> {
    let pool = get_mongodb_pool(&connection_id).await?;
    mongodb::update_many(pool, &db_name, &collection_name, &filter, &update).await
}

#[tauri::command]
pub async fn mongodb_delete_document(
    connection_id: String,
    db_name: String,
    collection_name: String,
    filter: String,
) -> AppResult<i64> {
    let pool = get_mongodb_pool(&connection_id).await?;
    mongodb::delete_one(pool, &db_name, &collection_name, &filter).await
}

#[tauri::command]
pub async fn mongodb_delete_documents(
    connection_id: String,
    db_name: String,
    collection_name: String,
    filter: String,
) -> AppResult<i64> {
    let pool = get_mongodb_pool(&connection_id).await?;
    mongodb::delete_many(pool, &db_name, &collection_name, &filter).await
}

#[tauri::command]
pub async fn mongodb_get_document_by_id(
    connection_id: String,
    db_name: String,
    collection_name: String,
    id: String,
) -> AppResult<Option<String>> {
    let pool = get_mongodb_pool(&connection_id).await?;
    mongodb::get_document_by_id(pool, &db_name, &collection_name, &id).await
}

#[tauri::command]
pub async fn mongodb_replace_document(
    connection_id: String,
    db_name: String,
    collection_name: String,
    filter: String,
    replacement: String,
) -> AppResult<MongoUpdateResult> {
    let pool = get_mongodb_pool(&connection_id).await?;
    mongodb::replace_one(pool, &db_name, &collection_name, &filter, &replacement).await
}

// ===== Index Commands =====

#[tauri::command]
pub async fn mongodb_list_indexes(
    connection_id: String,
    db_name: String,
    collection_name: String,
) -> AppResult<Vec<MongoIndexInfo>> {
    let pool = get_mongodb_pool(&connection_id).await?;
    mongodb::list_indexes(pool, &db_name, &collection_name).await
}

#[tauri::command]
pub async fn mongodb_create_index(
    connection_id: String,
    db_name: String,
    collection_name: String,
    keys: String,
    unique: bool,
    sparse: bool,
    name: Option<String>,
) -> AppResult<String> {
    let pool = get_mongodb_pool(&connection_id).await?;
    mongodb::create_index(
        pool,
        &db_name,
        &collection_name,
        &keys,
        unique,
        sparse,
        name.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn mongodb_drop_index(
    connection_id: String,
    db_name: String,
    collection_name: String,
    index_name: String,
) -> AppResult<bool> {
    let pool = get_mongodb_pool(&connection_id).await?;
    mongodb::drop_index(pool, &db_name, &collection_name, &index_name).await
}

// ===== Aggregation Commands =====

#[tauri::command]
pub async fn mongodb_aggregate(
    connection_id: String,
    db_name: String,
    collection_name: String,
    pipeline: Vec<String>,
) -> AppResult<MongoAggregationResult> {
    let pool = get_mongodb_pool(&connection_id).await?;
    mongodb::aggregate(pool, &db_name, &collection_name, &pipeline).await
}

// ===== Server Commands =====

#[tauri::command]
pub async fn mongodb_get_server_info(connection_id: String) -> AppResult<MongoServerInfo> {
    let pool = get_mongodb_pool(&connection_id).await?;
    mongodb::get_server_info(pool).await
}

#[tauri::command]
pub async fn mongodb_run_command(
    connection_id: String,
    db_name: String,
    command: String,
) -> AppResult<MongoCommandResult> {
    let pool = get_mongodb_pool(&connection_id).await?;
    mongodb::run_command(pool, &db_name, &command).await
}
