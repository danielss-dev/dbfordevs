//! Schema diff engine for comparing table structures and generating migration scripts.

use crate::models::{
    ColumnDiff, ConstraintDiff, ConstraintInfo, DatabaseType, DiffChangeType,
    ExtendedColumnInfo, ForeignKeyDiff, ForeignKeyInfo, IndexDiff, IndexInfo,
    MigrationStatement, SchemaDiffResult, TableProperties,
};

/// Compare two table schemas and generate a diff result with migration SQL.
pub fn compare_schemas(
    source: &TableProperties,
    target: &TableProperties,
    db_type: &DatabaseType,
    target_table_name: &str,
) -> SchemaDiffResult {
    let column_diffs = compare_columns(&source.columns, &target.columns);
    let index_diffs = compare_indexes(&source.indexes, &target.indexes);
    let constraint_diffs = compare_constraints(&source.constraints, &target.constraints);
    let foreign_key_diffs = compare_foreign_keys(&source.foreign_keys, &target.foreign_keys);

    let is_identical = column_diffs.is_empty()
        && index_diffs.is_empty()
        && constraint_diffs.is_empty()
        && foreign_key_diffs.is_empty();

    // Check if SQLite table recreation is needed
    let requires_table_recreation = matches!(db_type, DatabaseType::SQLite)
        && needs_sqlite_table_recreation(&column_diffs);

    // Generate migration SQL
    let (migration_sql, warnings) = generate_migration(
        db_type,
        target_table_name,
        &column_diffs,
        &index_diffs,
        &constraint_diffs,
        &foreign_key_diffs,
        requires_table_recreation,
        source,
    );

    SchemaDiffResult {
        source_table: source.table_name.clone(),
        target_table: target.table_name.clone(),
        source_schema: source.schema.clone(),
        target_schema: target.schema.clone(),
        column_diffs,
        index_diffs,
        constraint_diffs,
        foreign_key_diffs,
        is_identical,
        migration_sql,
        warnings,
        requires_table_recreation,
    }
}

/// Compare columns between source and target tables.
fn compare_columns(
    source_columns: &[ExtendedColumnInfo],
    target_columns: &[ExtendedColumnInfo],
) -> Vec<ColumnDiff> {
    let mut diffs = Vec::new();

    // Find added columns (in source but not in target)
    for source_col in source_columns {
        if !target_columns.iter().any(|t| t.name == source_col.name) {
            diffs.push(ColumnDiff {
                name: source_col.name.clone(),
                change_type: DiffChangeType::Added,
                source_column: Some(source_col.clone()),
                target_column: None,
                changes: vec![format!("Column '{}' will be added", source_col.name)],
            });
        }
    }

    // Find removed columns (in target but not in source)
    for target_col in target_columns {
        if !source_columns.iter().any(|s| s.name == target_col.name) {
            diffs.push(ColumnDiff {
                name: target_col.name.clone(),
                change_type: DiffChangeType::Removed,
                source_column: None,
                target_column: Some(target_col.clone()),
                changes: vec![format!("Column '{}' will be removed", target_col.name)],
            });
        }
    }

    // Find modified columns
    for source_col in source_columns {
        if let Some(target_col) = target_columns.iter().find(|t| t.name == source_col.name) {
            let changes = detect_column_changes(source_col, target_col);
            if !changes.is_empty() {
                diffs.push(ColumnDiff {
                    name: source_col.name.clone(),
                    change_type: DiffChangeType::Modified,
                    source_column: Some(source_col.clone()),
                    target_column: Some(target_col.clone()),
                    changes,
                });
            }
        }
    }

    diffs
}

/// Detect specific changes between two columns.
fn detect_column_changes(source: &ExtendedColumnInfo, target: &ExtendedColumnInfo) -> Vec<String> {
    let mut changes = Vec::new();

    // Normalize data types for comparison (handle aliases)
    let source_type = normalize_data_type(&source.data_type);
    let target_type = normalize_data_type(&target.data_type);

    if source_type != target_type {
        changes.push(format!(
            "Type changed from '{}' to '{}'",
            target.data_type, source.data_type
        ));
    }

    if source.nullable != target.nullable {
        let nullable_change = if source.nullable {
            "Changed to NULLABLE"
        } else {
            "Changed to NOT NULL"
        };
        changes.push(nullable_change.to_string());
    }

    if source.default_value != target.default_value {
        match (&source.default_value, &target.default_value) {
            (Some(new_default), None) => {
                changes.push(format!("Default value added: {}", new_default))
            }
            (None, Some(old_default)) => {
                changes.push(format!("Default value removed (was: {})", old_default))
            }
            (Some(new_default), Some(old_default)) => {
                changes.push(format!(
                    "Default value changed from '{}' to '{}'",
                    old_default, new_default
                ))
            }
            _ => {}
        }
    }

    changes
}

/// Normalize data type for comparison (handle common aliases).
fn normalize_data_type(data_type: &str) -> String {
    let lower = data_type.to_lowercase();
    // Handle common aliases
    match lower.as_str() {
        "int4" | "int" | "integer" => "integer".to_string(),
        "int8" | "bigint" => "bigint".to_string(),
        "int2" | "smallint" => "smallint".to_string(),
        "float4" | "real" => "real".to_string(),
        "float8" | "double precision" => "double precision".to_string(),
        "bool" | "boolean" => "boolean".to_string(),
        "varchar" => "character varying".to_string(),
        _ => lower,
    }
}

/// Compare indexes between source and target tables.
fn compare_indexes(source_indexes: &[IndexInfo], target_indexes: &[IndexInfo]) -> Vec<IndexDiff> {
    let mut diffs = Vec::new();

    // Find added indexes
    for source_idx in source_indexes {
        if !target_indexes.iter().any(|t| t.name == source_idx.name) {
            diffs.push(IndexDiff {
                name: source_idx.name.clone(),
                change_type: DiffChangeType::Added,
                source_index: Some(source_idx.clone()),
                target_index: None,
                changes: vec![format!("Index '{}' will be added", source_idx.name)],
            });
        }
    }

    // Find removed indexes
    for target_idx in target_indexes {
        if !source_indexes.iter().any(|s| s.name == target_idx.name) {
            diffs.push(IndexDiff {
                name: target_idx.name.clone(),
                change_type: DiffChangeType::Removed,
                source_index: None,
                target_index: Some(target_idx.clone()),
                changes: vec![format!("Index '{}' will be removed", target_idx.name)],
            });
        }
    }

    // Find modified indexes
    for source_idx in source_indexes {
        if let Some(target_idx) = target_indexes.iter().find(|t| t.name == source_idx.name) {
            let changes = detect_index_changes(source_idx, target_idx);
            if !changes.is_empty() {
                diffs.push(IndexDiff {
                    name: source_idx.name.clone(),
                    change_type: DiffChangeType::Modified,
                    source_index: Some(source_idx.clone()),
                    target_index: Some(target_idx.clone()),
                    changes,
                });
            }
        }
    }

    diffs
}

