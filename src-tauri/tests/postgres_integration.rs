//! PostgreSQL integration tests using testcontainers.
//!
//! These tests require Docker to be running.
//! Run with: cargo test --test postgres_integration -- --nocapture

mod common;

use dbfordevs::db::{DatabaseDriver, PostgresDriver, PoolRef};
use sqlx::postgres::PgPoolOptions;
use testcontainers::{runners::AsyncRunner, ImageExt};
use testcontainers_modules::postgres::Postgres;

/// Helper to create a connection pool from container
async fn create_pool(host: &str, port: u16) -> sqlx::PgPool {
    let connection_string = format!(
        "postgresql://postgres:postgres@{}:{}/postgres",
        host, port
    );

    PgPoolOptions::new()
        .max_connections(5)
        .connect(&connection_string)
        .await
        .expect("Failed to create pool")
}

#[tokio::test]
async fn test_postgres_connection() {
    // Start PostgreSQL container
    let container = Postgres::default()
        .with_tag("15-alpine")
        .start()
        .await
        .expect("Failed to start PostgreSQL container");

    let host = container.get_host().await.expect("Failed to get host");
    let port = container.get_host_port_ipv4(5432).await.expect("Failed to get port");

    let config = common::postgres_config(
        &host.to_string(),
        port,
        "postgres",
        "postgres",
        "postgres",
    );

    let driver = PostgresDriver;
    let result = driver.test_connection(&config).await;

    assert!(result.is_ok(), "Connection test failed: {:?}", result.err());
    let test_result = result.unwrap();
    assert!(test_result.success, "Connection was not successful");
    assert!(test_result.server_version.is_some(), "Server version should be present");
    assert!(
        test_result.server_version.as_ref().unwrap().contains("PostgreSQL"),
        "Server version should contain 'PostgreSQL'"
    );
}

