//! SQLite integration tests.
//!
//! These tests use a temporary file for the SQLite database.
//! Run with: cargo test --test sqlite_integration -- --nocapture

mod common;

use dbfordevs::db::{DatabaseDriver, SqliteDriver, PoolRef};
use sqlx::sqlite::SqlitePoolOptions;
use tempfile::NamedTempFile;
use std::path::Path;

/// Helper to create a connection pool from a file path
async fn create_pool(db_path: &Path) -> sqlx::SqlitePool {
    let connection_string = format!("sqlite://{}?mode=rwc", db_path.display());

    SqlitePoolOptions::new()
        .max_connections(1)
        .connect(&connection_string)
        .await
        .expect("Failed to create SQLite pool")
}

#[tokio::test]
async fn test_sqlite_connection() {
    let temp_file = NamedTempFile::new().expect("Failed to create temp file");
    let db_path = temp_file.path();

    let config = common::sqlite_config(&db_path.to_string_lossy());

    let driver = SqliteDriver;
    let result = driver.test_connection(&config).await;

    assert!(result.is_ok(), "Connection test failed: {:?}", result.err());
    let test_result = result.unwrap();
    assert!(test_result.success, "Connection was not successful");
    assert!(test_result.server_version.is_some(), "Server version should be present");
}

#[tokio::test]
async fn test_sqlite_execute_select() {
    let temp_file = NamedTempFile::new().expect("Failed to create temp file");
    let db_path = temp_file.path();

    let pool = create_pool(db_path).await;
    let driver = SqliteDriver;

    // Test simple SELECT
    let result = driver
        .execute_query(PoolRef::Sqlite(&pool), "SELECT 1 as num, 'hello' as greeting")
        .await;

    assert!(result.is_ok(), "Query failed: {:?}", result.err());
    let query_result = result.unwrap();

    assert_eq!(query_result.columns.len(), 2, "Should have 2 columns");
    assert_eq!(query_result.columns[0].name, "num");
    assert_eq!(query_result.columns[1].name, "greeting");
    assert_eq!(query_result.rows.len(), 1, "Should have 1 row");
    assert_eq!(query_result.rows[0][0], serde_json::json!(1));
    assert_eq!(query_result.rows[0][1], serde_json::json!("hello"));
}

#[tokio::test]
async fn test_sqlite_create_table_and_insert() {
    let temp_file = NamedTempFile::new().expect("Failed to create temp file");
    let db_path = temp_file.path();

    let pool = create_pool(db_path).await;
    let driver = SqliteDriver;

    // Create table
    let create_result = driver
        .execute_query(
            PoolRef::Sqlite(&pool),
            "CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE,
                active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .await;

    assert!(create_result.is_ok(), "CREATE TABLE failed: {:?}", create_result.err());

    // Insert data
    let insert_result = driver
        .execute_query(
            PoolRef::Sqlite(&pool),
            "INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com')",
        )
        .await;

    assert!(insert_result.is_ok(), "INSERT failed: {:?}", insert_result.err());
    let insert_data = insert_result.unwrap();
    assert_eq!(insert_data.affected_rows, Some(1), "Should affect 1 row");

    // Select data
    let select_result = driver
        .execute_query(PoolRef::Sqlite(&pool), "SELECT * FROM users")
        .await;

    assert!(select_result.is_ok(), "SELECT failed: {:?}", select_result.err());
    let select_data = select_result.unwrap();
    assert_eq!(select_data.rows.len(), 1, "Should have 1 row");
    assert_eq!(select_data.rows[0][1], serde_json::json!("John Doe"));
}

#[tokio::test]
async fn test_sqlite_get_tables() {
    let temp_file = NamedTempFile::new().expect("Failed to create temp file");
    let db_path = temp_file.path();

    let pool = create_pool(db_path).await;
    let driver = SqliteDriver;

    // Create some tables
    driver
        .execute_query(PoolRef::Sqlite(&pool), "CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT)")
        .await
        .expect("Failed to create products table");

    driver
        .execute_query(PoolRef::Sqlite(&pool), "CREATE TABLE orders (id INTEGER PRIMARY KEY, product_id INTEGER)")
        .await
        .expect("Failed to create orders table");

    let config = common::sqlite_config(&db_path.to_string_lossy());

    let tables = driver.get_tables(PoolRef::Sqlite(&pool), &config).await;

    assert!(tables.is_ok(), "get_tables failed: {:?}", tables.err());
    let table_list = tables.unwrap();

    let table_names: Vec<&str> = table_list.iter().map(|t| t.name.as_str()).collect();
    assert!(
        table_names.iter().any(|n| n.contains("products")),
        "Should find products table, got: {:?}",
        table_names
    );
    assert!(
        table_names.iter().any(|n| n.contains("orders")),
        "Should find orders table, got: {:?}",
        table_names
    );
}

#[tokio::test]
async fn test_sqlite_get_table_schema() {
    let temp_file = NamedTempFile::new().expect("Failed to create temp file");
    let db_path = temp_file.path();

    let pool = create_pool(db_path).await;
    let driver = SqliteDriver;

    // Create a table with various column types
    driver
        .execute_query(
            PoolRef::Sqlite(&pool),
            "CREATE TABLE test_schema (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                price REAL,
                quantity INTEGER DEFAULT 0,
                is_available INTEGER,
                data BLOB
            )",
        )
        .await
        .expect("Failed to create table");

    let schema = driver
        .get_table_schema(PoolRef::Sqlite(&pool), "test_schema")
        .await;

    assert!(schema.is_ok(), "get_table_schema failed: {:?}", schema.err());
    let table_schema = schema.unwrap();

    assert_eq!(table_schema.columns.len(), 6, "Should have 6 columns");

    // Check primary key
    assert!(table_schema.primary_keys.contains(&"id".to_string()), "id should be primary key");

    // Check column properties
    let id_col = table_schema.columns.iter().find(|c| c.name == "id").unwrap();
    assert!(id_col.is_primary_key, "id column should be marked as primary key");

    let name_col = table_schema.columns.iter().find(|c| c.name == "name").unwrap();
    assert!(!name_col.nullable, "name should not be nullable");
}

