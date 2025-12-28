import type { DatabaseType } from "@/types";

export interface DatabaseDefaults {
  port: number;
  username: string;
  host: string;
}

export interface DatabaseMetadata {
  name: string;
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
 * Database display metadata (name, brand, color)
 * Colors use CSS variables that automatically adjust based on theme (light/dark)
 */
export const DATABASE_METADATA: Record<DatabaseType, DatabaseMetadata> = {
  postgresql: { name: "PostgreSQL", brand: "postgresql", color: "text-[var(--db-postgresql)]" },
  mysql: { name: "MySQL", brand: "mysql", color: "text-[var(--db-mysql)]" },
  mariadb: { name: "MariaDB", brand: "mariadb", color: "text-[var(--db-mariadb)]" },
  sqlite: { name: "SQLite", brand: "sqlite", color: "text-[var(--db-sqlite)]" },
  mssql: { name: "SQL Server", brand: "microsoftsqlserver", color: "text-[var(--db-mssql)]" },
  oracle: { name: "Oracle", brand: "oracle", color: "text-[var(--db-oracle)]" },
  mongodb: { name: "MongoDB", brand: "mongodb", color: "text-[var(--db-mongodb)]" },
  redis: { name: "Redis", brand: "redis", color: "text-[var(--db-redis)]" },
  cockroachdb: { name: "CockroachDB", brand: "cockroachdb", color: "text-[var(--db-cockroachdb)]" },
  cassandra: { name: "Cassandra", brand: "apachecassandra", color: "text-[var(--db-cassandra)]" },
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
