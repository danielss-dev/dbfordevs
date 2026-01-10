import type { DatabaseType } from "@/types";

export interface DataTypeInfo {
  name: string;
  category: string;
  requiresLength: boolean;
  requiresPrecision: boolean;
  defaultLength?: number;
  defaultPrecision?: number;
  defaultScale?: number;
  supportsAutoIncrement?: boolean;
}

export interface DataTypeCategory {
  name: string;
  types: DataTypeInfo[];
}

// PostgreSQL data types
const POSTGRESQL_TYPES: DataTypeCategory[] = [
  {
    name: "Numeric",
    types: [
      { name: "SMALLINT", category: "numeric", requiresLength: false, requiresPrecision: false },
      { name: "INTEGER", category: "numeric", requiresLength: false, requiresPrecision: false },
      { name: "BIGINT", category: "numeric", requiresLength: false, requiresPrecision: false },
      { name: "DECIMAL", category: "numeric", requiresLength: false, requiresPrecision: true, defaultPrecision: 10, defaultScale: 2 },
      { name: "NUMERIC", category: "numeric", requiresLength: false, requiresPrecision: true, defaultPrecision: 10, defaultScale: 2 },
      { name: "REAL", category: "numeric", requiresLength: false, requiresPrecision: false },
      { name: "DOUBLE PRECISION", category: "numeric", requiresLength: false, requiresPrecision: false },
      { name: "SMALLSERIAL", category: "numeric", requiresLength: false, requiresPrecision: false, supportsAutoIncrement: true },
      { name: "SERIAL", category: "numeric", requiresLength: false, requiresPrecision: false, supportsAutoIncrement: true },
      { name: "BIGSERIAL", category: "numeric", requiresLength: false, requiresPrecision: false, supportsAutoIncrement: true },
    ],
  },
  {
    name: "Character",
    types: [
      { name: "CHAR", category: "character", requiresLength: true, requiresPrecision: false, defaultLength: 1 },
      { name: "VARCHAR", category: "character", requiresLength: true, requiresPrecision: false, defaultLength: 255 },
      { name: "TEXT", category: "character", requiresLength: false, requiresPrecision: false },
    ],
  },
  {
    name: "Date/Time",
    types: [
      { name: "DATE", category: "datetime", requiresLength: false, requiresPrecision: false },
      { name: "TIME", category: "datetime", requiresLength: false, requiresPrecision: false },
      { name: "TIMESTAMP", category: "datetime", requiresLength: false, requiresPrecision: false },
      { name: "TIMESTAMPTZ", category: "datetime", requiresLength: false, requiresPrecision: false },
      { name: "INTERVAL", category: "datetime", requiresLength: false, requiresPrecision: false },
    ],
  },
  {
    name: "Boolean",
    types: [
      { name: "BOOLEAN", category: "boolean", requiresLength: false, requiresPrecision: false },
    ],
  },
  {
    name: "Binary",
    types: [
      { name: "BYTEA", category: "binary", requiresLength: false, requiresPrecision: false },
    ],
  },
  {
    name: "JSON",
    types: [
      { name: "JSON", category: "json", requiresLength: false, requiresPrecision: false },
      { name: "JSONB", category: "json", requiresLength: false, requiresPrecision: false },
    ],
  },
  {
    name: "UUID",
    types: [
      { name: "UUID", category: "uuid", requiresLength: false, requiresPrecision: false },
    ],
  },
  {
    name: "Network",
    types: [
      { name: "INET", category: "network", requiresLength: false, requiresPrecision: false },
      { name: "CIDR", category: "network", requiresLength: false, requiresPrecision: false },
      { name: "MACADDR", category: "network", requiresLength: false, requiresPrecision: false },
    ],
  },
];

