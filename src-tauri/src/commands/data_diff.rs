use crate::db::{data_diff, get_connection_manager, get_driver};
use crate::error::{AppError, AppResult};
use crate::models::{DataCompareQueryRequest, DataCompareResult, DataCompareTableRequest};
use crate::storage;

/// Compare data between two tables
#[tauri::command]
pub async fn compare_table_data(
    request: DataCompareTableRequest,
) -> AppResult<DataCompareResult> {
    let manager = get_connection_manager().read().await;

    // Verify source connection
    if !manager.is_connected(&request.source_connection_id) {
        return Err(AppError::ConnectionError(
            "Source connection not found or not connected".to_string(),
        ));
    }

    // Verify target connection
    if !manager.is_connected(&request.target_connection_id) {
        return Err(AppError::ConnectionError(
            "Target connection not found or not connected".to_string(),
        ));
    }

    let source_config = storage::get_connection(&request.source_connection_id)?
        .ok_or_else(|| AppError::ConfigError("Source connection config not found".to_string()))?;
    let target_config = storage::get_connection(&request.target_connection_id)?
        .ok_or_else(|| AppError::ConfigError("Target connection config not found".to_string()))?;

    let source_driver = get_driver(&source_config);
    let target_driver = get_driver(&target_config);

    // Auto-detect key columns from primary keys if not specified
    let mut options = request.options.clone();
    if options.key_columns.is_empty() {
        let source_pool_ref = manager.get_pool_ref(&request.source_connection_id)?;
        if let Ok(props) = source_driver
            .get_table_properties(source_pool_ref, &request.source_table_name)
            .await
        {
            if !props.primary_keys.is_empty() {
                options.key_columns = props.primary_keys;
            }
        }
    }

    // Execute queries on both tables
    let source_sql = format!(
        "SELECT * FROM {} LIMIT {}",
        request.source_table_name, options.max_rows
    );
    let target_sql = format!(
        "SELECT * FROM {} LIMIT {}",
        request.target_table_name, options.max_rows
    );

    let source_pool_ref = manager.get_pool_ref(&request.source_connection_id)?;
    let source_result = source_driver
        .execute_query(source_pool_ref, &source_sql)
        .await?;

    let target_pool_ref = manager.get_pool_ref(&request.target_connection_id)?;
    let target_result = target_driver
        .execute_query(target_pool_ref, &target_sql)
        .await?;

    Ok(data_diff::compare_results(
        &source_result,
        &target_result,
        &options,
        &request.source_table_name,
        &request.target_table_name,
    ))
}

/// Compare data from two custom queries
#[tauri::command]
pub async fn compare_query_data(
    request: DataCompareQueryRequest,
) -> AppResult<DataCompareResult> {
    let manager = get_connection_manager().read().await;

    // Verify source connection
    if !manager.is_connected(&request.source_connection_id) {
        return Err(AppError::ConnectionError(
            "Source connection not found or not connected".to_string(),
        ));
    }

    // Verify target connection
    if !manager.is_connected(&request.target_connection_id) {
        return Err(AppError::ConnectionError(
            "Target connection not found or not connected".to_string(),
        ));
    }

    let source_config = storage::get_connection(&request.source_connection_id)?
        .ok_or_else(|| AppError::ConfigError("Source connection config not found".to_string()))?;
    let target_config = storage::get_connection(&request.target_connection_id)?
        .ok_or_else(|| AppError::ConfigError("Target connection config not found".to_string()))?;

    let source_driver = get_driver(&source_config);
    let target_driver = get_driver(&target_config);

    let source_pool_ref = manager.get_pool_ref(&request.source_connection_id)?;
    let source_result = source_driver
        .execute_query(source_pool_ref, &request.source_sql)
        .await?;

    let target_pool_ref = manager.get_pool_ref(&request.target_connection_id)?;
    let target_result = target_driver
        .execute_query(target_pool_ref, &request.target_sql)
        .await?;

    let source_label = if request.source_sql.len() > 50 {
        format!("{}...", &request.source_sql[..50])
    } else {
        request.source_sql.clone()
    };
    let target_label = if request.target_sql.len() > 50 {
        format!("{}...", &request.target_sql[..50])
    } else {
        request.target_sql.clone()
    };

    Ok(data_diff::compare_results(
        &source_result,
        &target_result,
        &request.options,
        &source_label,
        &target_label,
    ))
}
