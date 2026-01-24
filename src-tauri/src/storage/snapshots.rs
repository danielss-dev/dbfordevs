use crate::error::{AppError, AppResult};
use crate::models::SchemaSnapshot;
use dirs::data_dir;
use serde_json;
use std::fs;
use std::path::PathBuf;

const SNAPSHOTS_FILE: &str = "schema_snapshots.json";

/// Get the path to the snapshots storage file
fn get_snapshots_path() -> AppResult<PathBuf> {
    let data_dir = data_dir()
        .ok_or_else(|| AppError::ConfigError("Could not determine data directory".to_string()))?;

    let app_dir = data_dir.join("dbfordevs");

    // Create directory if it doesn't exist
    fs::create_dir_all(&app_dir).map_err(|e| AppError::IoError(e))?;

    Ok(app_dir.join(SNAPSHOTS_FILE))
}

/// Load all saved snapshots from storage
pub fn load_snapshots() -> AppResult<Vec<SchemaSnapshot>> {
    let path = get_snapshots_path()?;

    if !path.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(&path).map_err(|e| AppError::IoError(e))?;

    let snapshots: Vec<SchemaSnapshot> =
        serde_json::from_str(&content).map_err(|e| AppError::SerdeError(e))?;

    Ok(snapshots)
}

/// Save a snapshot to storage
pub fn save_snapshot(snapshot: &SchemaSnapshot) -> AppResult<()> {
    let mut snapshots = load_snapshots().unwrap_or_default();

    // Update existing or add new
    if let Some(existing) = snapshots.iter_mut().find(|s| s.id == snapshot.id) {
        *existing = snapshot.clone();
    } else {
        snapshots.push(snapshot.clone());
    }

    save_all_snapshots(&snapshots)
}

/// Delete a snapshot from storage
pub fn delete_snapshot(snapshot_id: &str) -> AppResult<()> {
    let mut snapshots = load_snapshots().unwrap_or_default();

    snapshots.retain(|s| s.id != snapshot_id);

    save_all_snapshots(&snapshots)
}

/// Save all snapshots to storage
fn save_all_snapshots(snapshots: &[SchemaSnapshot]) -> AppResult<()> {
    let path = get_snapshots_path()?;

    let content = serde_json::to_string_pretty(snapshots).map_err(|e| AppError::SerdeError(e))?;

    fs::write(&path, content).map_err(|e| AppError::IoError(e))?;

    Ok(())
}

/// Get a specific snapshot by ID
pub fn get_snapshot(snapshot_id: &str) -> AppResult<Option<SchemaSnapshot>> {
    let snapshots = load_snapshots()?;

    Ok(snapshots.into_iter().find(|s| s.id == snapshot_id))
}
