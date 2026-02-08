//! Data diff engine for comparing table data between two result sets.

use std::collections::HashMap;
use std::time::Instant;

use serde_json::Value;

use crate::models::{
    CellDiff, ColumnInfo, DataCompareOptions, DataCompareResult, DataDiffSummary, QueryResult,
    RowDiff, RowDiffStatus,
};

/// Compare two query results and produce a data comparison result.
pub fn compare_results(
    source: &QueryResult,
    target: &QueryResult,
    options: &DataCompareOptions,
    source_label: &str,
    target_label: &str,
) -> DataCompareResult {
    let start = Instant::now();
    let mut warnings = Vec::new();

    // Build unified column list
    let columns = build_unified_columns(&source.columns, &target.columns, &mut warnings);

    // Resolve key columns
    let key_columns = resolve_key_columns(options, &source.columns, &mut warnings);

    // Build row maps keyed by serialized key-column values
    let source_map = build_row_map(&source.rows, &source.columns, &key_columns);
    let target_map = build_row_map(&target.rows, &target.columns, &key_columns);

    let mut rows = Vec::new();
    let mut matched_count = 0usize;
    let mut modified_count = 0usize;
    let mut removed_count = 0usize;
    let mut added_count = 0usize;
    let mut row_index = 0usize;

    // Walk source map: matched/modified/removed
    for (key, (_, source_row)) in &source_map {
        let key_values = extract_key_values(source_row, &source.columns, &key_columns);

        if let Some((_, target_row)) = target_map.get(key) {
            // Key exists in both - compare cells
            let cell_diffs = compare_row_cells(
                source_row,
                target_row,
                &source.columns,
                &target.columns,
                &columns,
                options,
            );

            if cell_diffs.is_empty() {
                rows.push(RowDiff {
                    status: RowDiffStatus::Matched,
                    row_index,
                    key_values,
                    source_row: Some(source_row.to_vec()),
                    target_row: Some(target_row.to_vec()),
                    cell_diffs: vec![],
                });
                matched_count += 1;
            } else {
                rows.push(RowDiff {
                    status: RowDiffStatus::Modified,
                    row_index,
                    key_values,
                    source_row: Some(source_row.to_vec()),
                    target_row: Some(target_row.to_vec()),
                    cell_diffs,
                });
                modified_count += 1;
            }
        } else {
            // Only in source - removed
            rows.push(RowDiff {
                status: RowDiffStatus::Removed,
                row_index,
                key_values,
                source_row: Some(source_row.to_vec()),
                target_row: None,
                cell_diffs: vec![],
            });
            removed_count += 1;
        }
        row_index += 1;
    }

    // Walk target map: find added rows (in target but not in source)
    for (key, (_, target_row)) in &target_map {
        if !source_map.contains_key(key) {
            let key_values = extract_key_values(target_row, &target.columns, &key_columns);
            rows.push(RowDiff {
                status: RowDiffStatus::Added,
                row_index,
                key_values,
                source_row: None,
                target_row: Some(target_row.to_vec()),
                cell_diffs: vec![],
            });
            added_count += 1;
            row_index += 1;
        }
    }

    // Sort: matched, modified, removed, added
    rows.sort_by_key(|r| match r.status {
        RowDiffStatus::Matched => 0,
        RowDiffStatus::Modified => 1,
        RowDiffStatus::Removed => 2,
        RowDiffStatus::Added => 3,
    });

    // Re-index after sort
    for (i, row) in rows.iter_mut().enumerate() {
        row.row_index = i;
    }

    let elapsed = start.elapsed();
    let truncated = source.rows.len() >= options.max_rows as usize
        || target.rows.len() >= options.max_rows as usize;

    if truncated {
        warnings.push(format!(
            "Results may be truncated at {} rows",
            options.max_rows
        ));
    }

    DataCompareResult {
        source_label: source_label.to_string(),
        target_label: target_label.to_string(),
        columns,
        key_columns,
        rows,
        summary: DataDiffSummary {
            total_source_rows: source.rows.len(),
            total_target_rows: target.rows.len(),
            matched_rows: matched_count,
            added_rows: added_count,
            removed_rows: removed_count,
            modified_rows: modified_count,
            comparison_time_ms: elapsed.as_millis() as u64,
        },
        warnings,
        truncated,
    }
}

/// Build a unified column list from source and target columns.
fn build_unified_columns(
    source_columns: &[ColumnInfo],
    target_columns: &[ColumnInfo],
    warnings: &mut Vec<String>,
) -> Vec<ColumnInfo> {
    let mut columns: Vec<ColumnInfo> = source_columns.to_vec();

    for target_col in target_columns {
        if !columns.iter().any(|c| c.name == target_col.name) {
            columns.push(target_col.clone());
            warnings.push(format!(
                "Column '{}' exists only in target",
                target_col.name
            ));
        }
    }

    // Check for columns only in source
    for source_col in source_columns {
        if !target_columns.iter().any(|c| c.name == source_col.name) {
            warnings.push(format!(
                "Column '{}' exists only in source",
                source_col.name
            ));
        }
    }

    columns
}

