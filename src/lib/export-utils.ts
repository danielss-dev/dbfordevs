import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { SelectedRow } from "@/stores/crud";

/**
 * Convert selected rows to SQL INSERT statements
 */
export function rowsToInsertSQL(rows: SelectedRow[], tableName: string): string {
  if (rows.length === 0) return "";

  const table = tableName || rows[0]?.tableName || "table";
  const columns = rows[0]?.columns || [];
  const columnNames = columns.map((col) => col.name);

  const insertStatements = rows.map((row) => {
    const values = columnNames.map((colName) => {
      const value = row.rowData[colName];
      return formatSQLValue(value);
    });

    return `INSERT INTO ${table} (${columnNames.join(", ")}) VALUES (${values.join(", ")});`;
  });

  return insertStatements.join("\n");
}

/**
 * Convert selected rows to JSON format
 */
export function rowsToJSON(rows: SelectedRow[]): string {
  const data = rows.map((row) => row.rowData);
  return JSON.stringify(data, null, 2);
}

/**
 * Convert selected rows to CSV format
 */
export function rowsToCSV(rows: SelectedRow[], includeHeaders: boolean = true): string {
  if (rows.length === 0) return "";

  const columns = rows[0]?.columns || [];
  const columnNames = columns.map((col) => col.name);

  const lines: string[] = [];

  if (includeHeaders) {
    lines.push(columnNames.map((name) => escapeCSV(name)).join(","));
  }

  rows.forEach((row) => {
    const values = columnNames.map((colName) => {
      const value = row.rowData[colName];
      return escapeCSV(formatValue(value));
    });
    lines.push(values.join(","));
  });

  return lines.join("\n");
}

/**
 * Save content to a file using Tauri save dialog
 * Returns true if file was saved successfully, false if cancelled or error
 */
export async function saveFile(
  content: string,
  defaultFilename: string,
  filters: { name: string; extensions: string[] }[]
): Promise<boolean> {
  try {
    const filePath = await save({
      defaultPath: defaultFilename,
      filters,
    });

    if (filePath) {
      await writeTextFile(filePath, content);
      return true;
    }

    return false; // User cancelled
  } catch (error) {
    console.error("Failed to save file:", error);
    return false;
  }
}

/**
 * Download content as a file (legacy browser fallback)
 * @deprecated Use saveFile instead for Tauri apps
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format a value for SQL
 */
export function formatSQLValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (typeof value === "string") {
    // Escape single quotes by doubling them
    const escaped = value.replace(/'/g, "''");
    return `'${escaped}'`;
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  if (typeof value === "number") {
    return String(value);
  }

  // For objects/arrays, convert to JSON string
  if (typeof value === "object") {
    const escaped = JSON.stringify(value).replace(/'/g, "''");
    return `'${escaped}'`;
  }

  return String(value);
}

/**
 * Format a value for display (CSV, etc.)
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Escape a value for CSV
 */
export function escapeCSV(value: string): string {
  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  return value;
}