/// Detect changes between two indexes.
fn detect_index_changes(source: &IndexInfo, target: &IndexInfo) -> Vec<String> {
    let mut changes = Vec::new();

    if source.columns != target.columns {
        changes.push(format!(
            "Columns changed from [{}] to [{}]",
            target.columns.join(", "),
            source.columns.join(", ")
        ));
    }

    if source.is_unique != target.is_unique {
        let unique_change = if source.is_unique {
            "Changed to UNIQUE"
        } else {
            "Changed to non-unique"
        };
        changes.push(unique_change.to_string());
    }

    changes
}

/// Compare constraints between source and target tables.
fn compare_constraints(
    source_constraints: &[ConstraintInfo],
    target_constraints: &[ConstraintInfo],
) -> Vec<ConstraintDiff> {
    let mut diffs = Vec::new();

    // Find added constraints
    for source_con in source_constraints {
        if !target_constraints
            .iter()
            .any(|t| t.name == source_con.name)
        {
            diffs.push(ConstraintDiff {
                name: source_con.name.clone(),
                change_type: DiffChangeType::Added,
                source_constraint: Some(source_con.clone()),
                target_constraint: None,
                changes: vec![format!("Constraint '{}' will be added", source_con.name)],
            });
        }
    }

    // Find removed constraints
    for target_con in target_constraints {
        if !source_constraints
            .iter()
            .any(|s| s.name == target_con.name)
        {
            diffs.push(ConstraintDiff {
                name: target_con.name.clone(),
                change_type: DiffChangeType::Removed,
                source_constraint: None,
                target_constraint: Some(target_con.clone()),
                changes: vec![format!("Constraint '{}' will be removed", target_con.name)],
            });
        }
    }

    // Find modified constraints
    for source_con in source_constraints {
        if let Some(target_con) = target_constraints.iter().find(|t| t.name == source_con.name) {
            if source_con.definition != target_con.definition {
                diffs.push(ConstraintDiff {
                    name: source_con.name.clone(),
                    change_type: DiffChangeType::Modified,
                    source_constraint: Some(source_con.clone()),
                    target_constraint: Some(target_con.clone()),
                    changes: vec![format!(
                        "Definition changed from '{}' to '{}'",
                        target_con.definition, source_con.definition
                    )],
                });
            }
        }
    }

    diffs
}

/// Compare foreign keys between source and target tables.
fn compare_foreign_keys(
    source_fks: &[ForeignKeyInfo],
    target_fks: &[ForeignKeyInfo],
) -> Vec<ForeignKeyDiff> {
    let mut diffs = Vec::new();

    // Create a key for FK comparison (column + references)
    let fk_key = |fk: &ForeignKeyInfo| {
        format!(
            "{}->{}({})",
            fk.column, fk.references_table, fk.references_column
        )
    };

    // Find added foreign keys
    for source_fk in source_fks {
        let key = fk_key(source_fk);
        if !target_fks.iter().any(|t| fk_key(t) == key) {
            diffs.push(ForeignKeyDiff {
                change_type: DiffChangeType::Added,
                source_fk: Some(source_fk.clone()),
                target_fk: None,
                changes: vec![format!(
                    "Foreign key on '{}' referencing '{}.{}' will be added",
                    source_fk.column, source_fk.references_table, source_fk.references_column
                )],
            });
        }
    }

    // Find removed foreign keys
    for target_fk in target_fks {
        let key = fk_key(target_fk);
        if !source_fks.iter().any(|s| fk_key(s) == key) {
            diffs.push(ForeignKeyDiff {
                change_type: DiffChangeType::Removed,
                source_fk: None,
                target_fk: Some(target_fk.clone()),
                changes: vec![format!(
                    "Foreign key on '{}' referencing '{}.{}' will be removed",
                    target_fk.column, target_fk.references_table, target_fk.references_column
                )],
            });
        }
    }

    diffs
}

/// Check if SQLite table recreation is needed for the given column diffs.
fn needs_sqlite_table_recreation(column_diffs: &[ColumnDiff]) -> bool {
    column_diffs.iter().any(|diff| {
        matches!(
            diff.change_type,
            DiffChangeType::Removed | DiffChangeType::Modified
        )
    })
}

/// Generate migration SQL for the given diffs.
fn generate_migration(
    db_type: &DatabaseType,
    table_name: &str,
    column_diffs: &[ColumnDiff],
    index_diffs: &[IndexDiff],
    constraint_diffs: &[ConstraintDiff],
    foreign_key_diffs: &[ForeignKeyDiff],
    requires_table_recreation: bool,
    source_table: &TableProperties,
) -> (Vec<MigrationStatement>, Vec<String>) {
    match db_type {
        DatabaseType::PostgreSQL | DatabaseType::CockroachDB => generate_postgres_migration(
            table_name,
            column_diffs,
            index_diffs,
            constraint_diffs,
            foreign_key_diffs,
        ),
        DatabaseType::MySQL | DatabaseType::MariaDB => generate_mysql_migration(
            table_name,
            column_diffs,
            index_diffs,
            constraint_diffs,
            foreign_key_diffs,
        ),
        DatabaseType::SQLite => {
            if requires_table_recreation {
                generate_sqlite_recreation_migration(table_name, source_table, column_diffs)
            } else {
                generate_sqlite_migration(table_name, column_diffs, index_diffs)
            }
        }
        DatabaseType::Oracle => generate_oracle_migration(
            table_name,
            column_diffs,
            index_diffs,
            constraint_diffs,
            foreign_key_diffs,
        ),
        DatabaseType::MSSQL => generate_mssql_migration(
            table_name,
            column_diffs,
            index_diffs,
            constraint_diffs,
            foreign_key_diffs,
        ),
        _ => (
            vec![],
            vec![format!(
                "Migration generation not supported for {:?}",
                db_type
            )],
        ),
    }
}