/// Resolve which columns to use as keys for matching rows.
fn resolve_key_columns(
    options: &DataCompareOptions,
    source_columns: &[ColumnInfo],
    warnings: &mut Vec<String>,
) -> Vec<String> {
    if !options.key_columns.is_empty() {
        return options.key_columns.clone();
    }

    // Try to use primary key columns
    let pk_columns: Vec<String> = source_columns
        .iter()
        .filter(|c| c.is_primary_key)
        .map(|c| c.name.clone())
        .collect();

    if !pk_columns.is_empty() {
        return pk_columns;
    }

    // Fall back to all columns
    warnings.push(
        "No key columns specified and no primary key detected. Using all columns as key (may be slow for large datasets).".to_string(),
    );
    source_columns.iter().map(|c| c.name.clone()).collect()
}

/// Build a map from serialized key values to (original_index, row_data).
fn build_row_map<'a>(
    rows: &'a [Vec<Value>],
    columns: &[ColumnInfo],
    key_columns: &[String],
) -> HashMap<String, (usize, &'a Vec<Value>)> {
    let key_indices: Vec<usize> = key_columns
        .iter()
        .filter_map(|kc| columns.iter().position(|c| c.name == *kc))
        .collect();

    let mut map = HashMap::new();
    for (idx, row) in rows.iter().enumerate() {
        let key_parts: Vec<String> = key_indices
            .iter()
            .map(|&i| {
                if i < row.len() {
                    value_to_key_string(&row[i])
                } else {
                    "NULL".to_string()
                }
            })
            .collect();
        let key = key_parts.join("|");
        // First occurrence wins (duplicates would be a data issue)
        map.entry(key).or_insert((idx, row));
    }
    map
}

/// Convert a JSON value to a string for use as a map key.
fn value_to_key_string(value: &Value) -> String {
    match value {
        Value::Null => "NULL".to_string(),
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        _ => serde_json::to_string(value).unwrap_or_else(|_| "??".to_string()),
    }
}

/// Extract key column values from a row.
fn extract_key_values(
    row: &[Value],
    columns: &[ColumnInfo],
    key_columns: &[String],
) -> serde_json::Map<String, Value> {
    let mut map = serde_json::Map::new();
    for kc in key_columns {
        if let Some(idx) = columns.iter().position(|c| c.name == *kc) {
            if idx < row.len() {
                map.insert(kc.clone(), row[idx].clone());
            }
        }
    }
    map
}

/// Compare cells of two rows across unified columns.
fn compare_row_cells(
    source_row: &[Value],
    target_row: &[Value],
    source_columns: &[ColumnInfo],
    target_columns: &[ColumnInfo],
    unified_columns: &[ColumnInfo],
    options: &DataCompareOptions,
) -> Vec<CellDiff> {
    let mut diffs = Vec::new();

    for col in unified_columns {
        let source_val = source_columns
            .iter()
            .position(|c| c.name == col.name)
            .and_then(|i| source_row.get(i))
            .cloned()
            .unwrap_or(Value::Null);

        let target_val = target_columns
            .iter()
            .position(|c| c.name == col.name)
            .and_then(|i| target_row.get(i))
            .cloned()
            .unwrap_or(Value::Null);

        if !values_equal(&source_val, &target_val, options) {
            diffs.push(CellDiff {
                column_name: col.name.clone(),
                source_value: source_val,
                target_value: target_val,
            });
        }
    }

    diffs
}

/// Compare two JSON values with tolerance options.
fn values_equal(a: &Value, b: &Value, options: &DataCompareOptions) -> bool {
    // Handle null_equals_empty
    if options.null_equals_empty {
        let a_is_empty = matches!(a, Value::Null) || matches!(a, Value::String(s) if s.is_empty());
        let b_is_empty = matches!(b, Value::Null) || matches!(b, Value::String(s) if s.is_empty());
        if a_is_empty && b_is_empty {
            return true;
        }
    }

    // Both null
    if a.is_null() && b.is_null() {
        return true;
    }
    // One null, other not
    if a.is_null() || b.is_null() {
        return false;
    }

    // Numeric comparison with tolerance
    if let (Some(a_num), Some(b_num)) = (value_as_f64(a), value_as_f64(b)) {
        if let Some(tolerance) = options.numeric_tolerance {
            return (a_num - b_num).abs() <= tolerance;
        }
        return a_num == b_num;
    }

    // String comparison with options
    if let (Value::String(a_str), Value::String(b_str)) = (a, b) {
        let mut a_cmp = a_str.clone();
        let mut b_cmp = b_str.clone();

        if options.ignore_whitespace {
            a_cmp = a_cmp.trim().to_string();
            b_cmp = b_cmp.trim().to_string();
        }

        if options.ignore_case {
            return a_cmp.to_lowercase() == b_cmp.to_lowercase();
        }

        return a_cmp == b_cmp;
    }

    // Default: exact JSON equality
    a == b
}

/// Try to interpret a JSON value as an f64.
fn value_as_f64(v: &Value) -> Option<f64> {
    match v {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.parse::<f64>().ok(),
        _ => None,
    }
}