#[tokio::test]
async fn test_sqlite_foreign_keys() {
    let temp_file = NamedTempFile::new().expect("Failed to create temp file");
    let db_path = temp_file.path();

    let pool = create_pool(db_path).await;
    let driver = SqliteDriver;

    // Enable foreign keys
    driver
        .execute_query(PoolRef::Sqlite(&pool), "PRAGMA foreign_keys = ON")
        .await
        .expect("Failed to enable foreign keys");

    // Create parent table
    driver
        .execute_query(
            PoolRef::Sqlite(&pool),
            "CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT)",
        )
        .await
        .expect("Failed to create categories table");

    // Create child table with foreign key
    driver
        .execute_query(
            PoolRef::Sqlite(&pool),
            "CREATE TABLE items (
                id INTEGER PRIMARY KEY,
                name TEXT,
                category_id INTEGER REFERENCES categories(id)
            )",
        )
        .await
        .expect("Failed to create items table");

    let schema = driver
        .get_table_schema(PoolRef::Sqlite(&pool), "items")
        .await
        .expect("Failed to get table schema");

    assert_eq!(schema.foreign_keys.len(), 1, "Should have 1 foreign key");
    let fk = &schema.foreign_keys[0];
    assert_eq!(fk.column, "category_id");
    assert_eq!(fk.references_table, "categories");
    assert_eq!(fk.references_column, "id");
}

#[tokio::test]
async fn test_sqlite_data_types() {
    let temp_file = NamedTempFile::new().expect("Failed to create temp file");
    let db_path = temp_file.path();

    let pool = create_pool(db_path).await;
    let driver = SqliteDriver;

    // Create table with various data types
    driver
        .execute_query(
            PoolRef::Sqlite(&pool),
            "CREATE TABLE type_test (
                id INTEGER PRIMARY KEY,
                int_val INTEGER,
                real_val REAL,
                text_val TEXT,
                blob_val BLOB
            )",
        )
        .await
        .expect("Failed to create table");

    // Insert test data
    driver
        .execute_query(
            PoolRef::Sqlite(&pool),
            "INSERT INTO type_test (int_val, real_val, text_val, blob_val)
             VALUES (42, 3.14159, 'hello', X'48454C4C4F')",
        )
        .await
        .expect("Failed to insert data");

    // Query and verify types are handled correctly
    let result = driver
        .execute_query(PoolRef::Sqlite(&pool), "SELECT * FROM type_test")
        .await
        .expect("Failed to query data");

    assert_eq!(result.rows.len(), 1, "Should have 1 row");
    let row = &result.rows[0];

    assert_eq!(row[1], serde_json::json!(42));
    assert_eq!(row[3], serde_json::json!("hello"));
}

