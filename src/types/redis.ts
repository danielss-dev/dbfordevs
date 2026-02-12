// Redis key types
export type RedisKeyType = 'string' | 'list' | 'set' | 'zset' | 'hash' | 'stream' | 'unknown';

// Information about a Redis key
export interface RedisKeyInfo {
  key: string;
  keyType: RedisKeyType;
  ttl: number; // -1 = no expiry, -2 = key doesn't exist
  size?: number; // Memory size in bytes (if available)
}

// Result from SCAN operation
export interface RedisScanResult {
  cursor: number;
  keys: RedisKeyInfo[];
  hasMore: boolean;
}

// Scan result for set/hash members
export interface RedisScanMembersResult {
  cursor: number;
  members: string[];
  hasMore: boolean;
}

// Scan result for hash fields
export interface RedisScanHashResult {
  cursor: number;
  fields: RedisHashField[];
  hasMore: boolean;
}

// String value with encoding info
export interface RedisStringValue {
  value: string;
  encoding?: string;
}

// List value with pagination info
export interface RedisListValue {
  values: string[];
  totalLength: number;
}

// Set value with cardinality
export interface RedisSetValue {
  members: string[];
  cardinality: number;
}

// Hash field
export interface RedisHashField {
  field: string;
  value: string;
}

// Hash value with total field count
export interface RedisHashValue {
  fields: RedisHashField[];
  totalFields: number;
}

// Sorted set member with score
export interface RedisZSetMember {
  member: string;
  score: number;
}

// Sorted set value with cardinality
export interface RedisZSetValue {
  members: RedisZSetMember[];
  cardinality: number;
}

// Stream entry
export interface RedisStreamEntry {
  id: string;
  fields: Record<string, string>;
}

// Stream value with metadata
export interface RedisStreamValue {
  entries: RedisStreamEntry[];
  length: number;
  firstEntryId?: string;
  lastEntryId?: string;
}

// Redis server information
export interface RedisServerInfo {
  version: string;
  mode: string; // standalone, cluster, sentinel
  os: string;
  uptimeSeconds: number;
  connectedClients: number;
  usedMemory: number;
  usedMemoryHuman: string;
  usedMemoryPeak: number;
  usedMemoryPeakHuman: string;
  totalSystemMemory?: number;
  totalConnectionsReceived: number;
  totalCommandsProcessed: number;
  keyspace: Record<string, RedisKeyspaceInfo>;
  role: string; // master, slave
}

// Keyspace info per database
export interface RedisKeyspaceInfo {
  keys: number;
  expires: number;
  avgTtl?: number;
}

// Memory statistics
export interface RedisMemoryStats {
  usedMemory: number;
  usedMemoryHuman: string;
  usedMemoryRss: number;
  usedMemoryPeak: number;
  usedMemoryPeakHuman: string;
  usedMemoryLua: number;
  maxmemory: number;
  maxmemoryPolicy: string;
  memFragmentationRatio: number;
  memAllocator: string;
}

// Result from executing a Redis command
export interface RedisCommandResult {
  output: string;
  executionTimeMs: number;
  error?: string;
}

// Pub/Sub message
export interface RedisPubSubMessage {
  channel: string;
  message: string;
  timestamp: number;
}

// Pub/Sub subscription
export interface RedisPubSubSubscription {
  id: string;
  channels: string[];
  isActive: boolean;
}

// CLI history entry
export interface RedisCliHistoryEntry {
  id: string;
  command: string;
  output: string;
  executionTimeMs: number;
  error?: string;
  timestamp: number;
}

// Redis staged change operations (discriminated union)
export type RedisOperation =
  | { op: "SET"; value: string; originalValue: string }
  | { op: "HSET"; field: string; value: string; isNew: boolean }
  | { op: "HDEL"; field: string; originalValue: string }
  | { op: "SADD"; member: string }
  | { op: "SREM"; member: string }
  | { op: "ZADD"; member: string; score: number; isNew: boolean }
  | { op: "ZREM"; member: string }
  | { op: "LSET"; index: number; value: string; originalValue: string }
  | { op: "RPUSH"; value: string }
  | { op: "LPUSH"; value: string }
  | { op: "LREM"; value: string };

// A single pending Redis change
export interface RedisPendingChange {
  id: string;
  connectionId: string;
  key: string;
  keyType: RedisKeyType;
  operation: RedisOperation;
  timestamp: number;
}