#[tokio::test]
async fn test_postgres_execute_select() {
    let container = Postgres::default()
        .with_tag("15-alpine")
        .start()
        .await
        .expect("Failed to start PostgreSQL container");

    let host = container.get_host().await.expect("Failed to get host");
    let port = container.get_host_port_ipv4(5432).await.expect("Failed to get port");

    let pool = create_pool(&host.to_string(), port).await;
    let driver = PostgresDriver;

    // Test simple SELECT
    let result = driver
        .execute_query(PoolRef::Postgres(&pool), "SELECT 1 as num, 'hello' as greeting")
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
async fn test_postgres_create_table_and_insert() {
    let container = Postgres::default()
        .with_tag("15-alpine")
        .start()
        .await
        .expect("Failed to start PostgreSQL container");

    let host = container.get_host().await.expect("Failed to get host");
    let port = container.get_host_port_ipv4(5432).await.expect("Failed to get port");

    let pool = create_pool(&host.to_string(), port).await;
    let driver = PostgresDriver;

    // Create table
    let create_result = driver
        .execute_query(
            PoolRef::Postgres(&pool),
            "CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(255) UNIQUE,
                active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .await;

    assert!(create_result.is_ok(), "CREATE TABLE failed: {:?}", create_result.err());

    // Insert data
    let insert_result = driver
        .execute_query(
            PoolRef::Postgres(&pool),
            "INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com')",
        )
        .await;

    assert!(insert_result.is_ok(), "INSERT failed: {:?}", insert_result.err());
    let insert_data = insert_result.unwrap();
    assert_eq!(insert_data.affected_rows, Some(1), "Should affect 1 row");

    // Select data
    let select_result = driver
        .execute_query(PoolRef::Postgres(&pool), "SELECT * FROM users")
        .await;

    assert!(select_result.is_ok(), "SELECT failed: {:?}", select_result.err());
    let select_data = select_result.unwrap();
    assert_eq!(select_data.rows.len(), 1, "Should have 1 row");
    assert_eq!(select_data.rows[0][1], serde_json::json!("John Doe"));
}

#[tokio::test]
async fn test_postgres_get_tables() {
    let container = Postgres::default()
        .with_tag("15-alpine")
        .start()
        .await
        .expect("Failed to start PostgreSQL container");

    let host = container.get_host().await.expect("Failed to get host");
    let port = container.get_host_port_ipv4(5432).await.expect("Failed to get port");

    let pool = create_pool(&host.to_string(), port).await;
    let driver = PostgresDriver;

    // Create some tables
    driver
        .execute_query(PoolRef::Postgres(&pool), "CREATE TABLE products (id SERIAL PRIMARY KEY, name VARCHAR(100))")
        .await
        .expect("Failed to create products table");

    driver
        .execute_query(PoolRef::Postgres(&pool), "CREATE TABLE orders (id SERIAL PRIMARY KEY, product_id INT)")
        .await
        .expect("Failed to create orders table");

    let config = common::postgres_config(
        &host.to_string(),
        port,
        "postgres",
        "postgres",
        "postgres",
    );

    let tables = driver.get_tables(PoolRef::Postgres(&pool), &config).await;

    assert!(tables.is_ok(), "get_tables failed: {:?}", tables.err());
    let table_list = tables.unwrap();

    // Should find our tables in public schema
    let table_names: Vec<&str> = table_list.iter().map(|t| t.name.as_str()).collect();
    assert!(
        table_names.iter().any(|n| n.ends_with("products")),
        "Should find products table, got: {:?}",
        table_names
    );
    assert!(
        table_names.iter().any(|n| n.ends_with("orders")),
        "Should find orders table, got: {:?}",
        table_names
    );
}

#[tokio::test]
async fn test_postgres_get_table_schema() {
    let container = Postgres::default()
        .with_tag("15-alpine")
        .start()
        .await
        .expect("Failed to start PostgreSQL container");

    let host = container.get_host().await.expect("Failed to get host");
    let port = container.get_host_port_ipv4(5432).await.expect("Failed to get port");

    let pool = create_pool(&host.to_string(), port).await;
    let driver = PostgresDriver;

    // Create a table with various column types
    driver
        .execute_query(
            PoolRef::Postgres(&pool),
            "CREATE TABLE test_schema (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                price NUMERIC(10,2),
                quantity INTEGER DEFAULT 0,
                is_available BOOLEAN,
                tags TEXT[]
            )",
        )
        .await
        .expect("Failed to create table");

    let schema = driver
        .get_table_schema(PoolRef::Postgres(&pool), "public.test_schema")
        .await;

    assert!(schema.is_ok(), "get_table_schema failed: {:?}", schema.err());
    let table_schema = schema.unwrap();

    assert_eq!(table_schema.columns.len(), 6, "Should have 6 columns");

    // Check primary key
    assert!(table_schema.primary_keys.contains(&"id".to_string()), "id should be primary key");

    // Check column properties
    let id_col = table_schema.columns.iter().find(|c| c.name == "id").unwrap();
    assert!(id_col.is_primary_key, "id column should be marked as primary key");
    assert!(!id_col.nullable, "id should not be nullable");

    let name_col = table_schema.columns.iter().find(|c| c.name == "name").unwrap();
    assert!(!name_col.nullable, "name should not be nullable");

    let quantity_col = table_schema.columns.iter().find(|c| c.name == "quantity").unwrap();
    assert!(quantity_col.nullable, "quantity should be nullable");
}

#[tokio::test]
async fn test_postgres_foreign_keys() {
    let container = Postgres::default()
        .with_tag("15-alpine")
        .start()
        .await
        .expect("Failed to start PostgreSQL container");

    let host = container.get_host().await.expect("Failed to get host");
    let port = container.get_host_port_ipv4(5432).await.expect("Failed to get port");

    let pool = create_pool(&host.to_string(), port).await;
    let driver = PostgresDriver;

    // Create parent table
    driver
        .execute_query(
            PoolRef::Postgres(&pool),
            "CREATE TABLE categories (id SERIAL PRIMARY KEY, name VARCHAR(100))",
        )
        .await
        .expect("Failed to create categories table");

    // Create child table with foreign key
    driver
        .execute_query(
            PoolRef::Postgres(&pool),
            "CREATE TABLE items (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                category_id INTEGER REFERENCES categories(id)
            )",
        )
        .await
        .expect("Failed to create items table");

    let schema = driver
        .get_table_schema(PoolRef::Postgres(&pool), "public.items")
        .await
        .expect("Failed to get table schema");

    assert_eq!(schema.foreign_keys.len(), 1, "Should have 1 foreign key");
    let fk = &schema.foreign_keys[0];
    assert_eq!(fk.column, "category_id");
    assert_eq!(fk.references_table, "categories");
    assert_eq!(fk.references_column, "id");
}

