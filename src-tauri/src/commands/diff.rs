use crate::db::{diff, get_connection_manager, get_driver};
use crate::error::{AppError, AppResult};
use crate::models::{
    ComparisonMode, CreateSnapshotRequest, SchemaDiffRequest, SchemaDiffResult, SchemaSnapshot,
    TableProperties,
};
use crate::storage;
use chrono::Utc;
use uuid::Uuid;

/// Compare two table schemas and generate migration SQL
#[tauri::command]
pub async fn compare_table_schemas(request: SchemaDiffRequest) -> AppResult<SchemaDiffResult> {
    let manager = get_connection_manager().read().await;

    // Verify source connection exists
    if !manager.is_connected(&request.source_connection_id) {
        return Err(AppError::ConnectionError(
            "Source connection not found or not connected".to_string(),
        ));
    }

    // Get source table properties
    let source_config = storage::get_connection(&request.source_connection_id)?
        .ok_or_else(|| AppError::ConfigError("Source connection config not found".to_string()))?;

    let source_driver = get_driver(&source_config);
    let source_pool_ref = manager.get_pool_ref(&request.source_connection_id)?;
    let source_table = source_driver
        .get_table_properties(source_pool_ref, &request.source_table_name)
        .await?;

    // Get target table properties
    let target_table: TableProperties = match request.mode {
        ComparisonMode::Connections => {
            // Different connections
            if !manager.is_connected(&request.target_connection_id) {
                return Err(AppError::ConnectionError(
                    "Target connection not found or not connected".to_string(),
                ));
            }

            let target_config = storage::get_connection(&request.target_connection_id)?
                .ok_or_else(|| {
                    AppError::ConfigError("Target connection config not found".to_string())
                })?;

            let target_driver = get_driver(&target_config);
            let target_pool_ref = manager.get_pool_ref(&request.target_connection_id)?;
            target_driver
                .get_table_properties(target_pool_ref, &request.target_table_name)
                .await?
        }
        ComparisonMode::Schemas => {
            // Same connection, different schemas/tables
            // Need to get pool ref again since it was moved in the source_table call
            let pool_ref = manager.get_pool_ref(&request.source_connection_id)?;
            source_driver
                .get_table_properties(pool_ref, &request.target_table_name)
                .await?
        }
        ComparisonMode::Snapshot => {
            return Err(AppError::NotSupported(
                "Use compare_with_snapshot for snapshot comparisons".to_string(),
            ));
        }
    };

    // Determine the target table name for migration SQL generation
    let migration_target_table = if request.migration_direction == "target_to_source" {
        &request.source_table_name
    } else {
        &request.target_table_name
    };

    // Perform the comparison
    let (source_for_diff, target_for_diff) = if request.migration_direction == "target_to_source" {
        (&target_table, &source_table)
    } else {
        (&source_table, &target_table)
    };

    let result = diff::compare_schemas(
        source_for_diff,
        target_for_diff,
        &source_config.database_type,
        migration_target_table,
    );

    Ok(result)
}

/// Compare a table with a saved snapshot
#[tauri::command]
pub async fn compare_with_snapshot(
    connection_id: String,
    table_name: String,
    snapshot_id: String,
) -> AppResult<SchemaDiffResult> {
    let manager = get_connection_manager().read().await;

    // Verify connection exists
    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError(
            "Connection not found or not connected".to_string(),
        ));
    }

    // Get current table properties
    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;
    let current_table = driver.get_table_properties(pool_ref, &table_name).await?;

    // Get snapshot
    let snapshot = storage::get_snapshot(&snapshot_id)?
        .ok_or_else(|| AppError::ConfigError("Snapshot not found".to_string()))?;

    // Convert snapshot to TableProperties for comparison
    let snapshot_table = TableProperties {
        table_name: snapshot.table_name.clone(),
        schema: snapshot.schema_name.clone(),
        columns: snapshot.columns.clone(),
        primary_keys: snapshot.primary_keys.clone(),
        foreign_keys: snapshot.foreign_keys.clone(),
        indexes: snapshot.indexes.clone(),
        constraints: snapshot.constraints.clone(),
        row_count: None,
        table_comment: None,
    };

    // Compare current table against snapshot (current is source, snapshot is target)
    // This shows what changes have been made since the snapshot
    let result =
        diff::compare_schemas(&current_table, &snapshot_table, &config.database_type, &table_name);

    Ok(result)
}

/// Save a schema snapshot
#[tauri::command]
pub async fn save_schema_snapshot(request: CreateSnapshotRequest) -> AppResult<SchemaSnapshot> {
    let manager = get_connection_manager().read().await;

    // Verify connection exists
    if !manager.is_connected(&request.connection_id) {
        return Err(AppError::ConnectionError(
            "Connection not found or not connected".to_string(),
        ));
    }

    // Get current table properties
    let config = storage::get_connection(&request.connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&request.connection_id)?;
    let table_props = driver
        .get_table_properties(pool_ref, &request.table_name)
        .await?;

    // Create snapshot
    let snapshot = SchemaSnapshot {
        id: Uuid::new_v4().to_string(),
        name: request.snapshot_name,
        description: request.description,
        table_name: table_props.table_name,
        schema_name: table_props.schema,
        connection_id: request.connection_id,
        database_type: config.database_type,
        columns: table_props.columns,
        primary_keys: table_props.primary_keys,
        foreign_keys: table_props.foreign_keys,
        indexes: table_props.indexes,
        constraints: table_props.constraints,
        created_at: Utc::now().to_rfc3339(),
    };

    // Save snapshot
    storage::save_snapshot(&snapshot)?;

    Ok(snapshot)
}

/// List all saved schema snapshots
#[tauri::command]
pub async fn list_schema_snapshots() -> AppResult<Vec<SchemaSnapshot>> {
    storage::load_snapshots()
}

/// Delete a schema snapshot
#[tauri::command]
pub async fn delete_schema_snapshot(snapshot_id: String) -> AppResult<()> {
    storage::delete_snapshot(&snapshot_id)
}
