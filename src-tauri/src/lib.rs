mod commands;
mod db;
mod error;
mod extensions;
mod models;
mod storage;

use commands::{connections, extensions as ext_cmds, queries, tables, validators, utils};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Install default drivers for sqlx::any
    sqlx::any::install_default_drivers();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(ext_cmds::ExtensionState::new())
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
            // Validator commands
            validators::validate_connection_string,
            validators::list_validators,
            // Extension commands
            ext_cmds::list_extensions,
            ext_cmds::get_extension,
            ext_cmds::enable_extension,
            ext_cmds::disable_extension,
            ext_cmds::uninstall_extension,
            ext_cmds::install_extension_from_github,
            ext_cmds::update_extension_settings,
            ext_cmds::get_extension_settings,
            // AI Assistant commands
            ext_cmds::ai_generate_sql,
            ext_cmds::ai_explain_query,
            ext_cmds::ai_chat,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

