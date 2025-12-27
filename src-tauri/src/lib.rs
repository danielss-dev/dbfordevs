mod commands;
mod db;
mod error;
mod models;
mod storage;

use commands::{connections, queries, tables, utils};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Install default drivers for sqlx::any
    sqlx::any::install_default_drivers();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            // Connection commands
            connections::test_connection,
            connections::save_connection,
            connections::connect,
            connections::disconnect,
            connections::list_connections,
            connections::delete_connection,
            connections::get_connection,
            // Query commands
            queries::execute_query,
            queries::get_tables,
            queries::get_table_schema,
            queries::get_all_table_schemas,
            queries::insert_row,
            queries::update_row,
            queries::delete_row,
            queries::drop_table,
            // Table commands
            tables::generate_table_ddl,
            tables::rename_table,
            tables::get_table_properties,
            tables::get_table_relationships,
            // Utility commands
            utils::copy_to_clipboard,
            utils::read_from_clipboard,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

