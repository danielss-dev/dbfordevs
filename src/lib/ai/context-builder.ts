/**
 * AI Context Builder
 *
 * Utilities for building enhanced context with relationships, indexes, and sample data.
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  EnhancedTableInfo,
  TableRelationshipInfo,
  TableIndexInfo,
  AIContextConfig,
  ContextSizeInfo,
  ManualContextEntry,
} from "./types";
import type { TableProperties, TableRelationship } from "@/types";

/** Default context configuration */
export const DEFAULT_CONTEXT_CONFIG: AIContextConfig = {
  includeForeignKeys: true,
  includeIndexes: true,
  includeSampleData: false,
  sampleDataRows: 3,
  maxTablesInContext: 10,
};

/**
 * Fetch enhanced table information including relationships and indexes
 */
export async function fetchEnhancedTableInfo(
  connectionId: string,
  tableName: string,
  config: AIContextConfig
): Promise<EnhancedTableInfo | null> {
  try {
    // Fetch table properties (includes indexes and foreign keys)
    const properties = await invoke<TableProperties>("get_table_properties", {
      connectionId,
      tableName,
    });

    if (!properties) return null;

    // Convert to EnhancedTableInfo
    const enhanced: EnhancedTableInfo = {
      name: properties.tableName,
      schema: properties.schema,
      columns: properties.columns.map((col) => ({
        name: col.name,
        dataType: col.dataType,
        isNullable: col.nullable,
        isPrimaryKey: properties.primaryKeys.includes(col.name),
      })),
    };

    // Add relationships if enabled
    if (config.includeForeignKeys) {
      const relationships = await invoke<TableRelationship[]>(
        "get_table_relationships",
        { connectionId, tableName }
      );

      enhanced.relationships = relationships.map((rel) => ({
        type: rel.sourceTable === tableName ? "outgoing" : "incoming",
        foreignKeyColumn: rel.sourceColumn,
        referencedTable: rel.sourceTable === tableName ? rel.targetTable : rel.sourceTable,
        referencedColumn: rel.sourceTable === tableName ? rel.targetColumn : rel.sourceColumn,
        constraintName: rel.constraintName,
      } as TableRelationshipInfo));

      // Also add foreign keys from properties
      for (const fk of properties.foreignKeys) {
        const exists = enhanced.relationships?.some(
          (r) =>
            (r.foreignKeyColumn === fk.column &&
              r.referencedTable === fk.referencesTable)
        );
        if (!exists) {
          enhanced.relationships?.push({
            type: "outgoing",
            foreignKeyColumn: fk.column,
            referencedTable: fk.referencesTable,
            referencedColumn: fk.referencesColumn,
          });
        }
      }
    }

    // Add indexes if enabled
    if (config.includeIndexes) {
      enhanced.indexes = properties.indexes.map((idx) => ({
        name: idx.name,
        columns: idx.columns,
        isUnique: idx.isUnique,
        isPrimary: idx.isPrimary,
      } as TableIndexInfo));
    }

    // Add sample data if enabled
    if (config.includeSampleData && config.sampleDataRows > 0) {
      try {
        const result = await invoke<{
          columns: string[];
          rows: unknown[][];
        }>("execute_query", {
          request: {
            connectionId,
            sql: `SELECT * FROM ${tableName} LIMIT ${config.sampleDataRows}`,
            limit: config.sampleDataRows,
            offset: 0,
          },
        });

        if (result && result.rows && result.rows.length > 0) {
          enhanced.sampleData = result.rows.map((row) => {
            const record: Record<string, unknown> = {};
            result.columns.forEach((col, idx) => {
              record[col] = row[idx];
            });
            return record;
          });
        }
      } catch (e) {
        console.warn(`[Context Builder] Failed to fetch sample data for ${tableName}:`, e);
      }
    }

    return enhanced;
  } catch (error) {
    console.error(`[Context Builder] Failed to fetch enhanced info for ${tableName}:`, error);
    return null;
  }
}

/**
 * Build enhanced context for multiple tables
 */
export async function buildEnhancedContext(
  connectionId: string,
  tableNames: string[],
  config: AIContextConfig
): Promise<EnhancedTableInfo[]> {
  // Limit the number of tables to fetch
  const limitedTables = tableNames.slice(0, config.maxTablesInContext);

  const results = await Promise.all(
    limitedTables.map((name) => fetchEnhancedTableInfo(connectionId, name, config))
  );

  return results.filter((t): t is EnhancedTableInfo => t !== null);
}

