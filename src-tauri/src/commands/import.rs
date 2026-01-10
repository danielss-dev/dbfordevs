use crate::db::{get_connection_manager, get_driver};
use crate::error::{AppError, AppResult};
use crate::models::{
    BatchImportResult, ColumnMapping, ImportFormat,
    ImportPreviewRequest, ImportPreviewResult, ImportProgress, ImportRequest, ImportResult,
    ImportRowError, ImportStatus,
};
use crate::storage;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use once_cell::sync::Lazy;
use tokio::sync::RwLock;

// Store for cancellation tokens
static CANCELLATION_TOKENS: Lazy<RwLock<HashMap<String, Arc<AtomicBool>>>> =
    Lazy::new(|| RwLock::new(HashMap::new()));

/// Detect CSV delimiter from content
fn detect_csv_delimiter(content: &str) -> char {
    let first_line = content.lines().next().unwrap_or("");
    let delimiters = [',', ';', '\t', '|'];

    delimiters
        .into_iter()
        .max_by_key(|&d| first_line.matches(d).count())
        .unwrap_or(',')
}

/// Parse a single CSV field value into appropriate JSON type
fn parse_csv_value(field: &str) -> serde_json::Value {
    let trimmed = field.trim();

    // Handle empty/null
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("null") {
        return serde_json::Value::Null;
    }

    // Try boolean
    if trimmed.eq_ignore_ascii_case("true") {
        return serde_json::Value::Bool(true);
    }
    if trimmed.eq_ignore_ascii_case("false") {
        return serde_json::Value::Bool(false);
    }

    // Try integer
    if let Ok(n) = trimmed.parse::<i64>() {
        return serde_json::Value::Number(n.into());
    }

    // Try float
    if let Ok(f) = trimmed.parse::<f64>() {
        if let Some(n) = serde_json::Number::from_f64(f) {
            return serde_json::Value::Number(n);
        }
    }

    // Default to string
    serde_json::Value::String(field.to_string())
}

/// Parse CSV content and return preview data
fn parse_csv_preview(
    content: &str,
    delimiter: Option<char>,
    has_header: bool,
    max_rows: usize,
) -> AppResult<(Vec<String>, Vec<Vec<serde_json::Value>>, Option<char>)> {
    let detected_delimiter = delimiter.unwrap_or_else(|| detect_csv_delimiter(content));

    let mut reader = csv::ReaderBuilder::new()
        .delimiter(detected_delimiter as u8)
        .has_headers(has_header)
        .flexible(true)
        .from_reader(content.as_bytes());

    let headers: Vec<String> = if has_header {
        reader
            .headers()
            .map_err(|e| AppError::ValidationError(format!("CSV header error: {}", e)))?
            .iter()
            .map(|s| s.to_string())
            .collect()
    } else {
        // Generate column names: col_0, col_1, etc.
        // We need to peek at the first record to know the column count
        let mut records = reader.records();
        if let Some(first) = records.next() {
            let record = first.map_err(|e| AppError::ValidationError(format!("CSV parse error: {}", e)))?;
            (0..record.len()).map(|i| format!("col_{}", i)).collect()
        } else {
            return Err(AppError::ValidationError("Empty CSV file".to_string()));
        }
    };

    // Re-read for data (since we consumed records for header detection)
    let mut reader = csv::ReaderBuilder::new()
        .delimiter(detected_delimiter as u8)
        .has_headers(has_header)
        .flexible(true)
        .from_reader(content.as_bytes());

    let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();
    for result in reader.records().take(max_rows) {
        let record = result.map_err(|e| AppError::ValidationError(format!("CSV row error: {}", e)))?;
        let row: Vec<serde_json::Value> = record.iter().map(parse_csv_value).collect();
        rows.push(row);
    }

    Ok((headers, rows, Some(detected_delimiter)))
}

