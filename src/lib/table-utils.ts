/**
 * Utility functions for handling table identifiers consistently across the codebase.
 *
 * The problem: Different parts of the app use different formats:
 * - Just table name: "posts"
 * - Schema.table: "public.posts"
 * - Database.schema.table: "mydb.public.posts"
 * - And sometimes table.name already includes the schema prefix
 *
 * This module provides consistent parsing and formatting.
 */

import type { TableInfo } from "@/types";

/**
 * Common interface for any schema object (table, view, index, procedure, function, etc.)
 */
export interface SchemaObject {
  name: string;
  schema?: string;
}

export interface TableIdentifier {
  database?: string;
  schema?: string;
  name: string;
}

/**
 * Parse a dot-separated table identifier string into its components.
 * Handles: "table", "schema.table", "database.schema.table"
 */
export function parseTableIdentifier(identifier: string): TableIdentifier {
  const parts = identifier.split(".");

  if (parts.length === 3) {
    return { database: parts[0], schema: parts[1], name: parts[2] };
  } else if (parts.length === 2) {
    return { schema: parts[0], name: parts[1] };
  }

  return { name: identifier };
}

/**
 * Format a TableIdentifier back to a string.
 * @param includeDatabase - Whether to include the database part (default: false)
 */
export function formatTableIdentifier(
  table: TableIdentifier,
  includeDatabase = false
): string {
  const parts: string[] = [];
  if (includeDatabase && table.database) parts.push(table.database);
  if (table.schema) parts.push(table.schema);
  parts.push(table.name);
  return parts.join(".");
}

/**
 * Get the base table name (without any schema/database prefix).
 */
export function getBaseName(identifier: string): string {
  const parts = identifier.split(".");
  return parts[parts.length - 1];
}

/**
 * Build a qualified table identifier from a TableInfo object.
 * With standardized bare names from the backend, this simply prepends the schema.
 */
export function buildTableIdentifier(table: SchemaObject): string {
  return table.schema ? `${table.schema}.${table.name}` : table.name;
}

/**
 * Get the full qualified name for any schema object (table, view, index, etc.).
 * Alias for buildTableIdentifier for backward compatibility.
 */
export function getSchemaObjectFullName(obj: SchemaObject): string {
  return buildTableIdentifier(obj);
}

/**
 * Get the display name for a table, handling the case where table.name
 * might already include the schema prefix.
 *
 * This prevents the "public.public.posts" bug.
 */
export function getTableDisplayName(table: TableInfo): string {
  return getSchemaObjectFullName(table);
}

/**
 * Get the full qualified name for a table for use as an identifier.
 * Same as getTableDisplayName but named for clarity of intent.
 */
export function getTableFullName(table: TableInfo): string {
  return getSchemaObjectFullName(table);
}

/**
 * Compare two table identifiers for equality.
 * Handles different formats by comparing base names and schemas.
 */
export function tableIdentifiersMatch(a: string, b: string): boolean {
  const parsedA = parseTableIdentifier(a);
  const parsedB = parseTableIdentifier(b);

  // Names must match
  if (parsedA.name !== parsedB.name) return false;

  // If both have schemas, they must match
  if (parsedA.schema && parsedB.schema && parsedA.schema !== parsedB.schema) {
    return false;
  }

  return true;
}