/// Generate PostgreSQL migration statements.
fn generate_postgres_migration(
    table_name: &str,
    column_diffs: &[ColumnDiff],
    index_diffs: &[IndexDiff],
    constraint_diffs: &[ConstraintDiff],
    foreign_key_diffs: &[ForeignKeyDiff],
) -> (Vec<MigrationStatement>, Vec<String>) {
    let mut statements = Vec::new();
    let mut warnings = Vec::new();
    let mut order: u32 = 0;

    // Process column changes
    for diff in column_diffs {
        match diff.change_type {
            DiffChangeType::Added => {
                if let Some(col) = &diff.source_column {
                    let nullable = if col.nullable { "" } else { " NOT NULL" };
                    let default = col
                        .default_value
                        .as_ref()
                        .map(|d| format!(" DEFAULT {}", d))
                        .unwrap_or_default();

                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} ADD COLUMN {} {}{}{}",
                            quote_identifier(table_name),
                            quote_identifier(&col.name),
                            col.data_type,
                            nullable,
                            default
                        ),
                        description: format!("Add column '{}'", col.name),
                        order,
                        is_destructive: false,
                    });
                    order += 1;
                }
            }
            DiffChangeType::Removed => {
                if let Some(col) = &diff.target_column {
                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} DROP COLUMN {}",
                            quote_identifier(table_name),
                            quote_identifier(&col.name)
                        ),
                        description: format!("Drop column '{}'", col.name),
                        order,
                        is_destructive: true,
                    });
                    warnings.push(format!(
                        "Dropping column '{}' will permanently delete data",
                        col.name
                    ));
                    order += 1;
                }
            }
            DiffChangeType::Modified => {
                if let (Some(source_col), Some(target_col)) =
                    (&diff.source_column, &diff.target_column)
                {
                    // Type change
                    if normalize_data_type(&source_col.data_type)
                        != normalize_data_type(&target_col.data_type)
                    {
                        statements.push(MigrationStatement {
                            sql: format!(
                                "ALTER TABLE {} ALTER COLUMN {} TYPE {} USING {}::{}",
                                quote_identifier(table_name),
                                quote_identifier(&source_col.name),
                                source_col.data_type,
                                quote_identifier(&source_col.name),
                                source_col.data_type
                            ),
                            description: format!(
                                "Change column '{}' type to {}",
                                source_col.name, source_col.data_type
                            ),
                            order,
                            is_destructive: true,
                        });
                        warnings.push(format!(
                            "Changing type of '{}' may cause data loss",
                            source_col.name
                        ));
                        order += 1;
                    }

                    // Nullable change
                    if source_col.nullable != target_col.nullable {
                        let action = if source_col.nullable {
                            "DROP NOT NULL"
                        } else {
                            "SET NOT NULL"
                        };
                        statements.push(MigrationStatement {
                            sql: format!(
                                "ALTER TABLE {} ALTER COLUMN {} {}",
                                quote_identifier(table_name),
                                quote_identifier(&source_col.name),
                                action
                            ),
                            description: format!(
                                "Change column '{}' to {}",
                                source_col.name,
                                if source_col.nullable {
                                    "nullable"
                                } else {
                                    "not null"
                                }
                            ),
                            order,
                            is_destructive: !source_col.nullable,
                        });
                        order += 1;
                    }

                    // Default value change
                    if source_col.default_value != target_col.default_value {
                        let sql = match &source_col.default_value {
                            Some(default) => format!(
                                "ALTER TABLE {} ALTER COLUMN {} SET DEFAULT {}",
                                quote_identifier(table_name),
                                quote_identifier(&source_col.name),
                                default
                            ),
                            None => format!(
                                "ALTER TABLE {} ALTER COLUMN {} DROP DEFAULT",
                                quote_identifier(table_name),
                                quote_identifier(&source_col.name)
                            ),
                        };
                        statements.push(MigrationStatement {
                            sql,
                            description: format!("Change default value for column '{}'", source_col.name),
                            order,
                            is_destructive: false,
                        });
                        order += 1;
                    }
                }
            }
        }
    }

    // Process index changes
    for diff in index_diffs {
        match diff.change_type {
            DiffChangeType::Added => {
                if let Some(idx) = &diff.source_index {
                    if !idx.is_primary {
                        let unique = if idx.is_unique { "UNIQUE " } else { "" };
                        statements.push(MigrationStatement {
                            sql: format!(
                                "CREATE {}INDEX {} ON {} ({})",
                                unique,
                                quote_identifier(&idx.name),
                                quote_identifier(table_name),
                                idx.columns
                                    .iter()
                                    .map(|c| quote_identifier(c))
                                    .collect::<Vec<_>>()
                                    .join(", ")
                            ),
                            description: format!("Create index '{}'", idx.name),
                            order,
                            is_destructive: false,
                        });
                        order += 1;
                    }
                }
            }
            DiffChangeType::Removed => {
                if let Some(idx) = &diff.target_index {
                    if !idx.is_primary {
                        statements.push(MigrationStatement {
                            sql: format!("DROP INDEX {}", quote_identifier(&idx.name)),
                            description: format!("Drop index '{}'", idx.name),
                            order,
                            is_destructive: false,
                        });
                        order += 1;
                    }
                }
            }
            DiffChangeType::Modified => {
                if let Some(idx) = &diff.source_index {
                    if !idx.is_primary {
                        // Drop and recreate
                        statements.push(MigrationStatement {
                            sql: format!("DROP INDEX {}", quote_identifier(&idx.name)),
                            description: format!("Drop index '{}' for recreation", idx.name),
                            order,
                            is_destructive: false,
                        });
                        order += 1;

                        let unique = if idx.is_unique { "UNIQUE " } else { "" };
                        statements.push(MigrationStatement {
                            sql: format!(
                                "CREATE {}INDEX {} ON {} ({})",
                                unique,
                                quote_identifier(&idx.name),
                                quote_identifier(table_name),
                                idx.columns
                                    .iter()
                                    .map(|c| quote_identifier(c))
                                    .collect::<Vec<_>>()
                                    .join(", ")
                            ),
                            description: format!("Recreate index '{}'", idx.name),
                            order,
                            is_destructive: false,
                        });
                        order += 1;
                    }
                }
            }
        }
    }

    // Process constraint changes
    for diff in constraint_diffs {
        match diff.change_type {
            DiffChangeType::Added => {
                if let Some(con) = &diff.source_constraint {
                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} ADD CONSTRAINT {} {}",
                            quote_identifier(table_name),
                            quote_identifier(&con.name),
                            con.definition
                        ),
                        description: format!("Add constraint '{}'", con.name),
                        order,
                        is_destructive: false,
                    });
                    order += 1;
                }
            }
            DiffChangeType::Removed => {
                if let Some(con) = &diff.target_constraint {
                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} DROP CONSTRAINT {}",
                            quote_identifier(table_name),
                            quote_identifier(&con.name)
                        ),
                        description: format!("Drop constraint '{}'", con.name),
                        order,
                        is_destructive: false,
                    });
                    order += 1;
                }
            }
            DiffChangeType::Modified => {
                if let Some(con) = &diff.source_constraint {
                    // Drop and recreate
                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} DROP CONSTRAINT {}",
                            quote_identifier(table_name),
                            quote_identifier(&con.name)
                        ),
                        description: format!("Drop constraint '{}' for recreation", con.name),
                        order,
                        is_destructive: false,
                    });
                    order += 1;

                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} ADD CONSTRAINT {} {}",
                            quote_identifier(table_name),
                            quote_identifier(&con.name),
                            con.definition
                        ),
                        description: format!("Recreate constraint '{}'", con.name),
                        order,
                        is_destructive: false,
                    });
                    order += 1;
                }
            }
        }
    }

    // Process foreign key changes
    for diff in foreign_key_diffs {
        match diff.change_type {
            DiffChangeType::Added => {
                if let Some(fk) = &diff.source_fk {
                    // Use actual constraint name if available, otherwise generate one
                    let fk_name = fk.constraint_name.clone().unwrap_or_else(|| {
                        format!("fk_{}_{}", table_name, fk.column)
                    });
                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} ADD CONSTRAINT {} FOREIGN KEY ({}) REFERENCES {} ({})",
                            quote_identifier(table_name),
                            quote_identifier(&fk_name),
                            quote_identifier(&fk.column),
                            quote_identifier(&fk.references_table),
                            quote_identifier(&fk.references_column)
                        ),
                        description: format!(
                            "Add foreign key on '{}' referencing '{}.{}'",
                            fk.column, fk.references_table, fk.references_column
                        ),
                        order,
                        is_destructive: false,
                    });
                    order += 1;
                }
            }
            DiffChangeType::Removed => {
                if let Some(fk) = &diff.target_fk {
                    // Use actual constraint name if available, otherwise generate one
                    let fk_name = fk.constraint_name.clone().unwrap_or_else(|| {
                        format!("fk_{}_{}", table_name, fk.column)
                    });
                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} DROP CONSTRAINT {}",
                            quote_identifier(table_name),
                            quote_identifier(&fk_name)
                        ),
                        description: format!(
                            "Drop foreign key on '{}' referencing '{}.{}'",
                            fk.column, fk.references_table, fk.references_column
                        ),
                        order,
                        is_destructive: false,
                    });
                    order += 1;
                }
            }
            _ => {}
        }
    }

    (statements, warnings)
}