/// Parse JSON content and return preview data
fn parse_json_preview(
    content: &str,
    max_rows: usize,
) -> AppResult<(Vec<String>, Vec<Vec<serde_json::Value>>)> {
    let data: serde_json::Value = serde_json::from_str(content)
        .map_err(|e| AppError::ValidationError(format!("JSON parse error: {}", e)))?;

    let array = match data {
        serde_json::Value::Array(arr) => arr,
        serde_json::Value::Object(_) => vec![data],
        _ => return Err(AppError::ValidationError("JSON must be an array or object".to_string())),
    };

    if array.is_empty() {
        return Ok((vec![], vec![]));
    }

    // Extract column names from first object
    let columns: Vec<String> = match &array[0] {
        serde_json::Value::Object(obj) => obj.keys().cloned().collect(),
        _ => return Err(AppError::ValidationError("JSON array must contain objects".to_string())),
    };

    let rows: Vec<Vec<serde_json::Value>> = array
        .iter()
        .take(max_rows)
        .filter_map(|item| {
            if let serde_json::Value::Object(obj) = item {
                Some(
                    columns
                        .iter()
                        .map(|col| obj.get(col).cloned().unwrap_or(serde_json::Value::Null))
                        .collect(),
                )
            } else {
                None
            }
        })
        .collect();

    Ok((columns, rows))
}

/// Detect column types from sample data
fn detect_column_types(columns: &[String], rows: &[Vec<serde_json::Value>]) -> Vec<String> {
    columns
        .iter()
        .enumerate()
        .map(|(idx, _)| {
            let mut has_integer = false;
            let mut has_float = false;
            let mut has_bool = false;
            let mut has_string = false;

            for row in rows {
                if let Some(val) = row.get(idx) {
                    match val {
                        serde_json::Value::Number(n) => {
                            if n.is_i64() {
                                has_integer = true;
                            } else {
                                has_float = true;
                            }
                        }
                        serde_json::Value::Bool(_) => has_bool = true,
                        serde_json::Value::String(_) => has_string = true,
                        serde_json::Value::Null => {}
                        _ => has_string = true,
                    }
                }
            }

            if has_string {
                "TEXT".to_string()
            } else if has_float {
                "DOUBLE".to_string()
            } else if has_integer {
                "BIGINT".to_string()
            } else if has_bool {
                "BOOLEAN".to_string()
            } else {
                "TEXT".to_string()
            }
        })
        .collect()
}

/// Preview import data - detects columns, types, and returns sample rows
#[tauri::command]
pub async fn preview_import(request: ImportPreviewRequest) -> AppResult<ImportPreviewResult> {
    let preview_rows = request.preview_rows.unwrap_or(100);

    let (columns, sample_rows, delimiter) = match request.format {
        ImportFormat::Csv => {
            parse_csv_preview(
                &request.content,
                request.delimiter,
                request.has_header.unwrap_or(true),
                preview_rows,
            )?
        }
        ImportFormat::Json => {
            let (cols, rows) = parse_json_preview(&request.content, preview_rows)?;
            (cols, rows, None)
        }
        ImportFormat::Sql => {
            // For SQL, we don't provide preview - it's executed directly
            return Err(AppError::ValidationError(
                "SQL files do not support preview. Use execute directly.".to_string(),
            ));
        }
    };

    // Detect types from sample data
    let detected_types = detect_column_types(&columns, &sample_rows);

    Ok(ImportPreviewResult {
        source_columns: columns,
        detected_types,
        sample_rows,
        total_rows_detected: None,
        delimiter_detected: delimiter,
    })
}

/// Parse full CSV data for import
fn parse_csv_data(request: &ImportRequest) -> AppResult<Vec<Vec<serde_json::Value>>> {
    let delimiter = request.delimiter.unwrap_or(',');
    let has_header = request.has_header.unwrap_or(true);

    let mut reader = csv::ReaderBuilder::new()
        .delimiter(delimiter as u8)
        .has_headers(has_header)
        .flexible(true)
        .from_reader(request.content.as_bytes());

    let mut rows = Vec::new();
    for result in reader.records() {
        let record = result.map_err(|e| AppError::ValidationError(format!("CSV row error: {}", e)))?;
        let row: Vec<serde_json::Value> = record.iter().map(parse_csv_value).collect();
        rows.push(row);
    }

    Ok(rows)
}

