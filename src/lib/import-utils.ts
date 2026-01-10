import type { ColumnMapping, ImportFormat } from "@/types/import";
import type { ColumnInfo } from "@/types";

/**
 * Detect file format from file extension
 */
export function detectFormat(filename: string): ImportFormat | null {
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "csv":
    case "tsv":
      return "csv";
    case "json":
      return "json";
    case "sql":
      return "sql";
    default:
      return null;
  }
}

/**
 * Auto-map source columns to target columns by name similarity
 */
export function autoMapColumns(
  sourceColumns: string[],
  targetColumns: ColumnInfo[]
): ColumnMapping[] {
  return sourceColumns.map((source) => {
    // Exact match first (case insensitive)
    const exactMatch = targetColumns.find(
      (t) => t.name.toLowerCase() === source.toLowerCase()
    );
    if (exactMatch) {
      return {
        sourceColumn: source,
        targetColumn: exactMatch.name,
        dataType: exactMatch.dataType,
      };
    }

    // Fuzzy match (remove underscores, spaces, hyphens)
    const normalizedSource = source.toLowerCase().replace(/[_\s-]/g, "");
    const fuzzyMatch = targetColumns.find(
      (t) => t.name.toLowerCase().replace(/[_\s-]/g, "") === normalizedSource
    );
    if (fuzzyMatch) {
      return {
        sourceColumn: source,
        targetColumn: fuzzyMatch.name,
        dataType: fuzzyMatch.dataType,
      };
    }

    // No match - leave unmapped
    return {
      sourceColumn: source,
      targetColumn: "",
      dataType: undefined,
    };
  });
}

/**
 * Validate column mappings - check required columns are mapped
 */
export function validateMappings(
  mappings: ColumnMapping[],
  targetColumns: ColumnInfo[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const mappedTargets = new Set<string>();

  // Check for duplicate mappings
  for (const mapping of mappings) {
    if (mapping.targetColumn) {
      if (mappedTargets.has(mapping.targetColumn)) {
        errors.push(`Column "${mapping.targetColumn}" is mapped multiple times`);
      }
      mappedTargets.add(mapping.targetColumn);
    }
  }

  // Check required columns (non-nullable without default - we assume PK is auto-generated)
  const requiredColumns = targetColumns.filter(
    (c) => !c.nullable && !c.isPrimaryKey
  );

  for (const required of requiredColumns) {
    if (!mappedTargets.has(required.name)) {
      errors.push(`Required column "${required.name}" is not mapped`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get a display name for import format
 */
export function getFormatDisplayName(format: ImportFormat): string {
  switch (format) {
    case "csv":
      return "CSV";
    case "json":
      return "JSON";
    case "sql":
      return "SQL";
    default:
      return format;
  }
}

/**
 * Get file filter extensions for a format
 */
export function getFormatExtensions(format: ImportFormat): string[] {
  switch (format) {
    case "csv":
      return ["csv", "tsv"];
    case "json":
      return ["json"];
    case "sql":
      return ["sql"];
    default:
      return [];
  }
}

/**
 * Check if a column type is numeric
 */
export function isNumericType(dataType: string): boolean {
  const numericTypes = [
    "int",
    "integer",
    "bigint",
    "smallint",
    "tinyint",
    "decimal",
    "numeric",
    "float",
    "double",
    "real",
    "money",
    "number",
  ];
  const lowerType = dataType.toLowerCase();
  return numericTypes.some((t) => lowerType.includes(t));
}

/**
 * Check if a column type is boolean
 */
export function isBooleanType(dataType: string): boolean {
  const boolTypes = ["bool", "boolean", "bit"];
  const lowerType = dataType.toLowerCase();
  return boolTypes.some((t) => lowerType.includes(t));
}

/**
 * Check if a column type is text/string
 */
export function isTextType(dataType: string): boolean {
  const textTypes = [
    "text",
    "varchar",
    "char",
    "string",
    "nvarchar",
    "nchar",
    "clob",
  ];
  const lowerType = dataType.toLowerCase();
  return textTypes.some((t) => lowerType.includes(t));
}