/// Generate MySQL migration statements.
fn generate_mysql_migration(
    table_name: &str,
    column_diffs: &[ColumnDiff],
    index_diffs: &[IndexDiff],
    constraint_diffs: &[ConstraintDiff],
    foreign_key_diffs: &[ForeignKeyDiff],
) -> (Vec<MigrationStatement>, Vec<String>) {
    let mut statements = Vec::new();
    let mut warnings = Vec::new();
    let mut order: u32 = 0;

    // Process column changes
    for diff in column_diffs {
        match diff.change_type {
            DiffChangeType::Added => {
                if let Some(col) = &diff.source_column {
                    let nullable = if col.nullable { "NULL" } else { "NOT NULL" };
                    let default = col
                        .default_value
                        .as_ref()
                        .map(|d| format!(" DEFAULT {}", d))
                        .unwrap_or_default();

                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} ADD COLUMN {} {} {}{}",
                            quote_mysql_identifier(table_name),
                            quote_mysql_identifier(&col.name),
                            col.data_type,
                            nullable,
                            default
                        ),
                        description: format!("Add column '{}'", col.name),
                        order,
                        is_destructive: false,
                    });
                    order += 1;
                }
            }
            DiffChangeType::Removed => {
                if let Some(col) = &diff.target_column {
                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} DROP COLUMN {}",
                            quote_mysql_identifier(table_name),
                            quote_mysql_identifier(&col.name)
                        ),
                        description: format!("Drop column '{}'", col.name),
                        order,
                        is_destructive: true,
                    });
                    warnings.push(format!(
                        "Dropping column '{}' will permanently delete data",
                        col.name
                    ));
                    order += 1;
                }
            }
            DiffChangeType::Modified => {
                if let Some(source_col) = &diff.source_column {
                    // MySQL uses MODIFY COLUMN for all column changes
                    let nullable = if source_col.nullable {
                        "NULL"
                    } else {
                        "NOT NULL"
                    };
                    let default = source_col
                        .default_value
                        .as_ref()
                        .map(|d| format!(" DEFAULT {}", d))
                        .unwrap_or_default();

                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} MODIFY COLUMN {} {} {}{}",
                            quote_mysql_identifier(table_name),
                            quote_mysql_identifier(&source_col.name),
                            source_col.data_type,
                            nullable,
                            default
                        ),
                        description: format!("Modify column '{}'", source_col.name),
                        order,
                        is_destructive: true,
                    });
                    warnings.push(format!(
                        "Modifying column '{}' may cause data loss",
                        source_col.name
                    ));
                    order += 1;
                }
            }
        }
    }

    // Process index changes
    for diff in index_diffs {
        match diff.change_type {
            DiffChangeType::Added => {
                if let Some(idx) = &diff.source_index {
                    if !idx.is_primary {
                        let unique = if idx.is_unique { "UNIQUE " } else { "" };
                        statements.push(MigrationStatement {
                            sql: format!(
                                "CREATE {}INDEX {} ON {} ({})",
                                unique,
                                quote_mysql_identifier(&idx.name),
                                quote_mysql_identifier(table_name),
                                idx.columns
                                    .iter()
                                    .map(|c| quote_mysql_identifier(c))
                                    .collect::<Vec<_>>()
                                    .join(", ")
                            ),
                            description: format!("Create index '{}'", idx.name),
                            order,
                            is_destructive: false,
                        });
                        order += 1;
                    }
                }
            }
            DiffChangeType::Removed => {
                if let Some(idx) = &diff.target_index {
                    if !idx.is_primary {
                        statements.push(MigrationStatement {
                            sql: format!(
                                "DROP INDEX {} ON {}",
                                quote_mysql_identifier(&idx.name),
                                quote_mysql_identifier(table_name)
                            ),
                            description: format!("Drop index '{}'", idx.name),
                            order,
                            is_destructive: false,
                        });
                        order += 1;
                    }
                }
            }
            DiffChangeType::Modified => {
                if let Some(idx) = &diff.source_index {
                    if !idx.is_primary {
                        // Drop and recreate
                        statements.push(MigrationStatement {
                            sql: format!(
                                "DROP INDEX {} ON {}",
                                quote_mysql_identifier(&idx.name),
                                quote_mysql_identifier(table_name)
                            ),
                            description: format!("Drop index '{}' for recreation", idx.name),
                            order,
                            is_destructive: false,
                        });
                        order += 1;

                        let unique = if idx.is_unique { "UNIQUE " } else { "" };
                        statements.push(MigrationStatement {
                            sql: format!(
                                "CREATE {}INDEX {} ON {} ({})",
                                unique,
                                quote_mysql_identifier(&idx.name),
                                quote_mysql_identifier(table_name),
                                idx.columns
                                    .iter()
                                    .map(|c| quote_mysql_identifier(c))
                                    .collect::<Vec<_>>()
                                    .join(", ")
                            ),
                            description: format!("Recreate index '{}'", idx.name),
                            order,
                            is_destructive: false,
                        });
                        order += 1;
                    }
                }
            }
        }
    }

    // Process constraint changes (simplified for MySQL)
    for diff in constraint_diffs {
        match diff.change_type {
            DiffChangeType::Added => {
                if let Some(con) = &diff.source_constraint {
                    if con.constraint_type.to_uppercase() == "CHECK" {
                        statements.push(MigrationStatement {
                            sql: format!(
                                "ALTER TABLE {} ADD CONSTRAINT {} CHECK ({})",
                                quote_mysql_identifier(table_name),
                                quote_mysql_identifier(&con.name),
                                con.definition
                            ),
                            description: format!("Add constraint '{}'", con.name),
                            order,
                            is_destructive: false,
                        });
                        order += 1;
                    }
                }
            }
            DiffChangeType::Removed => {
                if let Some(con) = &diff.target_constraint {
                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} DROP CONSTRAINT {}",
                            quote_mysql_identifier(table_name),
                            quote_mysql_identifier(&con.name)
                        ),
                        description: format!("Drop constraint '{}'", con.name),
                        order,
                        is_destructive: false,
                    });
                    order += 1;
                }
            }
            _ => {}
        }
    }

    // Process foreign key changes
    for diff in foreign_key_diffs {
        match diff.change_type {
            DiffChangeType::Added => {
                if let Some(fk) = &diff.source_fk {
                    // Use actual constraint name if available, otherwise generate one
                    let fk_name = fk.constraint_name.clone().unwrap_or_else(|| {
                        format!("fk_{}_{}", table_name, fk.column)
                    });
                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} ADD CONSTRAINT {} FOREIGN KEY ({}) REFERENCES {} ({})",
                            quote_mysql_identifier(table_name),
                            quote_mysql_identifier(&fk_name),
                            quote_mysql_identifier(&fk.column),
                            quote_mysql_identifier(&fk.references_table),
                            quote_mysql_identifier(&fk.references_column)
                        ),
                        description: format!(
                            "Add foreign key on '{}' referencing '{}.{}'",
                            fk.column, fk.references_table, fk.references_column
                        ),
                        order,
                        is_destructive: false,
                    });
                    order += 1;
                }
            }
            DiffChangeType::Removed => {
                if let Some(fk) = &diff.target_fk {
                    // Use actual constraint name if available, otherwise generate one
                    let fk_name = fk.constraint_name.clone().unwrap_or_else(|| {
                        format!("fk_{}_{}", table_name, fk.column)
                    });
                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} DROP FOREIGN KEY {}",
                            quote_mysql_identifier(table_name),
                            quote_mysql_identifier(&fk_name)
                        ),
                        description: format!(
                            "Drop foreign key on '{}' referencing '{}.{}'",
                            fk.column, fk.references_table, fk.references_column
                        ),
                        order,
                        is_destructive: false,
                    });
                    order += 1;
                }
            }
            _ => {}
        }
    }

    (statements, warnings)
}

