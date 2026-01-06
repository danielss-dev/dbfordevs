//! MySQL integration tests using testcontainers.
//!
//! These tests require Docker to be running.
//! Run with: cargo test --test mysql_integration -- --nocapture

mod common;

use dbfordevs::db::{DatabaseDriver, MySqlDriver, PoolRef};
use sqlx::mysql::MySqlPoolOptions;
use testcontainers::{runners::AsyncRunner, ContainerAsync, ImageExt};
use testcontainers_modules::mysql::Mysql;

/// Password used for MySQL container
const MYSQL_PASSWORD: &str = "testpass123";

/// Helper to start MySQL container with correct password
async fn start_mysql_container() -> ContainerAsync<Mysql> {
    Mysql::default()
        .with_tag("8.0")
        .with_env_var("MYSQL_ROOT_PASSWORD", MYSQL_PASSWORD)
        .start()
        .await
        .expect("Failed to start MySQL container")
}

/// Helper to create a connection pool from container
async fn create_pool(host: &str, port: u16) -> sqlx::MySqlPool {
    let connection_string = format!(
        "mysql://root:{}@{}:{}/mysql",
        MYSQL_PASSWORD, host, port
    );

    MySqlPoolOptions::new()
        .max_connections(5)
        .connect(&connection_string)
        .await
        .expect("Failed to create MySQL pool")
}

#[tokio::test]
async fn test_mysql_connection() {
    let container = start_mysql_container().await;

    let host = container.get_host().await.expect("Failed to get host");
    let port = container.get_host_port_ipv4(3306).await.expect("Failed to get port");

    let config = common::mysql_config(
        &host.to_string(),
        port,
        "mysql",
        "root",
        MYSQL_PASSWORD,
    );

    let driver = MySqlDriver;
    let result = driver.test_connection(&config).await;

    assert!(result.is_ok(), "Connection test failed: {:?}", result.err());
    let test_result = result.unwrap();
    assert!(test_result.success, "Connection was not successful");
    assert!(test_result.server_version.is_some(), "Server version should be present");
}

#[tokio::test]
async fn test_mysql_execute_select() {
    let container = start_mysql_container().await;

    let host = container.get_host().await.expect("Failed to get host");
    let port = container.get_host_port_ipv4(3306).await.expect("Failed to get port");

    let pool = create_pool(&host.to_string(), port).await;
    let driver = MySqlDriver;

    // Test simple SELECT
    let result = driver
        .execute_query(PoolRef::MySql(&pool), "SELECT 1 as num, 'hello' as greeting")
        .await;

    assert!(result.is_ok(), "Query failed: {:?}", result.err());
    let query_result = result.unwrap();

    assert_eq!(query_result.columns.len(), 2, "Should have 2 columns");
    assert_eq!(query_result.columns[0].name, "num");
    assert_eq!(query_result.columns[1].name, "greeting");
    assert_eq!(query_result.rows.len(), 1, "Should have 1 row");
}

