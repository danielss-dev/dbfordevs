mod commands;
mod db;
mod error;
mod models;
mod storage;

use commands::{connections, queries, validators};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Install default drivers for sqlx::any
    sqlx::any::install_default_drivers();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            connections::test_connection,
            connections::save_connection,
            connections::connect,
            connections::disconnect,
            connections::list_connections,
            connections::delete_connection,
            connections::get_connection,
            queries::execute_query,
            queries::get_tables,
            queries::get_table_schema,
            queries::insert_row,
            queries::update_row,
            queries::delete_row,
            queries::drop_table,
            validators::validate_connection_string,
            validators::list_validators,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

