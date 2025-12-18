mod commands;
mod db;
mod error;
mod models;

use commands::{connections, queries, validators};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            connections::test_connection,
            connections::save_connection,
            connections::list_connections,
            connections::delete_connection,
            queries::execute_query,
            queries::get_tables,
            queries::get_table_schema,
            validators::validate_connection_string,
            validators::list_validators,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

