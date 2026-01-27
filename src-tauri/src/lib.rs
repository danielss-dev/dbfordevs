mod commands;
pub mod db;
pub mod error;
pub mod models;
pub mod oracle_client;
mod ssh;
mod storage;

use commands::{cassandra, connections, diff, functions, import, indexes, mongodb, oracle, procedures, queries, redis, sequences, tables, triggers, users, utils, views};

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
            connections::test_ssl_connection,
            connections::get_ssl_support_info,
            // Query commands
            queries::execute_query,
            queries::preview_query,
            queries::explain_query,
            queries::get_tables,
            queries::get_table_schema,
            queries::get_all_table_schemas,
            queries::get_mssql_databases,
            queries::get_mssql_database_tables,
            queries::create_mssql_database,
            queries::drop_mssql_database,
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
            // Stored procedure management commands
            procedures::get_procedures,
            procedures::get_procedure_ddl,
            procedures::create_procedure,
            procedures::drop_procedure,
            // Function management commands
            functions::get_functions,
            functions::get_function_ddl,
            functions::create_function,
            functions::drop_function,
            // Trigger management commands
            triggers::get_triggers,
            triggers::get_trigger_ddl,
            triggers::create_trigger,
            triggers::drop_trigger,
            // Sequence management commands
            sequences::get_sequences,
            sequences::get_sequence_ddl,
            sequences::create_sequence,
            sequences::drop_sequence,
            // Redis commands
            redis::redis_scan_keys,
            redis::redis_get_key_info,
            redis::redis_delete_key,
            redis::redis_delete_keys,
            redis::redis_set_ttl,
            redis::redis_rename_key,
            redis::redis_get_string,
            redis::redis_set_string,
            redis::redis_get_list,
            redis::redis_list_push,
            redis::redis_list_set,
            redis::redis_list_remove,
            redis::redis_get_set,
            redis::redis_get_set_full,
            redis::redis_set_add,
            redis::redis_set_remove,
            redis::redis_get_hash,
            redis::redis_get_hash_full,
            redis::redis_hash_set,
            redis::redis_hash_delete,
            redis::redis_get_zset,
            redis::redis_zset_add,
            redis::redis_zset_remove,
            redis::redis_zset_update_score,
            redis::redis_get_stream,
            redis::redis_stream_add,
            redis::redis_stream_delete,
            redis::redis_execute_command,
            redis::redis_get_info,
            redis::redis_get_memory_stats,
            redis::redis_flush_db,
            redis::redis_pubsub_channels,
            redis::redis_pubsub_publish,
            // MongoDB commands
            mongodb::mongodb_list_databases,
            mongodb::mongodb_get_database_stats,
            mongodb::mongodb_drop_database,
            mongodb::mongodb_list_collections,
            mongodb::mongodb_get_collection_stats,
            mongodb::mongodb_create_collection,
            mongodb::mongodb_drop_collection,
            mongodb::mongodb_rename_collection,
            mongodb::mongodb_find_documents,
            mongodb::mongodb_insert_document,
            mongodb::mongodb_insert_documents,
            mongodb::mongodb_update_document,
            mongodb::mongodb_update_documents,
            mongodb::mongodb_delete_document,
            mongodb::mongodb_delete_documents,
            mongodb::mongodb_get_document_by_id,
            mongodb::mongodb_replace_document,
            mongodb::mongodb_list_indexes,
            mongodb::mongodb_create_index,
            mongodb::mongodb_drop_index,
            mongodb::mongodb_aggregate,
            mongodb::mongodb_get_server_info,
            mongodb::mongodb_run_command,
            // Cassandra commands
            cassandra::cassandra_list_keyspaces,
            cassandra::cassandra_create_keyspace,
            cassandra::cassandra_drop_keyspace,
            cassandra::cassandra_list_tables,
            cassandra::cassandra_describe_table,
            cassandra::cassandra_drop_table,
            cassandra::cassandra_truncate_table,
            cassandra::cassandra_execute_cql,
            cassandra::cassandra_list_indexes,
            cassandra::cassandra_get_server_info,
            // Schema diff commands
            diff::compare_table_schemas,
            diff::compare_with_snapshot,
            diff::save_schema_snapshot,
            diff::list_schema_snapshots,
            diff::delete_schema_snapshot,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