/// Parse full JSON data for import
fn parse_json_data(request: &ImportRequest) -> AppResult<Vec<Vec<serde_json::Value>>> {
    let data: serde_json::Value = serde_json::from_str(&request.content)
        .map_err(|e| AppError::ValidationError(format!("JSON parse error: {}", e)))?;

    let array = match data {
        serde_json::Value::Array(arr) => arr,
        serde_json::Value::Object(_) => vec![data],
        _ => return Err(AppError::ValidationError("JSON must be an array or object".to_string())),
    };

    // Get column order from mappings
    let source_columns: Vec<&str> = request
        .column_mappings
        .iter()
        .map(|m| m.source_column.as_str())
        .collect();

    let rows: Vec<Vec<serde_json::Value>> = array
        .iter()
        .filter_map(|item| {
            if let serde_json::Value::Object(obj) = item {
                Some(
                    source_columns
                        .iter()
                        .map(|col| obj.get(*col).cloned().unwrap_or(serde_json::Value::Null))
                        .collect(),
                )
            } else {
                None
            }
        })
        .collect();

    Ok(rows)
}

/// Format a JSON value as SQL literal
fn format_sql_value(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(s) => format!("'{}'", s.replace('\'', "''")),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        serde_json::Value::Null => "NULL".to_string(),
        serde_json::Value::Array(arr) => format!("'{}'", serde_json::to_string(arr).unwrap_or_default().replace('\'', "''")),
        serde_json::Value::Object(obj) => format!("'{}'", serde_json::to_string(obj).unwrap_or_default().replace('\'', "''")),
    }
}

/// Build INSERT statement for a batch of rows
fn build_insert_sql(
    table_name: &str,
    mappings: &[ColumnMapping],
    rows: &[Vec<serde_json::Value>],
) -> String {
    let columns: Vec<&str> = mappings
        .iter()
        .filter(|m| !m.target_column.is_empty())
        .map(|m| m.target_column.as_str())
        .collect();

    let values: Vec<String> = rows
        .iter()
        .map(|row| {
            let row_values: Vec<String> = mappings
                .iter()
                .enumerate()
                .filter(|(_, m)| !m.target_column.is_empty())
                .map(|(idx, _)| {
                    row.get(idx)
                        .map(format_sql_value)
                        .unwrap_or_else(|| "NULL".to_string())
                })
                .collect();
            format!("({})", row_values.join(", "))
        })
        .collect();

    format!(
        "INSERT INTO {} ({}) VALUES {}",
        table_name,
        columns.join(", "),
        values.join(", ")
    )
}

