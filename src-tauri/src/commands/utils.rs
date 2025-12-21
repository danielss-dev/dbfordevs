use crate::error::AppResult;
use arboard::Clipboard;

/// Copy text to the system clipboard
#[tauri::command]
pub async fn copy_to_clipboard(text: String) -> AppResult<()> {
    let mut clipboard = Clipboard::new().map_err(|e| crate::error::AppError::GenericError(e.to_string()))?;
    clipboard.set_text(text).map_err(|e| crate::error::AppError::GenericError(e.to_string()))?;
    Ok(())
}

/// Read text from the system clipboard
#[tauri::command]
pub async fn read_from_clipboard() -> AppResult<String> {
    let mut clipboard = Clipboard::new().map_err(|e| crate::error::AppError::GenericError(e.to_string()))?;
    let text = clipboard.get_text().map_err(|e| crate::error::AppError::GenericError(e.to_string()))?;
    Ok(text)
}

