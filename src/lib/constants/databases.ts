import type { DatabaseType } from "@/types";

export interface DatabaseDefaults {
  port: number;
  username: string;
  host: string;
}

export interface DatabaseMetadata {
  name: string;
  icon: string;
  brand: string;
  color: string;
}

export interface DatabaseConfig extends DatabaseDefaults, DatabaseMetadata {}

/**
 * Database-specific default connection values
 */
export const DATABASE_DEFAULTS: Record<DatabaseType, DatabaseDefaults> = {
  postgresql: { port: 5432, username: "postgres", host: "localhost" },
  mysql: { port: 3306, username: "root", host: "localhost" },
  mariadb: { port: 3306, username: "root", host: "localhost" },
  sqlite: { port: 0, username: "", host: "" },
  mssql: { port: 1433, username: "sa", host: "localhost" },
  oracle: { port: 1521, username: "system", host: "localhost" },
  mongodb: { port: 27017, username: "", host: "localhost" },
  redis: { port: 6379, username: "", host: "localhost" },
  cockroachdb: { port: 26257, username: "root", host: "localhost" },
  cassandra: { port: 9042, username: "cassandra", host: "localhost" },
};

/**
 * Database display metadata (name, icon, brand, color)
 */
export const DATABASE_METADATA: Record<DatabaseType, DatabaseMetadata> = {
  postgresql: { name: "PostgreSQL", icon: "🐘", brand: "postgresql", color: "text-[#4169E1]" },
  mysql: { name: "MySQL", icon: "🐬", brand: "mysql", color: "text-[#4479A1]" },
  mariadb: { name: "MariaDB", icon: "🐬", brand: "mariadb", color: "text-[#003545]" },
  sqlite: { name: "SQLite", icon: "📁", brand: "sqlite", color: "text-[#003B57]" },
  mssql: { name: "SQL Server", icon: "🗄️", brand: "microsoftsqlserver", color: "text-[#CC2927]" },
  oracle: { name: "Oracle", icon: "🔴", brand: "oracle", color: "text-[#F80000]" },
  mongodb: { name: "MongoDB", icon: "🍃", brand: "mongodb", color: "text-[#47A248]" },
  redis: { name: "Redis", icon: "🔴", brand: "redis", color: "text-[#FF4438]" },
  cockroachdb: { name: "CockroachDB", icon: "🪳", brand: "cockroachdb", color: "text-[#6933FF]" },
  cassandra: { name: "Cassandra", icon: "🔵", brand: "apachecassandra", color: "text-[#1287B1]" },
};

/**
 * Combined database configuration (defaults + metadata)
 */
export const DATABASE_CONFIG: Record<DatabaseType, DatabaseConfig> = Object.keys(DATABASE_DEFAULTS).reduce(
  (acc, key) => {
    const dbType = key as DatabaseType;
    acc[dbType] = {
      ...DATABASE_DEFAULTS[dbType],
      ...DATABASE_METADATA[dbType],
    };
    return acc;
  },
  {} as Record<DatabaseType, DatabaseConfig>
);

/**
 * Get default connection values for a database type
 */
export function getDatabaseDefaults(type: DatabaseType): DatabaseDefaults {
  return DATABASE_DEFAULTS[type];
}

/**
 * Get display metadata for a database type
 */
export function getDatabaseMetadata(type: DatabaseType): DatabaseMetadata {
  return DATABASE_METADATA[type];
}

/**
 * Get complete configuration for a database type
 */
export function getDatabaseConfig(type: DatabaseType): DatabaseConfig {
  return DATABASE_CONFIG[type];
}

/**
 * Get the color class for a database type
 */
export function getDatabaseColor(type: DatabaseType): string {
  return DATABASE_METADATA[type].color;
}

/**
 * Get the brand name for a database type (used for brand icons)
 */
export function getDatabaseBrand(type: DatabaseType): string {
  return DATABASE_METADATA[type].brand;
}

/**
 * Get the display name for a database type
 */
export function getDatabaseName(type: DatabaseType): string {
  return DATABASE_METADATA[type].name;
}
