// Cassandra keyspace info
export interface CassandraKeyspaceInfo {
  name: string;
  replicationStrategy: string;
  replicationFactor: number;
  durableWrites: boolean;
  tableCount: number;
}

// Cassandra table info
export interface CassandraTableInfo {
  name: string;
  keyspace: string;
  partitionKeys: string[];
  clusteringKeys: CassandraClusteringKey[];
  columnCount: number;
}

// Clustering key with order direction
export interface CassandraClusteringKey {
  name: string;
  order: 'ASC' | 'DESC';
}

// Cassandra column info
export interface CassandraColumnInfo {
  name: string;
  dataType: string;
  kind: 'partition_key' | 'clustering' | 'regular' | 'static';
  position: number;
}

// Column definition from query result
export interface CassandraColumnDef {
  name: string;
  dataType: string;
}

// Result from CQL query execution
export interface CassandraQueryResult {
  rows: string[]; // JSON strings
  columns: CassandraColumnDef[];
  executionTimeMs: number;
  rowCount: number;
  hasMore: boolean;
  pagingState?: string;
}

// Cassandra index info
export interface CassandraIndexInfo {
  name: string;
  tableName: string;
  columnName: string;
  indexType: string;
  options: string; // JSON
}

// Cassandra server information
export interface CassandraServerInfo {
  clusterName: string;
  releaseVersion: string;
  datacenter: string;
  nodes: CassandraNodeInfo[];
}

// Cassandra node information
export interface CassandraNodeInfo {
  address: string;
  datacenter: string;
  rack: string;
  isUp: boolean;
}

// CQL consistency levels
export type CassandraConsistencyLevel =
  | 'ONE'
  | 'QUORUM'
  | 'ALL'
  | 'LOCAL_QUORUM'
  | 'LOCAL_ONE'
  | 'EACH_QUORUM'
  | 'ANY';

// Shell history entry for Cassandra CQL shell
export interface CassandraShellHistoryEntry {
  id: string;
  cql: string;
  output: string;
  executionTimeMs: number;
  error?: string;
  timestamp: number;
}

// Common CQL data types
export const CASSANDRA_DATA_TYPES = [
  'ascii',
  'bigint',
  'blob',
  'boolean',
  'counter',
  'date',
  'decimal',
  'double',
  'duration',
  'float',
  'frozen',
  'inet',
  'int',
  'list',
  'map',
  'set',
  'smallint',
  'text',
  'time',
  'timestamp',
  'timeuuid',
  'tinyint',
  'tuple',
  'uuid',
  'varchar',
  'varint',
] as const;

export type CassandraDataType = typeof CASSANDRA_DATA_TYPES[number];

// Replication strategies
export const CASSANDRA_REPLICATION_STRATEGIES = [
  'SimpleStrategy',
  'NetworkTopologyStrategy',
  'LocalStrategy',
] as const;

export type CassandraReplicationStrategy = typeof CASSANDRA_REPLICATION_STRATEGIES[number];

// Parsed row for display
export interface CassandraRow {
  data: Record<string, unknown>;
  raw: string; // Original JSON string
}

// Keyspace creation options
export interface CassandraCreateKeyspaceOptions {
  name: string;
  replicationStrategy: CassandraReplicationStrategy;
  replicationFactor: number;
  durableWrites: boolean;
}
