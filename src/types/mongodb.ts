// MongoDB database info
export interface MongoDatabaseInfo {
  name: string;
  sizeBytes: number;
  collectionCount: number;
  isEmpty: boolean;
}

// MongoDB collection info
export interface MongoCollectionInfo {
  name: string;
  documentCount: number;
  sizeBytes: number;
  indexCount: number;
  capped: boolean;
}

// Result from document query
export interface MongoQueryResult {
  documents: string[]; // JSON strings
  totalCount: number;
  executionTimeMs: number;
  hasMore: boolean;
}

// MongoDB index info
export interface MongoIndexInfo {
  name: string;
  keys: string; // JSON representation of key fields
  unique: boolean;
  sparse: boolean;
  ttlSeconds?: number;
}

// Result from aggregation pipeline
export interface MongoAggregationResult {
  documents: string[]; // JSON strings
  executionTimeMs: number;
  stagesExecuted: number;
}

// MongoDB server information
export interface MongoServerInfo {
  version: string;
  host: string;
  uptimeSeconds: number;
  connectionsCurrent: number;
  connectionsAvailable: number;
  storageEngine: string;
  replicaSet?: string;
}

// Result from executing a MongoDB command
export interface MongoCommandResult {
  output: string;
  executionTimeMs: number;
  ok: boolean;
  error?: string;
}

// Result from update operation
export interface MongoUpdateResult {
  matchedCount: number;
  modifiedCount: number;
  upsertedId?: string;
}

// Shell history entry for MongoDB CLI
export interface MongoShellHistoryEntry {
  id: string;
  command: string;
  output: string;
  executionTimeMs: number;
  error?: string;
  timestamp: number;
}

// Aggregation pipeline stage for builder
export interface MongoAggregationStage {
  id: string;
  stageType: string; // $match, $group, $project, $sort, $limit, $skip, $lookup, $unwind, etc.
  definition: string; // JSON definition
  enabled: boolean;
}

// Common aggregation stage types
export const MONGO_AGGREGATION_STAGES = [
  '$match',
  '$group',
  '$project',
  '$sort',
  '$limit',
  '$skip',
  '$lookup',
  '$unwind',
  '$addFields',
  '$replaceRoot',
  '$count',
  '$bucket',
  '$bucketAuto',
  '$facet',
  '$graphLookup',
  '$sample',
  '$out',
  '$merge',
] as const;

export type MongoAggregationStageType = typeof MONGO_AGGREGATION_STAGES[number];

// Query filter builder field
export interface MongoFilterField {
  id: string;
  field: string;
  operator: MongoFilterOperator;
  value: string;
}

// MongoDB filter operators
export type MongoFilterOperator =
  | '$eq'
  | '$ne'
  | '$gt'
  | '$gte'
  | '$lt'
  | '$lte'
  | '$in'
  | '$nin'
  | '$exists'
  | '$regex'
  | '$type';

// Parsed document for display
export interface MongoDocument {
  _id: string;
  data: Record<string, unknown>;
  raw: string; // Original JSON string
}

// Index creation options
export interface MongoCreateIndexOptions {
  name?: string;
  unique: boolean;
  sparse: boolean;
  ttlSeconds?: number;
}