#[tokio::test]
async fn test_sqlite_null_handling() {
    let temp_file = NamedTempFile::new().expect("Failed to create temp file");
    let db_path = temp_file.path();

    let pool = create_pool(db_path).await;
    let driver = SqliteDriver;

    driver
        .execute_query(
            PoolRef::Sqlite(&pool),
            "CREATE TABLE null_test (id INTEGER PRIMARY KEY, nullable_col TEXT)",
        )
        .await
        .expect("Failed to create table");

    driver
        .execute_query(
            PoolRef::Sqlite(&pool),
            "INSERT INTO null_test (nullable_col) VALUES (NULL), ('not null')",
        )
        .await
        .expect("Failed to insert data");

    let result = driver
        .execute_query(PoolRef::Sqlite(&pool), "SELECT * FROM null_test ORDER BY id")
        .await
        .expect("Failed to query data");

    assert_eq!(result.rows.len(), 2);
    // SQLite may represent NULL as null or empty string depending on driver implementation
    let first_val = &result.rows[0][1];
    assert!(
        first_val.is_null() || first_val == &serde_json::json!(""),
        "First row should have NULL or empty, got: {:?}",
        first_val
    );
    assert_eq!(result.rows[1][1], serde_json::json!("not null"));
}

#[tokio::test]
async fn test_sqlite_generate_ddl() {
    let temp_file = NamedTempFile::new().expect("Failed to create temp file");
    let db_path = temp_file.path();

    let pool = create_pool(db_path).await;
    let driver = SqliteDriver;

    // Create a table
    driver
        .execute_query(
            PoolRef::Sqlite(&pool),
            "CREATE TABLE ddl_test (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                value REAL DEFAULT 0.00
            )",
        )
        .await
        .expect("Failed to create table");

    let ddl = driver
        .generate_table_ddl(PoolRef::Sqlite(&pool), "ddl_test")
        .await;

    assert!(ddl.is_ok(), "generate_table_ddl failed: {:?}", ddl.err());
    let ddl_string = ddl.unwrap();

    assert!(ddl_string.contains("CREATE TABLE"), "DDL should contain CREATE TABLE");
}

#[tokio::test]
async fn test_sqlite_multiple_statements() {
    let temp_file = NamedTempFile::new().expect("Failed to create temp file");
    let db_path = temp_file.path();

    let pool = create_pool(db_path).await;
    let driver = SqliteDriver;

    // Execute multiple statements
    let result = driver
        .execute_query(
            PoolRef::Sqlite(&pool),
            "CREATE TABLE multi_test (id INTEGER PRIMARY KEY, val INTEGER);
             INSERT INTO multi_test (val) VALUES (1), (2), (3);
             SELECT * FROM multi_test ORDER BY id",
        )
        .await;

    assert!(result.is_ok(), "Multiple statements failed: {:?}", result.err());
    let data = result.unwrap();

    // Should return SELECT results
    assert_eq!(data.rows.len(), 3, "Should have 3 rows from SELECT");
}

#[tokio::test]
async fn test_sqlite_update_and_delete() {
    let temp_file = NamedTempFile::new().expect("Failed to create temp file");
    let db_path = temp_file.path();

    let pool = create_pool(db_path).await;
    let driver = SqliteDriver;

    // Create and populate table
    driver
        .execute_query(
            PoolRef::Sqlite(&pool),
            "CREATE TABLE crud_test (id INTEGER PRIMARY KEY, val INTEGER)",
        )
        .await
        .expect("Failed to create table");

    driver
        .execute_query(
            PoolRef::Sqlite(&pool),
            "INSERT INTO crud_test (val) VALUES (1), (2), (3)",
        )
        .await
        .expect("Failed to insert data");

    // Update
    let update_result = driver
        .execute_query(
            PoolRef::Sqlite(&pool),
            "UPDATE crud_test SET val = val * 10 WHERE val > 1",
        )
        .await
        .expect("UPDATE failed");

    assert_eq!(update_result.affected_rows, Some(2), "Should update 2 rows");

    // Delete
    let delete_result = driver
        .execute_query(PoolRef::Sqlite(&pool), "DELETE FROM crud_test WHERE val = 1")
        .await
        .expect("DELETE failed");

    assert_eq!(delete_result.affected_rows, Some(1), "Should delete 1 row");

    // Verify final state
    let final_result = driver
        .execute_query(PoolRef::Sqlite(&pool), "SELECT COUNT(*) as cnt FROM crud_test")
        .await
        .expect("SELECT failed");

    assert_eq!(final_result.rows[0][0], serde_json::json!(2), "Should have 2 rows remaining");
}