/// Generate SQLite migration statements (limited ALTER TABLE support).
fn generate_sqlite_migration(
    table_name: &str,
    column_diffs: &[ColumnDiff],
    index_diffs: &[IndexDiff],
) -> (Vec<MigrationStatement>, Vec<String>) {
    let mut statements = Vec::new();
    let warnings = Vec::new();
    let mut order: u32 = 0;

    // SQLite only supports ADD COLUMN
    for diff in column_diffs {
        if let DiffChangeType::Added = diff.change_type {
            if let Some(col) = &diff.source_column {
                let default = col
                    .default_value
                    .as_ref()
                    .map(|d| format!(" DEFAULT {}", d))
                    .unwrap_or_default();

                statements.push(MigrationStatement {
                    sql: format!(
                        "ALTER TABLE {} ADD COLUMN {} {}{}",
                        quote_identifier(table_name),
                        quote_identifier(&col.name),
                        col.data_type,
                        default
                    ),
                    description: format!("Add column '{}'", col.name),
                    order,
                    is_destructive: false,
                });
                order += 1;
            }
        }
    }

    // Process index changes
    for diff in index_diffs {
        match diff.change_type {
            DiffChangeType::Added => {
                if let Some(idx) = &diff.source_index {
                    if !idx.is_primary {
                        let unique = if idx.is_unique { "UNIQUE " } else { "" };
                        statements.push(MigrationStatement {
                            sql: format!(
                                "CREATE {}INDEX {} ON {} ({})",
                                unique,
                                quote_identifier(&idx.name),
                                quote_identifier(table_name),
                                idx.columns
                                    .iter()
                                    .map(|c| quote_identifier(c))
                                    .collect::<Vec<_>>()
                                    .join(", ")
                            ),
                            description: format!("Create index '{}'", idx.name),
                            order,
                            is_destructive: false,
                        });
                        order += 1;
                    }
                }
            }
            DiffChangeType::Removed => {
                if let Some(idx) = &diff.target_index {
                    if !idx.is_primary {
                        statements.push(MigrationStatement {
                            sql: format!("DROP INDEX {}", quote_identifier(&idx.name)),
                            description: format!("Drop index '{}'", idx.name),
                            order,
                            is_destructive: false,
                        });
                        order += 1;
                    }
                }
            }
            _ => {}
        }
    }

    (statements, warnings)
}