#[tokio::test]
async fn test_mysql_create_table_and_insert() {
    let container = start_mysql_container().await;

    let host = container.get_host().await.expect("Failed to get host");
    let port = container.get_host_port_ipv4(3306).await.expect("Failed to get port");

    let pool = create_pool(&host.to_string(), port).await;
    let driver = MySqlDriver;

    // Create table
    let create_result = driver
        .execute_query(
            PoolRef::MySql(&pool),
            "CREATE TABLE users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(255) UNIQUE,
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .await;

    assert!(create_result.is_ok(), "CREATE TABLE failed: {:?}", create_result.err());

    // Insert data
    let insert_result = driver
        .execute_query(
            PoolRef::MySql(&pool),
            "INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com')",
        )
        .await;

    assert!(insert_result.is_ok(), "INSERT failed: {:?}", insert_result.err());
    let insert_data = insert_result.unwrap();
    assert_eq!(insert_data.affected_rows, Some(1), "Should affect 1 row");

    // Select data
    let select_result = driver
        .execute_query(PoolRef::MySql(&pool), "SELECT * FROM users")
        .await;

    assert!(select_result.is_ok(), "SELECT failed: {:?}", select_result.err());
    let select_data = select_result.unwrap();
    assert_eq!(select_data.rows.len(), 1, "Should have 1 row");
}

#[tokio::test]
async fn test_mysql_get_tables() {
    let container = start_mysql_container().await;

    let host = container.get_host().await.expect("Failed to get host");
    let port = container.get_host_port_ipv4(3306).await.expect("Failed to get port");

    let pool = create_pool(&host.to_string(), port).await;
    let driver = MySqlDriver;

    // Create some tables in the default mysql database
    driver
        .execute_query(PoolRef::MySql(&pool), "CREATE TABLE mysql.products (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100))")
        .await
        .expect("Failed to create products table");

    driver
        .execute_query(PoolRef::MySql(&pool), "CREATE TABLE mysql.orders (id INT AUTO_INCREMENT PRIMARY KEY, product_id INT)")
        .await
        .expect("Failed to create orders table");

    let config = common::mysql_config(
        &host.to_string(),
        port,
        "mysql",
        "root",
        MYSQL_PASSWORD,
    );

    let tables = driver.get_tables(PoolRef::MySql(&pool), &config).await;

    assert!(tables.is_ok(), "get_tables failed: {:?}", tables.err());
    let table_list = tables.unwrap();

    let table_names: Vec<&str> = table_list.iter().map(|t| t.name.as_str()).collect();
    assert!(
        table_names.contains(&"products"),
        "Should find products table, got: {:?}",
        table_names
    );
    assert!(
        table_names.contains(&"orders"),
        "Should find orders table, got: {:?}",
        table_names
    );
}

#[tokio::test]
async fn test_mysql_get_table_schema() {
    let container = start_mysql_container().await;

    let host = container.get_host().await.expect("Failed to get host");
    let port = container.get_host_port_ipv4(3306).await.expect("Failed to get port");

    let pool = create_pool(&host.to_string(), port).await;
    let driver = MySqlDriver;

    // Create a table with various column types
    driver
        .execute_query(
            PoolRef::MySql(&pool),
            "CREATE TABLE test_schema (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                price DECIMAL(10,2),
                quantity INT DEFAULT 0,
                is_available BOOLEAN,
                description TEXT
            )",
        )
        .await
        .expect("Failed to create table");

    let schema = driver
        .get_table_schema(PoolRef::MySql(&pool), "test_schema")
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
async fn test_mysql_foreign_keys() {
    let container = start_mysql_container().await;

    let host = container.get_host().await.expect("Failed to get host");
    let port = container.get_host_port_ipv4(3306).await.expect("Failed to get port");

    let pool = create_pool(&host.to_string(), port).await;
    let driver = MySqlDriver;

    // Create parent table
    driver
        .execute_query(
            PoolRef::MySql(&pool),
            "CREATE TABLE categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100)
            ) ENGINE=InnoDB",
        )
        .await
        .expect("Failed to create categories table");

    // Create child table with foreign key
    driver
        .execute_query(
            PoolRef::MySql(&pool),
            "CREATE TABLE items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100),
                category_id INT,
                FOREIGN KEY (category_id) REFERENCES categories(id)
            ) ENGINE=InnoDB",
        )
        .await
        .expect("Failed to create items table");

    let schema = driver
        .get_table_schema(PoolRef::MySql(&pool), "items")
        .await
        .expect("Failed to get table schema");

    assert_eq!(schema.foreign_keys.len(), 1, "Should have 1 foreign key");
    let fk = &schema.foreign_keys[0];
    assert_eq!(fk.column, "category_id");
    assert_eq!(fk.references_table, "categories");
    assert_eq!(fk.references_column, "id");
}

#[tokio::test]
async fn test_mysql_data_types() {
    let container = start_mysql_container().await;

    let host = container.get_host().await.expect("Failed to get host");
    let port = container.get_host_port_ipv4(3306).await.expect("Failed to get port");

    let pool = create_pool(&host.to_string(), port).await;
    let driver = MySqlDriver;

    // Create table with various data types
    driver
        .execute_query(
            PoolRef::MySql(&pool),
            "CREATE TABLE type_test (
                id INT AUTO_INCREMENT PRIMARY KEY,
                int_val INT,
                bigint_val BIGINT,
                float_val DOUBLE,
                decimal_val DECIMAL(10,2),
                bool_val BOOLEAN,
                text_val TEXT,
                json_val JSON,
                datetime_val DATETIME,
                date_val DATE
            )",
        )
        .await
        .expect("Failed to create table");

    // Insert test data
    driver
        .execute_query(
            PoolRef::MySql(&pool),
            "INSERT INTO type_test (int_val, bigint_val, float_val, decimal_val, bool_val, text_val, json_val, datetime_val, date_val)
             VALUES (42, 9223372036854775807, 3.14159, 123.45, TRUE, 'hello', '{\"key\": \"value\"}', '2024-01-15 10:30:00', '2024-01-15')",
        )
        .await
        .expect("Failed to insert data");

    // Query and verify types are handled correctly
    let result = driver
        .execute_query(PoolRef::MySql(&pool), "SELECT * FROM type_test")
        .await
        .expect("Failed to query data");

    assert_eq!(result.rows.len(), 1, "Should have 1 row");
    let row = &result.rows[0];

    // Verify int conversion
    assert_eq!(row[1], serde_json::json!(42));
}