/**
 * Estimate token count from text (rough approximation: ~4 chars per token)
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Calculate context size information
 */
export function calculateContextSize(
  tables: EnhancedTableInfo[],
  manualEntries: ManualContextEntry[]
): ContextSizeInfo {
  let estimatedTokens = 0;
  let relationshipCount = 0;
  let indexCount = 0;
  let sampleRowCount = 0;

  // Calculate from tables
  for (const table of tables) {
    // Table name and columns
    estimatedTokens += estimateTokenCount(table.name);
    for (const col of table.columns || []) {
      estimatedTokens += estimateTokenCount(`${col.name}: ${col.dataType}`);
    }

    // Relationships
    if (table.relationships) {
      relationshipCount += table.relationships.length;
      for (const rel of table.relationships) {
        estimatedTokens += estimateTokenCount(
          `FK: ${rel.foreignKeyColumn} -> ${rel.referencedTable}.${rel.referencedColumn}`
        );
      }
    }

    // Indexes
    if (table.indexes) {
      indexCount += table.indexes.length;
      for (const idx of table.indexes) {
        estimatedTokens += estimateTokenCount(
          `INDEX: ${idx.name} (${idx.columns.join(", ")})`
        );
      }
    }

    // Sample data
    if (table.sampleData) {
      sampleRowCount += table.sampleData.length;
      for (const row of table.sampleData) {
        estimatedTokens += estimateTokenCount(JSON.stringify(row));
      }
    }
  }

  // Calculate from manual entries
  for (const entry of manualEntries) {
    if (entry.customText) {
      estimatedTokens += estimateTokenCount(entry.customText);
    }
  }

  return {
    estimatedTokens,
    tableCount: tables.length,
    relationshipCount,
    indexCount,
    sampleRowCount,
  };
}

/**
 * Format enhanced context for inclusion in the system prompt
 */
export function formatContextForPrompt(
  tables: EnhancedTableInfo[],
  manualEntries: ManualContextEntry[],
  config: AIContextConfig
): string {
  const sections: string[] = [];

  // Tables section
  if (tables.length > 0) {
    sections.push("ENHANCED TABLE CONTEXT:");
    sections.push("=".repeat(50));

    for (const table of tables) {
      const tableName = table.schema ? `${table.schema}.${table.name}` : table.name;
      sections.push(`\nTable: ${tableName}`);

      // Columns
      if (table.columns && table.columns.length > 0) {
        sections.push("Columns:");
        for (const col of table.columns) {
          const pk = col.isPrimaryKey ? " (PRIMARY KEY)" : "";
          const nullable = col.isNullable ? " NULL" : " NOT NULL";
          sections.push(`  - ${col.name}: ${col.dataType}${nullable}${pk}`);
        }
      }

      // Relationships (Foreign Keys)
      if (config.includeForeignKeys && table.relationships && table.relationships.length > 0) {
        sections.push("Relationships:");
        for (const rel of table.relationships) {
          const direction = rel.type === "outgoing" ? "->" : "<-";
          sections.push(
            `  - ${rel.foreignKeyColumn} ${direction} ${rel.referencedTable}.${rel.referencedColumn}` +
              (rel.constraintName ? ` (${rel.constraintName})` : "")
          );
        }
      }

      // Indexes
      if (config.includeIndexes && table.indexes && table.indexes.length > 0) {
        sections.push("Indexes:");
        for (const idx of table.indexes) {
          const type = idx.isPrimary ? "PRIMARY" : idx.isUnique ? "UNIQUE" : "INDEX";
          sections.push(`  - ${idx.name}: ${type} (${idx.columns.join(", ")})`);
        }
      }

      // Sample data
      if (config.includeSampleData && table.sampleData && table.sampleData.length > 0) {
        sections.push("Sample Data:");
        for (const row of table.sampleData) {
          const values = Object.entries(row)
            .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
            .join(", ");
          sections.push(`  { ${values} }`);
        }
      }
    }

    sections.push("=".repeat(50));
  }

  // Manual context entries
  const customEntries = manualEntries.filter((e) => e.type === "custom" && e.customText);
  if (customEntries.length > 0) {
    sections.push("\nADDITIONAL CONTEXT:");
    for (const entry of customEntries) {
      sections.push(entry.customText!);
    }
  }

  return sections.join("\n");
}

/**
 * Get token count color indicator based on estimated tokens
 */
export function getTokenCountColor(tokens: number): "green" | "yellow" | "red" {
  if (tokens < 2000) return "green";
  if (tokens < 4000) return "yellow";
  return "red";
}