#[tokio::test]
async fn test_sqlite_rename_table() {
    let temp_file = NamedTempFile::new().expect("Failed to create temp file");
    let db_path = temp_file.path();

    let pool = create_pool(db_path).await;
    let driver = SqliteDriver;

    // Create table
    driver
        .execute_query(
            PoolRef::Sqlite(&pool),
            "CREATE TABLE old_name (id INTEGER PRIMARY KEY, val TEXT)",
        )
        .await
        .expect("Failed to create table");

    // Rename table
    let rename_result = driver
        .rename_table(PoolRef::Sqlite(&pool), "old_name", "new_name")
        .await;

    assert!(rename_result.is_ok(), "rename_table failed: {:?}", rename_result.err());

    // Verify old table doesn't exist
    let old_check = driver
        .execute_query(PoolRef::Sqlite(&pool), "SELECT * FROM old_name")
        .await;
    assert!(old_check.is_err(), "Old table should not exist");

    // Verify new table exists
    let new_check = driver
        .execute_query(PoolRef::Sqlite(&pool), "SELECT * FROM new_name")
        .await;
    assert!(new_check.is_ok(), "New table should exist");
}

#[tokio::test]
async fn test_sqlite_indexes() {
    let temp_file = NamedTempFile::new().expect("Failed to create temp file");
    let db_path = temp_file.path();

    let pool = create_pool(db_path).await;
    let driver = SqliteDriver;

    // Create table with indexes
    driver
        .execute_query(
            PoolRef::Sqlite(&pool),
            "CREATE TABLE indexed_test (
                id INTEGER PRIMARY KEY,
                name TEXT,
                email TEXT UNIQUE,
                category TEXT
            )",
        )
        .await
        .expect("Failed to create table");

    // Create additional index
    driver
        .execute_query(
            PoolRef::Sqlite(&pool),
            "CREATE INDEX idx_category ON indexed_test(category)",
        )
        .await
        .expect("Failed to create index");

    let indexes = driver
        .get_indexes(PoolRef::Sqlite(&pool), "indexed_test")
        .await;

    assert!(indexes.is_ok(), "get_indexes failed: {:?}", indexes.err());
    let index_list = indexes.unwrap();

    // Should have at least the category index
    assert!(!index_list.is_empty(), "Should have indexes");
    let idx_names: Vec<&str> = index_list.iter().map(|i| i.name.as_str()).collect();
    assert!(
        idx_names.iter().any(|n| n.contains("category")),
        "Should find category index, got: {:?}",
        idx_names
    );
}

#[tokio::test]
async fn test_sqlite_transaction_behavior() {
    let temp_file = NamedTempFile::new().expect("Failed to create temp file");
    let db_path = temp_file.path();

    let pool = create_pool(db_path).await;
    let driver = SqliteDriver;

    // Create table
    driver
        .execute_query(
            PoolRef::Sqlite(&pool),
            "CREATE TABLE tx_test (id INTEGER PRIMARY KEY, val TEXT UNIQUE)",
        )
        .await
        .expect("Failed to create table");

    // This should fail on the second insert due to UNIQUE constraint
    let result = driver
        .execute_query(
            PoolRef::Sqlite(&pool),
            "INSERT INTO tx_test (val) VALUES ('a');
             INSERT INTO tx_test (val) VALUES ('a')", // Duplicate
        )
        .await;

    assert!(result.is_err(), "Should fail due to unique constraint");

    // Verify state after failure (depends on transaction handling)
    let check = driver
        .execute_query(PoolRef::Sqlite(&pool), "SELECT COUNT(*) as cnt FROM tx_test")
        .await
        .expect("Failed to check count");

    // SQLite with multiple statements should rollback on error
    println!("Row count after failed transaction: {:?}", check.rows[0][0]);
}