/// Generate SQLite table recreation migration (for column drops, type changes, etc.).
fn generate_sqlite_recreation_migration(
    table_name: &str,
    source_table: &TableProperties,
    column_diffs: &[ColumnDiff],
) -> (Vec<MigrationStatement>, Vec<String>) {
    let mut statements = Vec::new();
    let warnings = vec![
        "SQLite requires table recreation for this migration".to_string(),
        "Ensure you have a backup before executing these statements".to_string(),
    ];

    let new_table_name = format!("_new_{}", table_name);

    // Build column definitions for the new table
    let mut column_defs = Vec::new();
    let mut select_columns = Vec::new();

    for col in &source_table.columns {
        // Check if this column should be included
        let should_remove = column_diffs.iter().any(|d| {
            d.name == col.name && matches!(d.change_type, DiffChangeType::Removed)
        });

        if should_remove {
            continue;
        }

        // Check if this column is modified
        let modified_col = column_diffs
            .iter()
            .find(|d| d.name == col.name && matches!(d.change_type, DiffChangeType::Modified))
            .and_then(|d| d.source_column.as_ref());

        let col_info = modified_col.unwrap_or(col);
        let nullable = if col_info.nullable { "" } else { " NOT NULL" };
        let default = col_info
            .default_value
            .as_ref()
            .map(|d| format!(" DEFAULT {}", d))
            .unwrap_or_default();
        let pk = if col_info.is_primary_key {
            " PRIMARY KEY"
        } else {
            ""
        };

        column_defs.push(format!(
            "{} {}{}{}{}",
            quote_identifier(&col_info.name),
            col_info.data_type,
            pk,
            nullable,
            default
        ));
        select_columns.push(quote_identifier(&col.name));
    }

    // Start transaction
    statements.push(MigrationStatement {
        sql: "BEGIN TRANSACTION".to_string(),
        description: "Start transaction".to_string(),
        order: 0,
        is_destructive: false,
    });

    // Create new table
    statements.push(MigrationStatement {
        sql: format!(
            "CREATE TABLE {} (\n    {}\n)",
            quote_identifier(&new_table_name),
            column_defs.join(",\n    ")
        ),
        description: format!("Create new table '{}'", new_table_name),
        order: 1,
        is_destructive: false,
    });

    // Copy data
    statements.push(MigrationStatement {
        sql: format!(
            "INSERT INTO {} ({}) SELECT {} FROM {}",
            quote_identifier(&new_table_name),
            select_columns.join(", "),
            select_columns.join(", "),
            quote_identifier(table_name)
        ),
        description: "Copy data to new table".to_string(),
        order: 2,
        is_destructive: false,
    });

    // Drop old table
    statements.push(MigrationStatement {
        sql: format!("DROP TABLE {}", quote_identifier(table_name)),
        description: format!("Drop old table '{}'", table_name),
        order: 3,
        is_destructive: true,
    });

    // Rename new table
    statements.push(MigrationStatement {
        sql: format!(
            "ALTER TABLE {} RENAME TO {}",
            quote_identifier(&new_table_name),
            quote_identifier(table_name)
        ),
        description: format!("Rename '{}' to '{}'", new_table_name, table_name),
        order: 4,
        is_destructive: false,
    });

    // Recreate indexes
    let mut order: u32 = 5;
    for idx in &source_table.indexes {
        if !idx.is_primary {
            let unique = if idx.is_unique { "UNIQUE " } else { "" };
            statements.push(MigrationStatement {
                sql: format!(
                    "CREATE {}INDEX {} ON {} ({})",
                    unique,
                    quote_identifier(&idx.name),
                    quote_identifier(table_name),
                    idx.columns
                        .iter()
                        .map(|c| quote_identifier(c))
                        .collect::<Vec<_>>()
                        .join(", ")
                ),
                description: format!("Recreate index '{}'", idx.name),
                order,
                is_destructive: false,
            });
            order += 1;
        }
    }

    // Commit transaction
    statements.push(MigrationStatement {
        sql: "COMMIT".to_string(),
        description: "Commit transaction".to_string(),
        order,
        is_destructive: false,
    });

    (statements, warnings)
}