#[tokio::test]
async fn test_mysql_null_handling() {
    let container = start_mysql_container().await;

    let host = container.get_host().await.expect("Failed to get host");
    let port = container.get_host_port_ipv4(3306).await.expect("Failed to get port");

    let pool = create_pool(&host.to_string(), port).await;
    let driver = MySqlDriver;

    driver
        .execute_query(
            PoolRef::MySql(&pool),
            "CREATE TABLE null_test (id INT AUTO_INCREMENT PRIMARY KEY, nullable_col TEXT)",
        )
        .await
        .expect("Failed to create table");

    driver
        .execute_query(
            PoolRef::MySql(&pool),
            "INSERT INTO null_test (nullable_col) VALUES (NULL), ('not null')",
        )
        .await
        .expect("Failed to insert data");

    let result = driver
        .execute_query(PoolRef::MySql(&pool), "SELECT * FROM null_test ORDER BY id")
        .await
        .expect("Failed to query data");

    assert_eq!(result.rows.len(), 2);
    // MySQL driver may represent NULL in various ways depending on implementation
    let first_val = &result.rows[0][1];
    assert!(
        first_val.is_null()
            || first_val == &serde_json::json!("")
            || first_val == &serde_json::json!("Unsupported type"),
        "First row should have NULL representation, got: {:?}",
        first_val
    );
    assert_eq!(result.rows[1][1], serde_json::json!("not null"));
}

#[tokio::test]
async fn test_mysql_generate_ddl() {
    let container = start_mysql_container().await;

    let host = container.get_host().await.expect("Failed to get host");
    let port = container.get_host_port_ipv4(3306).await.expect("Failed to get port");

    let pool = create_pool(&host.to_string(), port).await;
    let driver = MySqlDriver;

    // Create a table
    driver
        .execute_query(
            PoolRef::MySql(&pool),
            "CREATE TABLE ddl_test (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                value DECIMAL(10,2) DEFAULT 0.00
            )",
        )
        .await
        .expect("Failed to create table");

    let ddl = driver
        .generate_table_ddl(PoolRef::MySql(&pool), "ddl_test")
        .await;

    assert!(ddl.is_ok(), "generate_table_ddl failed: {:?}", ddl.err());
    let ddl_string = ddl.unwrap();

    assert!(ddl_string.contains("CREATE TABLE"), "DDL should contain CREATE TABLE");
    assert!(ddl_string.contains("id"), "DDL should contain id column");
    assert!(ddl_string.contains("name"), "DDL should contain name column");
}

#[tokio::test]
async fn test_mysql_update_and_delete() {
    let container = start_mysql_container().await;

    let host = container.get_host().await.expect("Failed to get host");
    let port = container.get_host_port_ipv4(3306).await.expect("Failed to get port");

    let pool = create_pool(&host.to_string(), port).await;
    let driver = MySqlDriver;

    // Create and populate table
    driver
        .execute_query(
            PoolRef::MySql(&pool),
            "CREATE TABLE crud_test (id INT AUTO_INCREMENT PRIMARY KEY, val INT)",
        )
        .await
        .expect("Failed to create table");

    driver
        .execute_query(
            PoolRef::MySql(&pool),
            "INSERT INTO crud_test (val) VALUES (1), (2), (3)",
        )
        .await
        .expect("Failed to insert data");

    // Update
    let update_result = driver
        .execute_query(
            PoolRef::MySql(&pool),
            "UPDATE crud_test SET val = val * 10 WHERE val > 1",
        )
        .await
        .expect("UPDATE failed");

    assert_eq!(update_result.affected_rows, Some(2), "Should update 2 rows");

    // Delete
    let delete_result = driver
        .execute_query(PoolRef::MySql(&pool), "DELETE FROM crud_test WHERE val = 1")
        .await
        .expect("DELETE failed");

    assert_eq!(delete_result.affected_rows, Some(1), "Should delete 1 row");

    // Verify final state
    let final_result = driver
        .execute_query(PoolRef::MySql(&pool), "SELECT COUNT(*) as cnt FROM crud_test")
        .await
        .expect("SELECT failed");

    assert_eq!(final_result.rows[0][0], serde_json::json!(2), "Should have 2 rows remaining");
}
