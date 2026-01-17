import { DatabaseType } from "@/types";

export interface DatabaseFeatureSupport {
  procedures: boolean;
  functions: boolean;
  triggers: boolean;
  sequences: boolean;
}

/**
 * Returns which features are supported by a given database type.
 * This is used to conditionally show/hide UI elements in the sidebar.
 */
export function getDatabaseFeatureSupport(dbType: DatabaseType): DatabaseFeatureSupport {
  switch (dbType) {
    case "postgresql":
    case "cockroachdb": // CockroachDB is PostgreSQL-compatible
      return {
        procedures: true,
        functions: true,
        triggers: true,
        sequences: true,
      };

    case "mysql":
    case "mariadb": // MariaDB is MySQL-compatible
      return {
        procedures: true,
        functions: true,
        triggers: true,
        sequences: false, // MySQL uses AUTO_INCREMENT instead of sequences
      };

    case "sqlite":
      return {
        procedures: false, // SQLite doesn't support stored procedures
        functions: false, // SQLite doesn't support user-defined SQL functions
        triggers: true,
        sequences: false, // SQLite uses AUTOINCREMENT
      };

    case "oracle":
      return {
        procedures: true,
        functions: true,
        triggers: true,
        sequences: true,
      };

    case "mssql":
      return {
        procedures: true,
        functions: true,
        triggers: true,
        sequences: true,
      };

    default:
      // Default: assume limited support for unknown databases
      return {
        procedures: false,
        functions: false,
        triggers: false,
        sequences: false,
      };
  }
}