/// Generate Oracle migration statements.
fn generate_oracle_migration(
    table_name: &str,
    column_diffs: &[ColumnDiff],
    index_diffs: &[IndexDiff],
    constraint_diffs: &[ConstraintDiff],
    foreign_key_diffs: &[ForeignKeyDiff],
) -> (Vec<MigrationStatement>, Vec<String>) {
    let mut statements = Vec::new();
    let mut warnings = Vec::new();
    let mut order: u32 = 0;

    // Process column changes
    for diff in column_diffs {
        match diff.change_type {
            DiffChangeType::Added => {
                if let Some(col) = &diff.source_column {
                    let nullable = if col.nullable { "NULL" } else { "NOT NULL" };
                    let default = col
                        .default_value
                        .as_ref()
                        .map(|d| format!(" DEFAULT {}", d))
                        .unwrap_or_default();

                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} ADD {} {} {}{}",
                            quote_oracle_identifier(table_name),
                            quote_oracle_identifier(&col.name),
                            col.data_type.to_uppercase(),
                            nullable,
                            default
                        ),
                        description: format!("Add column '{}'", col.name),
                        order,
                        is_destructive: false,
                    });
                    order += 1;
                }
            }
            DiffChangeType::Removed => {
                if let Some(col) = &diff.target_column {
                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} DROP COLUMN {}",
                            quote_oracle_identifier(table_name),
                            quote_oracle_identifier(&col.name)
                        ),
                        description: format!("Drop column '{}'", col.name),
                        order,
                        is_destructive: true,
                    });
                    warnings.push(format!(
                        "Dropping column '{}' will permanently delete data",
                        col.name
                    ));
                    order += 1;
                }
            }
            DiffChangeType::Modified => {
                if let Some(source_col) = &diff.source_column {
                    // Oracle uses MODIFY for column changes
                    let nullable = if source_col.nullable {
                        "NULL"
                    } else {
                        "NOT NULL"
                    };
                    let default = source_col
                        .default_value
                        .as_ref()
                        .map(|d| format!(" DEFAULT {}", d))
                        .unwrap_or_default();

                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} MODIFY {} {} {}{}",
                            quote_oracle_identifier(table_name),
                            quote_oracle_identifier(&source_col.name),
                            source_col.data_type.to_uppercase(),
                            nullable,
                            default
                        ),
                        description: format!("Modify column '{}'", source_col.name),
                        order,
                        is_destructive: true,
                    });
                    warnings.push(format!(
                        "Modifying column '{}' may cause data loss",
                        source_col.name
                    ));
                    order += 1;
                }
            }
        }
    }

    // Process index changes
    for diff in index_diffs {
        match diff.change_type {
            DiffChangeType::Added => {
                if let Some(idx) = &diff.source_index {
                    if !idx.is_primary {
                        let unique = if idx.is_unique { "UNIQUE " } else { "" };
                        statements.push(MigrationStatement {
                            sql: format!(
                                "CREATE {}INDEX {} ON {} ({})",
                                unique,
                                quote_oracle_identifier(&idx.name),
                                quote_oracle_identifier(table_name),
                                idx.columns
                                    .iter()
                                    .map(|c| quote_oracle_identifier(c))
                                    .collect::<Vec<_>>()
                                    .join(", ")
                            ),
                            description: format!("Create index '{}'", idx.name),
                            order,
                            is_destructive: false,
                        });
                        order += 1;
                    }
                }
            }
            DiffChangeType::Removed => {
                if let Some(idx) = &diff.target_index {
                    if !idx.is_primary {
                        statements.push(MigrationStatement {
                            sql: format!("DROP INDEX {}", quote_oracle_identifier(&idx.name)),
                            description: format!("Drop index '{}'", idx.name),
                            order,
                            is_destructive: false,
                        });
                        order += 1;
                    }
                }
            }
            _ => {}
        }
    }

    // Process constraint changes
    for diff in constraint_diffs {
        match diff.change_type {
            DiffChangeType::Added => {
                if let Some(con) = &diff.source_constraint {
                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} ADD CONSTRAINT {} {}",
                            quote_oracle_identifier(table_name),
                            quote_oracle_identifier(&con.name),
                            con.definition
                        ),
                        description: format!("Add constraint '{}'", con.name),
                        order,
                        is_destructive: false,
                    });
                    order += 1;
                }
            }
            DiffChangeType::Removed => {
                if let Some(con) = &diff.target_constraint {
                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} DROP CONSTRAINT {}",
                            quote_oracle_identifier(table_name),
                            quote_oracle_identifier(&con.name)
                        ),
                        description: format!("Drop constraint '{}'", con.name),
                        order,
                        is_destructive: false,
                    });
                    order += 1;
                }
            }
            _ => {}
        }
    }

    // Process foreign key changes
    for diff in foreign_key_diffs {
        match diff.change_type {
            DiffChangeType::Added => {
                if let Some(fk) = &diff.source_fk {
                    // Use actual constraint name if available, otherwise generate one
                    let fk_name = fk.constraint_name.clone().unwrap_or_else(|| {
                        format!("FK_{}_{}", table_name, fk.column).to_uppercase()
                    });
                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} ADD CONSTRAINT {} FOREIGN KEY ({}) REFERENCES {} ({})",
                            quote_oracle_identifier(table_name),
                            quote_oracle_identifier(&fk_name),
                            quote_oracle_identifier(&fk.column),
                            quote_oracle_identifier(&fk.references_table),
                            quote_oracle_identifier(&fk.references_column)
                        ),
                        description: format!(
                            "Add foreign key on '{}' referencing '{}.{}'",
                            fk.column, fk.references_table, fk.references_column
                        ),
                        order,
                        is_destructive: false,
                    });
                    order += 1;
                }
            }
            DiffChangeType::Removed => {
                if let Some(fk) = &diff.target_fk {
                    // Use actual constraint name if available, otherwise generate one
                    let fk_name = fk.constraint_name.clone().unwrap_or_else(|| {
                        format!("FK_{}_{}", table_name, fk.column).to_uppercase()
                    });
                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} DROP CONSTRAINT {}",
                            quote_oracle_identifier(table_name),
                            quote_oracle_identifier(&fk_name)
                        ),
                        description: format!(
                            "Drop foreign key on '{}' referencing '{}.{}'",
                            fk.column, fk.references_table, fk.references_column
                        ),
                        order,
                        is_destructive: false,
                    });
                    order += 1;
                }
            }
            _ => {}
        }
    }

    (statements, warnings)
}