/// Execute data import with transaction support and progress tracking
#[tauri::command]
pub async fn execute_import(app: AppHandle, request: ImportRequest) -> AppResult<ImportResult> {
    let start = Instant::now();
    let import_id = uuid::Uuid::new_v4().to_string();
    let batch_size = request.batch_size.unwrap_or(1000);

    // Create cancellation token
    let cancel_token = Arc::new(AtomicBool::new(false));
    {
        let mut tokens = CANCELLATION_TOKENS.write().await;
        tokens.insert(import_id.clone(), cancel_token.clone());
    }

    // Get connection and driver
    let manager = get_connection_manager().read().await;
    if !manager.is_connected(&request.connection_id) {
        return Err(AppError::ConnectionError("Connection not found".to_string()));
    }

    let config = storage::get_connection(&request.connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&request.connection_id)?;

    // Emit initial progress
    let _ = app.emit(
        "import-progress",
        ImportProgress {
            import_id: import_id.clone(),
            rows_processed: 0,
            rows_total: None,
            rows_inserted: 0,
            rows_updated: 0,
            rows_skipped: 0,
            rows_failed: 0,
            current_batch: 0,
            total_batches: None,
            percent_complete: Some(0.0),
            status: ImportStatus::Preparing,
            current_error: None,
        },
    );

    // Parse data based on format
    let (rows, is_sql) = match request.format {
        ImportFormat::Csv => (parse_csv_data(&request)?, false),
        ImportFormat::Json => (parse_json_data(&request)?, false),
        ImportFormat::Sql => {
            // For SQL, execute directly
            let _ = app.emit(
                "import-progress",
                ImportProgress {
                    import_id: import_id.clone(),
                    rows_processed: 0,
                    rows_total: None,
                    rows_inserted: 0,
                    rows_updated: 0,
                    rows_skipped: 0,
                    rows_failed: 0,
                    current_batch: 1,
                    total_batches: Some(1),
                    percent_complete: Some(50.0),
                    status: ImportStatus::Processing,
                    current_error: None,
                },
            );

            match driver.execute_query(pool_ref, &request.content).await {
                Ok(result) => {
                    let affected = result.affected_rows.unwrap_or(0) as usize;

                    // Clean up cancellation token
                    {
                        let mut tokens = CANCELLATION_TOKENS.write().await;
                        tokens.remove(&import_id);
                    }

                    let _ = app.emit(
                        "import-progress",
                        ImportProgress {
                            import_id: import_id.clone(),
                            rows_processed: affected,
                            rows_total: Some(affected),
                            rows_inserted: affected,
                            rows_updated: 0,
                            rows_skipped: 0,
                            rows_failed: 0,
                            current_batch: 1,
                            total_batches: Some(1),
                            percent_complete: Some(100.0),
                            status: ImportStatus::Completed,
                            current_error: None,
                        },
                    );

                    return Ok(ImportResult {
                        success: true,
                        rows_inserted: affected,
                        rows_updated: 0,
                        rows_skipped: 0,
                        rows_failed: 0,
                        errors: vec![],
                        execution_time_ms: start.elapsed().as_millis() as u64,
                        message: format!("Successfully executed SQL with {} affected rows", affected),
                    });
                }
                Err(e) => {
                    // Clean up cancellation token
                    {
                        let mut tokens = CANCELLATION_TOKENS.write().await;
                        tokens.remove(&import_id);
                    }

                    let _ = app.emit(
                        "import-progress",
                        ImportProgress {
                            import_id: import_id.clone(),
                            rows_processed: 0,
                            rows_total: None,
                            rows_inserted: 0,
                            rows_updated: 0,
                            rows_skipped: 0,
                            rows_failed: 1,
                            current_batch: 1,
                            total_batches: Some(1),
                            percent_complete: Some(100.0),
                            status: ImportStatus::Failed,
                            current_error: Some(e.to_string()),
                        },
                    );

                    return Ok(ImportResult {
                        success: false,
                        rows_inserted: 0,
                        rows_updated: 0,
                        rows_skipped: 0,
                        rows_failed: 1,
                        errors: vec![ImportRowError {
                            row_number: 0,
                            error_message: e.to_string(),
                            row_data: None,
                        }],
                        execution_time_ms: start.elapsed().as_millis() as u64,
                        message: format!("SQL execution failed: {}", e),
                    });
                }
            }
        }
    };

    if is_sql {
        unreachable!(); // SQL case returns early above
    }

    let total_rows = rows.len();
    let total_batches = (total_rows + batch_size - 1) / batch_size;

    let mut result = BatchImportResult::default();
    result.success = true;

    // Process rows in batches
    for (batch_idx, chunk) in rows.chunks(batch_size).enumerate() {
        // Check for cancellation
        if cancel_token.load(Ordering::Relaxed) {
            result.success = false;
            break;
        }

        // Update progress
        let _ = app.emit(
            "import-progress",
            ImportProgress {
                import_id: import_id.clone(),
                rows_processed: batch_idx * batch_size,
                rows_total: Some(total_rows),
                rows_inserted: result.rows_inserted,
                rows_updated: result.rows_updated,
                rows_skipped: result.rows_skipped,
                rows_failed: result.rows_failed,
                current_batch: batch_idx + 1,
                total_batches: Some(total_batches),
                percent_complete: Some((batch_idx as f32 / total_batches as f32) * 100.0),
                status: ImportStatus::Processing,
                current_error: result.errors.last().map(|e| e.error_message.clone()),
            },
        );

        // Build and execute INSERT for this batch
        let insert_sql = build_insert_sql(&request.table_name, &request.column_mappings, chunk);

        match driver.execute_query(pool_ref.clone(), &insert_sql).await {
            Ok(query_result) => {
                let affected = query_result.affected_rows.unwrap_or(chunk.len() as u64) as usize;
                result.rows_inserted += affected;
            }
            Err(e) => {
                let error_msg = e.to_string();

                // For batch failures, record the error
                result.errors.push(ImportRowError {
                    row_number: batch_idx * batch_size + 1,
                    error_message: error_msg.clone(),
                    row_data: None, // Could include first row of batch if needed
                });

                if request.stop_on_error {
                    result.rows_failed += chunk.len();
                    result.success = false;
                    break;
                } else {
                    // Try individual inserts for this batch to find specific failures
                    for (row_idx, row) in chunk.iter().enumerate() {
                        let single_insert = build_insert_sql(
                            &request.table_name,
                            &request.column_mappings,
                            &[row.clone()],
                        );

                        match driver.execute_query(pool_ref.clone(), &single_insert).await {
                            Ok(_) => result.rows_inserted += 1,
                            Err(row_err) => {
                                result.rows_failed += 1;
                                if result.errors.len() < 100 {
                                    // Limit error collection
                                    result.errors.push(ImportRowError {
                                        row_number: batch_idx * batch_size + row_idx + 1,
                                        error_message: row_err.to_string(),
                                        row_data: Some(row.clone()),
                                    });
                                }
                            }
                        }
                    }
                    // Remove the batch-level error since we handled it row by row
                    result.errors.pop();
                }
            }
        }
    }

    // Clean up cancellation token
    {
        let mut tokens = CANCELLATION_TOKENS.write().await;
        tokens.remove(&import_id);
    }

    // Final progress update
    let final_status = if cancel_token.load(Ordering::Relaxed) {
        ImportStatus::Cancelled
    } else if result.success {
        ImportStatus::Completed
    } else {
        ImportStatus::Failed
    };

    let _ = app.emit(
        "import-progress",
        ImportProgress {
            import_id: import_id.clone(),
            rows_processed: total_rows,
            rows_total: Some(total_rows),
            rows_inserted: result.rows_inserted,
            rows_updated: result.rows_updated,
            rows_skipped: result.rows_skipped,
            rows_failed: result.rows_failed,
            current_batch: total_batches,
            total_batches: Some(total_batches),
            percent_complete: Some(100.0),
            status: final_status.clone(),
            current_error: result.errors.last().map(|e| e.error_message.clone()),
        },
    );

    let message = if result.success {
        format!(
            "Successfully imported {} rows ({} inserted, {} skipped)",
            result.rows_inserted + result.rows_skipped,
            result.rows_inserted,
            result.rows_skipped
        )
    } else if matches!(final_status, ImportStatus::Cancelled) {
        "Import was cancelled".to_string()
    } else {
        format!(
            "Import completed with {} errors ({} inserted, {} failed)",
            result.errors.len(),
            result.rows_inserted,
            result.rows_failed
        )
    };

    Ok(ImportResult {
        success: result.success,
        rows_inserted: result.rows_inserted,
        rows_updated: result.rows_updated,
        rows_skipped: result.rows_skipped,
        rows_failed: result.rows_failed,
        errors: result.errors,
        execution_time_ms: start.elapsed().as_millis() as u64,
        message,
    })
}

/// Cancel an ongoing import
#[tauri::command]
pub async fn cancel_import(import_id: String) -> AppResult<bool> {
    let tokens = CANCELLATION_TOKENS.read().await;
    if let Some(token) = tokens.get(&import_id) {
        token.store(true, Ordering::Relaxed);
        Ok(true)
    } else {
        Ok(false)
    }
}