#[tokio::test]
async fn test_postgres_multiple_statements() {
    let container = Postgres::default()
        .with_tag("15-alpine")
        .start()
        .await
        .expect("Failed to start PostgreSQL container");

    let host = container.get_host().await.expect("Failed to get host");
    let port = container.get_host_port_ipv4(5432).await.expect("Failed to get port");

    let pool = create_pool(&host.to_string(), port).await;
    let driver = PostgresDriver;

    // Execute multiple statements
    let result = driver
        .execute_query(
            PoolRef::Postgres(&pool),
            "CREATE TABLE multi_test (id SERIAL PRIMARY KEY, val INT);
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
async fn test_postgres_generate_ddl() {
    let container = Postgres::default()
        .with_tag("15-alpine")
        .start()
        .await
        .expect("Failed to start PostgreSQL container");

    let host = container.get_host().await.expect("Failed to get host");
    let port = container.get_host_port_ipv4(5432).await.expect("Failed to get port");

    let pool = create_pool(&host.to_string(), port).await;
    let driver = PostgresDriver;

    // Create a table
    driver
        .execute_query(
            PoolRef::Postgres(&pool),
            "CREATE TABLE ddl_test (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                value NUMERIC(10,2) DEFAULT 0.00
            )",
        )
        .await
        .expect("Failed to create table");

    let ddl = driver
        .generate_table_ddl(PoolRef::Postgres(&pool), "public.ddl_test")
        .await;

    assert!(ddl.is_ok(), "generate_table_ddl failed: {:?}", ddl.err());
    let ddl_string = ddl.unwrap();

    assert!(ddl_string.contains("CREATE TABLE"), "DDL should contain CREATE TABLE");
    assert!(ddl_string.contains("\"id\""), "DDL should contain id column");
    assert!(ddl_string.contains("\"name\""), "DDL should contain name column");
    assert!(ddl_string.contains("PRIMARY KEY"), "DDL should contain PRIMARY KEY");
}

#[tokio::test]
async fn test_postgres_data_types() {
    let container = Postgres::default()
        .with_tag("15-alpine")
        .start()
        .await
        .expect("Failed to start PostgreSQL container");

    let host = container.get_host().await.expect("Failed to get host");
    let port = container.get_host_port_ipv4(5432).await.expect("Failed to get port");

    let pool = create_pool(&host.to_string(), port).await;
    let driver = PostgresDriver;

    // Create table with various data types
    driver
        .execute_query(
            PoolRef::Postgres(&pool),
            "CREATE TABLE type_test (
                id SERIAL PRIMARY KEY,
                int_val INTEGER,
                bigint_val BIGINT,
                float_val DOUBLE PRECISION,
                decimal_val NUMERIC(10,2),
                bool_val BOOLEAN,
                text_val TEXT,
                json_val JSONB,
                uuid_val UUID,
                timestamp_val TIMESTAMP,
                array_val INTEGER[]
            )",
        )
        .await
        .expect("Failed to create table");

    // Insert test data
    driver
        .execute_query(
            PoolRef::Postgres(&pool),
            "INSERT INTO type_test (int_val, bigint_val, float_val, decimal_val, bool_val, text_val, json_val, uuid_val, timestamp_val, array_val)
             VALUES (42, 9223372036854775807, 3.14159, 123.45, true, 'hello', '{\"key\": \"value\"}', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2024-01-15 10:30:00', ARRAY[1,2,3])",
        )
        .await
        .expect("Failed to insert data");

    // Query and verify types are handled correctly
    let result = driver
        .execute_query(PoolRef::Postgres(&pool), "SELECT * FROM type_test")
        .await
        .expect("Failed to query data");

    assert_eq!(result.rows.len(), 1, "Should have 1 row");
    let row = &result.rows[0];

    // Verify various type conversions
    assert_eq!(row[1], serde_json::json!(42)); // int_val
    // bool_val - PostgreSQL may return true as bool or as string "t"/"true"
    let bool_val = &row[5]; // index 5 is bool_val (after id, int_val, bigint_val, float_val, decimal_val)
    assert!(
        bool_val == &serde_json::json!(true) || bool_val == &serde_json::json!("t") || bool_val == &serde_json::json!("true"),
        "bool_val should be true, got: {:?}",
        bool_val
    );
    assert_eq!(row[7]["key"], "value"); // json_val (index 7)
}

#[tokio::test]
async fn test_postgres_null_handling() {
    let container = Postgres::default()
        .with_tag("15-alpine")
        .start()
        .await
        .expect("Failed to start PostgreSQL container");

    let host = container.get_host().await.expect("Failed to get host");
    let port = container.get_host_port_ipv4(5432).await.expect("Failed to get port");

    let pool = create_pool(&host.to_string(), port).await;
    let driver = PostgresDriver;

    driver
        .execute_query(
            PoolRef::Postgres(&pool),
            "CREATE TABLE null_test (id SERIAL PRIMARY KEY, nullable_col TEXT)",
        )
        .await
        .expect("Failed to create table");

    driver
        .execute_query(
            PoolRef::Postgres(&pool),
            "INSERT INTO null_test (nullable_col) VALUES (NULL), ('not null')",
        )
        .await
        .expect("Failed to insert data");

    let result = driver
        .execute_query(PoolRef::Postgres(&pool), "SELECT * FROM null_test ORDER BY id")
        .await
        .expect("Failed to query data");

    assert_eq!(result.rows.len(), 2);
    assert!(result.rows[0][1].is_null(), "First row should have NULL");
    assert_eq!(result.rows[1][1], serde_json::json!("not null"));
}

#[tokio::test]
async fn test_postgres_transaction_rollback_on_error() {
    let container = Postgres::default()
        .with_tag("15-alpine")
        .start()
        .await
        .expect("Failed to start PostgreSQL container");

    let host = container.get_host().await.expect("Failed to get host");
    let port = container.get_host_port_ipv4(5432).await.expect("Failed to get port");

    let pool = create_pool(&host.to_string(), port).await;
    let driver = PostgresDriver;

    // Create table
    driver
        .execute_query(
            PoolRef::Postgres(&pool),
            "CREATE TABLE rollback_test (id SERIAL PRIMARY KEY, val INT UNIQUE)",
        )
        .await
        .expect("Failed to create table");

    // This should fail on the second insert due to UNIQUE constraint
    // The first insert should be rolled back
    let result = driver
        .execute_query(
            PoolRef::Postgres(&pool),
            "INSERT INTO rollback_test (val) VALUES (1);
             INSERT INTO rollback_test (val) VALUES (1)", // Duplicate - should fail
        )
        .await;

    assert!(result.is_err(), "Should fail due to unique constraint");

    // Verify nothing was inserted (transaction was rolled back)
    let check = driver
        .execute_query(PoolRef::Postgres(&pool), "SELECT COUNT(*) as cnt FROM rollback_test")
        .await
        .expect("Failed to check count");

    assert_eq!(check.rows[0][0], serde_json::json!(0), "Table should be empty after rollback");
}