/// Generate MSSQL migration statements.
fn generate_mssql_migration(
    table_name: &str,
    column_diffs: &[ColumnDiff],
    index_diffs: &[IndexDiff],
    constraint_diffs: &[ConstraintDiff],
    foreign_key_diffs: &[ForeignKeyDiff],
) -> (Vec<MigrationStatement>, Vec<String>) {
    let mut statements = Vec::new();
    let mut warnings = Vec::new();
    let mut order: u32 = 0;

    // Process column changes
    for diff in column_diffs {
        match diff.change_type {
            DiffChangeType::Added => {
                if let Some(col) = &diff.source_column {
                    let nullable = if col.nullable { "NULL" } else { "NOT NULL" };
                    let default = col
                        .default_value
                        .as_ref()
                        .map(|d| format!(" DEFAULT {}", d))
                        .unwrap_or_default();

                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} ADD {} {} {}{}",
                            quote_mssql_identifier(table_name),
                            quote_mssql_identifier(&col.name),
                            col.data_type,
                            nullable,
                            default
                        ),
                        description: format!("Add column '{}'", col.name),
                        order,
                        is_destructive: false,
                    });
                    order += 1;
                }
            }
            DiffChangeType::Removed => {
                if let Some(col) = &diff.target_column {
                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} DROP COLUMN {}",
                            quote_mssql_identifier(table_name),
                            quote_mssql_identifier(&col.name)
                        ),
                        description: format!("Drop column '{}'", col.name),
                        order,
                        is_destructive: true,
                    });
                    warnings.push(format!(
                        "Dropping column '{}' will permanently delete data",
                        col.name
                    ));
                    order += 1;
                }
            }
            DiffChangeType::Modified => {
                if let Some(source_col) = &diff.source_column {
                    // MSSQL uses ALTER COLUMN
                    let nullable = if source_col.nullable {
                        "NULL"
                    } else {
                        "NOT NULL"
                    };

                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} ALTER COLUMN {} {} {}",
                            quote_mssql_identifier(table_name),
                            quote_mssql_identifier(&source_col.name),
                            source_col.data_type,
                            nullable
                        ),
                        description: format!("Alter column '{}'", source_col.name),
                        order,
                        is_destructive: true,
                    });
                    warnings.push(format!(
                        "Altering column '{}' may cause data loss",
                        source_col.name
                    ));
                    order += 1;

                    // Handle default value separately in MSSQL
                    if let Some(default) = &source_col.default_value {
                        let constraint_name = format!("DF_{}_{}", table_name, source_col.name);
                        statements.push(MigrationStatement {
                            sql: format!(
                                "ALTER TABLE {} ADD CONSTRAINT {} DEFAULT {} FOR {}",
                                quote_mssql_identifier(table_name),
                                quote_mssql_identifier(&constraint_name),
                                default,
                                quote_mssql_identifier(&source_col.name)
                            ),
                            description: format!(
                                "Add default constraint for '{}'",
                                source_col.name
                            ),
                            order,
                            is_destructive: false,
                        });
                        order += 1;
                    }
                }
            }
        }
    }

    // Process index changes
    for diff in index_diffs {
        match diff.change_type {
            DiffChangeType::Added => {
                if let Some(idx) = &diff.source_index {
                    if !idx.is_primary {
                        let unique = if idx.is_unique { "UNIQUE " } else { "" };
                        statements.push(MigrationStatement {
                            sql: format!(
                                "CREATE {}INDEX {} ON {} ({})",
                                unique,
                                quote_mssql_identifier(&idx.name),
                                quote_mssql_identifier(table_name),
                                idx.columns
                                    .iter()
                                    .map(|c| quote_mssql_identifier(c))
                                    .collect::<Vec<_>>()
                                    .join(", ")
                            ),
                            description: format!("Create index '{}'", idx.name),
                            order,
                            is_destructive: false,
                        });
                        order += 1;
                    }
                }
            }
            DiffChangeType::Removed => {
                if let Some(idx) = &diff.target_index {
                    if !idx.is_primary {
                        statements.push(MigrationStatement {
                            sql: format!(
                                "DROP INDEX {} ON {}",
                                quote_mssql_identifier(&idx.name),
                                quote_mssql_identifier(table_name)
                            ),
                            description: format!("Drop index '{}'", idx.name),
                            order,
                            is_destructive: false,
                        });
                        order += 1;
                    }
                }
            }
            _ => {}
        }
    }

    // Process constraint changes
    for diff in constraint_diffs {
        match diff.change_type {
            DiffChangeType::Added => {
                if let Some(con) = &diff.source_constraint {
                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} ADD CONSTRAINT {} {}",
                            quote_mssql_identifier(table_name),
                            quote_mssql_identifier(&con.name),
                            con.definition
                        ),
                        description: format!("Add constraint '{}'", con.name),
                        order,
                        is_destructive: false,
                    });
                    order += 1;
                }
            }
            DiffChangeType::Removed => {
                if let Some(con) = &diff.target_constraint {
                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} DROP CONSTRAINT {}",
                            quote_mssql_identifier(table_name),
                            quote_mssql_identifier(&con.name)
                        ),
                        description: format!("Drop constraint '{}'", con.name),
                        order,
                        is_destructive: false,
                    });
                    order += 1;
                }
            }
            _ => {}
        }
    }

    // Process foreign key changes
    for diff in foreign_key_diffs {
        match diff.change_type {
            DiffChangeType::Added => {
                if let Some(fk) = &diff.source_fk {
                    // Use actual constraint name if available, otherwise generate one
                    let fk_name = fk.constraint_name.clone().unwrap_or_else(|| {
                        format!("FK_{}_{}", table_name, fk.column)
                    });
                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} ADD CONSTRAINT {} FOREIGN KEY ({}) REFERENCES {} ({})",
                            quote_mssql_identifier(table_name),
                            quote_mssql_identifier(&fk_name),
                            quote_mssql_identifier(&fk.column),
                            quote_mssql_identifier(&fk.references_table),
                            quote_mssql_identifier(&fk.references_column)
                        ),
                        description: format!(
                            "Add foreign key on '{}' referencing '{}.{}'",
                            fk.column, fk.references_table, fk.references_column
                        ),
                        order,
                        is_destructive: false,
                    });
                    order += 1;
                }
            }
            DiffChangeType::Removed => {
                if let Some(fk) = &diff.target_fk {
                    // Use actual constraint name if available, otherwise generate one
                    let fk_name = fk.constraint_name.clone().unwrap_or_else(|| {
                        format!("FK_{}_{}", table_name, fk.column)
                    });
                    statements.push(MigrationStatement {
                        sql: format!(
                            "ALTER TABLE {} DROP CONSTRAINT {}",
                            quote_mssql_identifier(table_name),
                            quote_mssql_identifier(&fk_name)
                        ),
                        description: format!(
                            "Drop foreign key on '{}' referencing '{}.{}'",
                            fk.column, fk.references_table, fk.references_column
                        ),
                        order,
                        is_destructive: false,
                    });
                    order += 1;
                }
            }
            _ => {}
        }
    }

    (statements, warnings)
}

/// Quote an identifier for PostgreSQL/SQLite (double quotes).
fn quote_identifier(name: &str) -> String {
    format!("\"{}\"", name.replace('"', "\"\""))
}

/// Quote an identifier for MySQL (backticks).
fn quote_mysql_identifier(name: &str) -> String {
    format!("`{}`", name.replace('`', "``"))
}

/// Quote an identifier for Oracle (double quotes, uppercase).
fn quote_oracle_identifier(name: &str) -> String {
    format!("\"{}\"", name.to_uppercase().replace('"', "\"\""))
}

/// Quote an identifier for MSSQL (brackets with proper escaping).
fn quote_mssql_identifier(name: &str) -> String {
    format!("[{}]", name.replace(']', "]]"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compare_columns_added() {
        let source = vec![ExtendedColumnInfo {
            name: "id".to_string(),
            data_type: "integer".to_string(),
            nullable: false,
            is_primary_key: true,
            default_value: None,
            comment: None,
        }];
        let target = vec![];

        let diffs = compare_columns(&source, &target);
        assert_eq!(diffs.len(), 1);
        assert_eq!(diffs[0].change_type, DiffChangeType::Added);
        assert_eq!(diffs[0].name, "id");
    }

    #[test]
    fn test_compare_columns_removed() {
        let source = vec![];
        let target = vec![ExtendedColumnInfo {
            name: "old_col".to_string(),
            data_type: "varchar(100)".to_string(),
            nullable: true,
            is_primary_key: false,
            default_value: None,
            comment: None,
        }];

        let diffs = compare_columns(&source, &target);
        assert_eq!(diffs.len(), 1);
        assert_eq!(diffs[0].change_type, DiffChangeType::Removed);
        assert_eq!(diffs[0].name, "old_col");
    }

    #[test]
    fn test_compare_columns_modified() {
        let source = vec![ExtendedColumnInfo {
            name: "col".to_string(),
            data_type: "varchar(200)".to_string(),
            nullable: false,
            is_primary_key: false,
            default_value: None,
            comment: None,
        }];
        let target = vec![ExtendedColumnInfo {
            name: "col".to_string(),
            data_type: "varchar(100)".to_string(),
            nullable: true,
            is_primary_key: false,
            default_value: None,
            comment: None,
        }];

        let diffs = compare_columns(&source, &target);
        assert_eq!(diffs.len(), 1);
        assert_eq!(diffs[0].change_type, DiffChangeType::Modified);
        assert!(!diffs[0].changes.is_empty());
    }

    #[test]
    fn test_normalize_data_type() {
        assert_eq!(normalize_data_type("INT"), "integer");
        assert_eq!(normalize_data_type("int4"), "integer");
        assert_eq!(normalize_data_type("INTEGER"), "integer");
        assert_eq!(normalize_data_type("BIGINT"), "bigint");
        assert_eq!(normalize_data_type("bool"), "boolean");
    }
}