// MySQL data types
const MYSQL_TYPES: DataTypeCategory[] = [
  {
    name: "Numeric",
    types: [
      { name: "TINYINT", category: "numeric", requiresLength: false, requiresPrecision: false },
      { name: "SMALLINT", category: "numeric", requiresLength: false, requiresPrecision: false },
      { name: "MEDIUMINT", category: "numeric", requiresLength: false, requiresPrecision: false },
      { name: "INT", category: "numeric", requiresLength: false, requiresPrecision: false, supportsAutoIncrement: true },
      { name: "BIGINT", category: "numeric", requiresLength: false, requiresPrecision: false, supportsAutoIncrement: true },
      { name: "DECIMAL", category: "numeric", requiresLength: false, requiresPrecision: true, defaultPrecision: 10, defaultScale: 2 },
      { name: "FLOAT", category: "numeric", requiresLength: false, requiresPrecision: false },
      { name: "DOUBLE", category: "numeric", requiresLength: false, requiresPrecision: false },
    ],
  },
  {
    name: "Character",
    types: [
      { name: "CHAR", category: "character", requiresLength: true, requiresPrecision: false, defaultLength: 1 },
      { name: "VARCHAR", category: "character", requiresLength: true, requiresPrecision: false, defaultLength: 255 },
      { name: "TINYTEXT", category: "character", requiresLength: false, requiresPrecision: false },
      { name: "TEXT", category: "character", requiresLength: false, requiresPrecision: false },
      { name: "MEDIUMTEXT", category: "character", requiresLength: false, requiresPrecision: false },
      { name: "LONGTEXT", category: "character", requiresLength: false, requiresPrecision: false },
    ],
  },
  {
    name: "Date/Time",
    types: [
      { name: "DATE", category: "datetime", requiresLength: false, requiresPrecision: false },
      { name: "TIME", category: "datetime", requiresLength: false, requiresPrecision: false },
      { name: "DATETIME", category: "datetime", requiresLength: false, requiresPrecision: false },
      { name: "TIMESTAMP", category: "datetime", requiresLength: false, requiresPrecision: false },
      { name: "YEAR", category: "datetime", requiresLength: false, requiresPrecision: false },
    ],
  },
  {
    name: "Boolean",
    types: [
      { name: "BOOLEAN", category: "boolean", requiresLength: false, requiresPrecision: false },
    ],
  },
  {
    name: "Binary",
    types: [
      { name: "BINARY", category: "binary", requiresLength: true, requiresPrecision: false, defaultLength: 1 },
      { name: "VARBINARY", category: "binary", requiresLength: true, requiresPrecision: false, defaultLength: 255 },
      { name: "TINYBLOB", category: "binary", requiresLength: false, requiresPrecision: false },
      { name: "BLOB", category: "binary", requiresLength: false, requiresPrecision: false },
      { name: "MEDIUMBLOB", category: "binary", requiresLength: false, requiresPrecision: false },
      { name: "LONGBLOB", category: "binary", requiresLength: false, requiresPrecision: false },
    ],
  },
  {
    name: "JSON",
    types: [
      { name: "JSON", category: "json", requiresLength: false, requiresPrecision: false },
    ],
  },
];

// SQLite data types (simplified - SQLite uses type affinity)
const SQLITE_TYPES: DataTypeCategory[] = [
  {
    name: "Numeric",
    types: [
      { name: "INTEGER", category: "numeric", requiresLength: false, requiresPrecision: false, supportsAutoIncrement: true },
      { name: "REAL", category: "numeric", requiresLength: false, requiresPrecision: false },
      { name: "NUMERIC", category: "numeric", requiresLength: false, requiresPrecision: false },
    ],
  },
  {
    name: "Text",
    types: [
      { name: "TEXT", category: "character", requiresLength: false, requiresPrecision: false },
    ],
  },
  {
    name: "Binary",
    types: [
      { name: "BLOB", category: "binary", requiresLength: false, requiresPrecision: false },
    ],
  },
];

