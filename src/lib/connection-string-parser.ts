import type { DatabaseType, ParsedConnection } from "@/types";

/**
 * Detects the database type from a connection string
 */
export function detectDatabaseType(connStr: string): DatabaseType | null {
  const trimmed = connStr.trim().toLowerCase();

  if (trimmed.startsWith("postgresql://") || trimmed.startsWith("postgres://")) {
    return "postgresql";
  }
  if (trimmed.startsWith("mysql://")) {
    return "mysql";
  }
  if (trimmed.startsWith("mariadb://")) {
    return "mariadb";
  }
  // MSSQL uses ADO.NET style: Server=...; or Data Source=...
  if (trimmed.includes("server=") || trimmed.includes("data source=")) {
    return "mssql";
  }
  // CockroachDB often uses postgresql:// but with specific hosts
  if (trimmed.includes("cockroachdb") || trimmed.includes("cockroachlabs.cloud")) {
    return "cockroachdb";
  }

  return null;
}

/**
 * Parses a PostgreSQL/CockroachDB connection URL
 * Format: postgresql://user:password@host:port/database?sslmode=require&...
 */
function parsePostgresUrl(connStr: string): ParsedConnection {
  const result: ParsedConnection = { options: {}, originalFormat: "url" };

  try {
    // Handle both postgresql:// and postgres:// prefixes
    const normalized = connStr.replace(/^postgres:\/\//, "postgresql://");
    const url = new URL(normalized);

    result.host = url.hostname || undefined;
    result.port = url.port ? parseInt(url.port, 10) : undefined;
    result.database = url.pathname.replace(/^\//, "") || undefined;
    result.username = url.username ? decodeURIComponent(url.username) : undefined;
    result.password = url.password ? decodeURIComponent(url.password) : undefined;

    // Parse query parameters
    url.searchParams.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey === "sslmode") {
        result.sslMode = value;
      } else {
        result.options[key] = value;
      }
    });

    // Detect if it's CockroachDB
    if (
      result.host?.includes("cockroachdb") ||
      result.host?.includes("cockroachlabs.cloud") ||
      url.searchParams.get("options")?.includes("--cluster=")
    ) {
      result.databaseType = "cockroachdb";
    } else {
      result.databaseType = "postgresql";
    }
  } catch {
    throw new Error("Invalid PostgreSQL connection URL format");
  }

  return result;
}

/**
 * Parses a MySQL/MariaDB connection URL
 * Format: mysql://user:password@host:port/database
 */
function parseMysqlUrl(connStr: string): ParsedConnection {
  const result: ParsedConnection = { options: {}, originalFormat: "url" };

  try {
    const url = new URL(connStr);

    result.host = url.hostname || undefined;
    result.port = url.port ? parseInt(url.port, 10) : undefined;
    result.database = url.pathname.replace(/^\//, "") || undefined;
    result.username = url.username ? decodeURIComponent(url.username) : undefined;
    result.password = url.password ? decodeURIComponent(url.password) : undefined;

    // Detect MariaDB vs MySQL (usually can't tell from URL alone)
    result.databaseType = connStr.toLowerCase().startsWith("mariadb://")
      ? "mariadb"
      : "mysql";

    // Parse query parameters
    url.searchParams.forEach((value, key) => {
      result.options[key] = value;
    });
  } catch {
    throw new Error("Invalid MySQL connection URL format");
  }

  return result;
}

/**
 * Parses an MSSQL ADO.NET style connection string
 * Format: Server=tcp:host,port;Database=db;User Id=user;Password=pass;
 */
function parseMssqlConnectionString(connStr: string): ParsedConnection {
  const result: ParsedConnection = {
    options: {},
    originalFormat: "ado.net",
    databaseType: "mssql"
  };

  // Split by semicolon, handling quoted values
  const parts = connStr.split(";").filter(p => p.trim());

  for (const part of parts) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;

    const key = part.substring(0, eqIndex).trim().toLowerCase();
    let value = part.substring(eqIndex + 1).trim();

    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    switch (key) {
      case "server":
      case "data source":
      case "address":
      case "addr": {
        // Parse Server=tcp:host,port or Server=host,port or Server=host
        let serverValue = value.replace(/^tcp:/i, "");
        const commaIndex = serverValue.lastIndexOf(",");
        if (commaIndex !== -1) {
          result.host = serverValue.substring(0, commaIndex);
          const portStr = serverValue.substring(commaIndex + 1);
          result.port = parseInt(portStr, 10);
        } else {
          result.host = serverValue;
        }
        break;
      }
      case "database":
      case "initial catalog":
        result.database = value;
        break;
      case "user id":
      case "uid":
      case "user":
        result.username = value;
        break;
      case "password":
      case "pwd":
        result.password = value;
        break;
      case "encrypt":
        if (value.toLowerCase() === "true" || value.toLowerCase() === "yes") {
          result.sslMode = "require";
        } else if (value.toLowerCase() === "false" || value.toLowerCase() === "no") {
          result.sslMode = "disable";
        }
        break;
      default:
        result.options[key] = value;
    }
  }

  return result;
}

/**
 * Main entry point for parsing connection strings
 * @param connStr The connection string to parse
 * @param dbType Optional database type hint (auto-detected if not provided)
 * @returns Parsed connection details
 */
export function parseConnectionString(
  connStr: string,
  dbType?: DatabaseType
): ParsedConnection {
  const trimmed = connStr.trim();

  if (!trimmed) {
    throw new Error("Connection string cannot be empty");
  }

  // Detect type if not provided
  const detectedType = dbType || detectDatabaseType(trimmed);

  if (!detectedType) {
    throw new Error(
      "Could not detect database type from connection string. " +
      "Supported formats: postgresql://, mysql://, mariadb://, or MSSQL ADO.NET style (Server=...)"
    );
  }

  switch (detectedType) {
    case "postgresql":
    case "cockroachdb":
      return parsePostgresUrl(trimmed);
    case "mysql":
    case "mariadb":
      return parseMysqlUrl(trimmed);
    case "mssql":
      return parseMssqlConnectionString(trimmed);
    default:
      throw new Error(
        `Connection string parsing is not supported for database type: ${detectedType}`
      );
  }
}

/**
 * Validates that a parsed connection has minimum required fields
 */
export function validateParsedConnection(parsed: ParsedConnection): string[] {
  const errors: string[] = [];

  if (!parsed.host) {
    errors.push("Host is required");
  }
  if (!parsed.database) {
    errors.push("Database name is required");
  }

  return errors;
}
