/**
 * Schema Search Types
 * Types for the global schema search feature
 */

/** Object types that can be searched */
export type SchemaObjectType =
  | "table"
  | "column"
  | "view"
  | "index"
  | "procedure"
  | "function"
  | "trigger"
  | "sequence"
  // Redis types
  | "redis-key"
  // MongoDB types
  | "mongo-database"
  | "mongo-collection"
  | "mongo-index"
  // Cassandra types
  | "cassandra-keyspace"
  | "cassandra-table"
  | "cassandra-column"
  | "cassandra-index";

/** Display labels for schema object types */
export const SCHEMA_OBJECT_TYPE_LABELS: Record<SchemaObjectType, string> = {
  table: "Tables",
  column: "Columns",
  view: "Views",
  index: "Indexes",
  procedure: "Procedures",
  function: "Functions",
  trigger: "Triggers",
  sequence: "Sequences",
  // Redis
  "redis-key": "Keys",
  // MongoDB
  "mongo-database": "Databases",
  "mongo-collection": "Collections",
  "mongo-index": "Indexes",
  // Cassandra
  "cassandra-keyspace": "Keyspaces",
  "cassandra-table": "Tables",
  "cassandra-column": "Columns",
  "cassandra-index": "Indexes",
};

/** A single search result from the schema search */
export interface SchemaSearchResult {
  /** Unique identifier for the result */
  id: string;
  /** Type of database object */
  objectType: SchemaObjectType;
  /** Name of the object */
  name: string;
  /** Full path including schema (e.g., "public.users") */
  fullPath: string;
  /** Parent object name (e.g., table name for columns) */
  parentName?: string;
  /** Database schema name */
  schema?: string;
  /** Connection ID this result belongs to */
  connectionId: string;
  /** Fuzzy match score (0-1, higher is better) */
  matchScore: number;
  /** Indices where the query matched in the name [start, end] */
  matchIndices: [number, number][];
  /** Additional metadata about the object */
  metadata?: Record<string, unknown>;
}

/** An entry in the search history */
export interface SearchHistoryEntry {
  /** Unique identifier */
  id: string;
  /** The search query */
  query: string;
  /** Connection ID where search was performed */
  connectionId: string;
  /** Unix timestamp when search was performed */
  timestamp: number;
  /** Number of results found */
  resultCount: number;
}

/** Cached schema data for a connection */
export interface SchemaCacheEntry {
  /** Connection ID */
  connectionId: string;
  /** Unix timestamp when cache was last updated */
  lastUpdated: number;
  /** Cached searchable items */
  items: SchemaSearchResult[];
}