// MSSQL data types
const MSSQL_TYPES: DataTypeCategory[] = [
  {
    name: "Numeric",
    types: [
      { name: "TINYINT", category: "numeric", requiresLength: false, requiresPrecision: false },
      { name: "SMALLINT", category: "numeric", requiresLength: false, requiresPrecision: false },
      { name: "INT", category: "numeric", requiresLength: false, requiresPrecision: false, supportsAutoIncrement: true },
      { name: "BIGINT", category: "numeric", requiresLength: false, requiresPrecision: false, supportsAutoIncrement: true },
      { name: "DECIMAL", category: "numeric", requiresLength: false, requiresPrecision: true, defaultPrecision: 18, defaultScale: 2 },
      { name: "NUMERIC", category: "numeric", requiresLength: false, requiresPrecision: true, defaultPrecision: 18, defaultScale: 2 },
      { name: "FLOAT", category: "numeric", requiresLength: false, requiresPrecision: false },
      { name: "REAL", category: "numeric", requiresLength: false, requiresPrecision: false },
      { name: "MONEY", category: "numeric", requiresLength: false, requiresPrecision: false },
      { name: "SMALLMONEY", category: "numeric", requiresLength: false, requiresPrecision: false },
    ],
  },
  {
    name: "Character",
    types: [
      { name: "CHAR", category: "character", requiresLength: true, requiresPrecision: false, defaultLength: 1 },
      { name: "VARCHAR", category: "character", requiresLength: true, requiresPrecision: false, defaultLength: 255 },
      { name: "NCHAR", category: "character", requiresLength: true, requiresPrecision: false, defaultLength: 1 },
      { name: "NVARCHAR", category: "character", requiresLength: true, requiresPrecision: false, defaultLength: 255 },
      { name: "TEXT", category: "character", requiresLength: false, requiresPrecision: false },
      { name: "NTEXT", category: "character", requiresLength: false, requiresPrecision: false },
    ],
  },
  {
    name: "Date/Time",
    types: [
      { name: "DATE", category: "datetime", requiresLength: false, requiresPrecision: false },
      { name: "TIME", category: "datetime", requiresLength: false, requiresPrecision: false },
      { name: "DATETIME", category: "datetime", requiresLength: false, requiresPrecision: false },
      { name: "DATETIME2", category: "datetime", requiresLength: false, requiresPrecision: false },
      { name: "SMALLDATETIME", category: "datetime", requiresLength: false, requiresPrecision: false },
      { name: "DATETIMEOFFSET", category: "datetime", requiresLength: false, requiresPrecision: false },
    ],
  },
  {
    name: "Boolean",
    types: [
      { name: "BIT", category: "boolean", requiresLength: false, requiresPrecision: false },
    ],
  },
  {
    name: "Binary",
    types: [
      { name: "BINARY", category: "binary", requiresLength: true, requiresPrecision: false, defaultLength: 1 },
      { name: "VARBINARY", category: "binary", requiresLength: true, requiresPrecision: false, defaultLength: 255 },
      { name: "IMAGE", category: "binary", requiresLength: false, requiresPrecision: false },
    ],
  },
  {
    name: "Unique Identifier",
    types: [
      { name: "UNIQUEIDENTIFIER", category: "uniqueidentifier", requiresLength: false, requiresPrecision: false },
    ],
  },
];

/**
 * Get data types for a specific database type
 */
export function getDataTypesForDatabase(databaseType: DatabaseType): DataTypeCategory[] {
  switch (databaseType) {
    case "postgresql":
    case "cockroachdb":
      return POSTGRESQL_TYPES;
    case "mysql":
    case "mariadb":
      return MYSQL_TYPES;
    case "sqlite":
      return SQLITE_TYPES;
    case "mssql":
      return MSSQL_TYPES;
    default:
      return POSTGRESQL_TYPES; // Default to PostgreSQL
  }
}

/**
 * Get all data types flattened for a database type
 */
export function getAllDataTypes(databaseType: DatabaseType): DataTypeInfo[] {
  const categories = getDataTypesForDatabase(databaseType);
  return categories.flatMap((category) => category.types);
}

/**
 * Find data type info by name
 */
export function findDataType(databaseType: DatabaseType, typeName: string): DataTypeInfo | undefined {
  const allTypes = getAllDataTypes(databaseType);
  return allTypes.find((t) => t.name.toLowerCase() === typeName.toLowerCase());
}

/**
 * Check if a type supports auto-increment for a database
 */
export function supportsAutoIncrement(databaseType: DatabaseType, typeName: string): boolean {
  const typeInfo = findDataType(databaseType, typeName);
  return typeInfo?.supportsAutoIncrement ?? false;
}

/**
 * Get the auto-increment type for a database (for primary keys)
 */
export function getAutoIncrementType(databaseType: DatabaseType): string {
  switch (databaseType) {
    case "postgresql":
    case "cockroachdb":
      return "SERIAL";
    case "mysql":
    case "mariadb":
      return "INT"; // With AUTO_INCREMENT modifier
    case "sqlite":
      return "INTEGER"; // With PRIMARY KEY (auto-increment is implicit)
    case "mssql":
      return "INT"; // With IDENTITY(1,1)
    default:
      return "INTEGER";
  }
}

/**
 * Format a data type with length/precision for display
 */
export function formatDataType(
  typeName: string,
  length?: number,
  precision?: number,
  scale?: number
): string {
  if (precision !== undefined && scale !== undefined) {
    return `${typeName}(${precision},${scale})`;
  }
  if (precision !== undefined) {
    return `${typeName}(${precision})`;
  }
  if (length !== undefined) {
    return `${typeName}(${length})`;
  }
  return typeName;
}
