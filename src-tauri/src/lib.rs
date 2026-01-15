mod commands;
pub mod db;
pub mod error;
pub mod models;
pub mod oracle_client;
mod ssh;
mod storage;

use commands::{connections, import, indexes, oracle, queries, tables, users, utils, views};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Install default drivers for sqlx::any
    sqlx::any::install_default_drivers();

    // Configure Oracle client library path if available
    let _ = oracle_client::configure_oracle_lib_path();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
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
            queries::preview_query,
            queries::explain_query,
            queries::get_tables,
            queries::get_table_schema,
            queries::get_all_table_schemas,
            queries::get_mssql_databases,
            queries::get_mssql_database_tables,
            queries::insert_row,
            queries::update_row,
            queries::delete_row,
            queries::drop_table,
            // Table commands
            tables::generate_table_ddl,
            tables::rename_table,
            tables::get_table_properties,
            tables::get_table_relationships,
            tables::generate_create_table_ddl,
            tables::create_table,
            tables::get_referenceable_tables,
            // Utility commands
            utils::copy_to_clipboard,
            utils::read_from_clipboard,
            // Import commands
            import::preview_import,
            import::execute_import,
            import::cancel_import,
            // Oracle client setup commands
            oracle::check_oracle_client_status,
            oracle::get_oracle_download_info,
            oracle::download_oracle_client,
            // User management commands
            users::supports_user_management,
            users::get_users,
            users::create_user,
            users::delete_user,
            users::change_password,
            users::get_roles,
            users::create_role,
            users::delete_role,
            users::get_permissions,
            users::get_available_privileges,
            users::grant_permission,
            users::revoke_permission,
            users::grant_role,
            users::revoke_role,
            // View management commands
            views::get_views,
            views::get_view_ddl,
            views::create_view,
            views::drop_view,
            // Index management commands
            indexes::get_all_indexes,
            indexes::get_index_ddl,
            indexes::create_index,
            indexes::drop_index,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

