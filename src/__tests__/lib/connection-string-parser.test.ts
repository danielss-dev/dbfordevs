import { describe, it, expect } from "vitest";
import {
  detectDatabaseType,
  parseConnectionString,
  validateParsedConnection,
} from "@/lib/connection-string-parser";

describe("detectDatabaseType", () => {
  it("should detect PostgreSQL from postgresql:// prefix", () => {
    expect(detectDatabaseType("postgresql://localhost/mydb")).toBe("postgresql");
  });

  it("should detect PostgreSQL from postgres:// prefix", () => {
    expect(detectDatabaseType("postgres://localhost/mydb")).toBe("postgresql");
  });

  it("should detect MySQL from mysql:// prefix", () => {
    expect(detectDatabaseType("mysql://localhost/mydb")).toBe("mysql");
  });

  it("should detect MariaDB from mariadb:// prefix", () => {
    expect(detectDatabaseType("mariadb://localhost/mydb")).toBe("mariadb");
  });

  it("should detect MSSQL from Server= format", () => {
    expect(detectDatabaseType("Server=localhost;Database=mydb")).toBe("mssql");
  });

  it("should detect MSSQL from Data Source= format", () => {
    expect(detectDatabaseType("Data Source=localhost;Database=mydb")).toBe("mssql");
  });

  it("should return postgresql for CockroachDB URLs with postgresql:// prefix", () => {
    // Note: detectDatabaseType checks URL prefix first, so postgresql:// URLs
    // return "postgresql" even if they contain CockroachDB hostnames
    // This is a known limitation - parseConnectionString handles CockroachDB detection properly
    expect(
      detectDatabaseType("postgresql://user@cockroachlabs.cloud/mydb")
    ).toBe("postgresql");
  });

  it("should detect CockroachDB when hostname is in non-URL connection strings", () => {
    // CockroachDB detection works for strings that don't start with postgresql://
    expect(detectDatabaseType("host=cockroachlabs.cloud dbname=mydb")).toBe("cockroachdb");
  });

  it("should be case insensitive", () => {
    expect(detectDatabaseType("POSTGRESQL://localhost/mydb")).toBe("postgresql");
    expect(detectDatabaseType("MySQL://localhost/mydb")).toBe("mysql");
  });

  it("should return null for unknown formats", () => {
    expect(detectDatabaseType("unknown://localhost/mydb")).toBeNull();
    expect(detectDatabaseType("just-a-string")).toBeNull();
  });

  it("should handle whitespace", () => {
    expect(detectDatabaseType("  postgresql://localhost/mydb  ")).toBe("postgresql");
  });
});

describe("parseConnectionString - PostgreSQL", () => {
  it("should parse basic PostgreSQL URL", () => {
    const result = parseConnectionString("postgresql://localhost/mydb");
    expect(result.databaseType).toBe("postgresql");
    expect(result.host).toBe("localhost");
    expect(result.database).toBe("mydb");
  });

  it("should parse PostgreSQL URL with port", () => {
    const result = parseConnectionString("postgresql://localhost:5432/mydb");
    expect(result.port).toBe(5432);
  });

  it("should parse PostgreSQL URL with credentials", () => {
    const result = parseConnectionString("postgresql://user:pass@localhost/mydb");
    expect(result.username).toBe("user");
    expect(result.password).toBe("pass");
  });

  it("should decode URL-encoded credentials", () => {
    const result = parseConnectionString(
      "postgresql://user%40domain:pass%23word@localhost/mydb"
    );
    expect(result.username).toBe("user@domain");
    expect(result.password).toBe("pass#word");
  });

  it("should parse sslmode from query string", () => {
    const result = parseConnectionString("postgresql://localhost/mydb?sslmode=require");
    expect(result.sslMode).toBe("require");
  });

  it("should handle postgres:// alias", () => {
    const result = parseConnectionString("postgres://localhost/mydb");
    expect(result.databaseType).toBe("postgresql");
  });

  it("should capture additional options", () => {
    const result = parseConnectionString(
      "postgresql://localhost/mydb?application_name=test&connect_timeout=10"
    );
    expect(result.options["application_name"]).toBe("test");
    expect(result.options["connect_timeout"]).toBe("10");
  });
});

describe("parseConnectionString - MySQL", () => {
  it("should parse basic MySQL URL", () => {
    const result = parseConnectionString("mysql://localhost/mydb");
    expect(result.databaseType).toBe("mysql");
    expect(result.host).toBe("localhost");
    expect(result.database).toBe("mydb");
  });

  it("should parse MySQL URL with port", () => {
    const result = parseConnectionString("mysql://localhost:3306/mydb");
    expect(result.port).toBe(3306);
  });

  it("should parse MySQL URL with credentials", () => {
    const result = parseConnectionString("mysql://root:secret@localhost/mydb");
    expect(result.username).toBe("root");
    expect(result.password).toBe("secret");
  });

  it("should detect MariaDB from URL prefix", () => {
    const result = parseConnectionString("mariadb://localhost/mydb");
    expect(result.databaseType).toBe("mariadb");
  });
});

describe("parseConnectionString - MSSQL", () => {
  it("should parse basic MSSQL connection string", () => {
    const result = parseConnectionString("Server=localhost;Database=mydb");
    expect(result.databaseType).toBe("mssql");
    expect(result.host).toBe("localhost");
    expect(result.database).toBe("mydb");
  });

  it("should parse MSSQL with tcp: prefix and port", () => {
    const result = parseConnectionString("Server=tcp:localhost,1433;Database=mydb");
    expect(result.host).toBe("localhost");
    expect(result.port).toBe(1433);
  });

  it("should parse MSSQL with credentials", () => {
    const result = parseConnectionString(
      "Server=localhost;Database=mydb;User Id=sa;Password=secret"
    );
    expect(result.username).toBe("sa");
    expect(result.password).toBe("secret");
  });

  it("should handle alternative key names", () => {
    const result = parseConnectionString(
      "Data Source=localhost;Initial Catalog=mydb;UID=sa;PWD=secret"
    );
    expect(result.host).toBe("localhost");
    expect(result.database).toBe("mydb");
    expect(result.username).toBe("sa");
    expect(result.password).toBe("secret");
  });

  it("should parse Encrypt option to sslMode", () => {
    const result = parseConnectionString(
      "Server=localhost;Database=mydb;Encrypt=True"
    );
    expect(result.sslMode).toBe("require");
  });

  it("should handle Encrypt=False", () => {
    const result = parseConnectionString(
      "Server=localhost;Database=mydb;Encrypt=False"
    );
    expect(result.sslMode).toBe("disable");
  });

  it("should handle quoted values (quotes are stripped)", () => {
    // Note: The current implementation strips surrounding quotes but
    // doesn't handle embedded semicolons within quotes specially
    const result = parseConnectionString(
      'Server=localhost;Database=mydb;Password="password"'
    );
    expect(result.password).toBe("password");
  });

  it("should capture additional options", () => {
    const result = parseConnectionString(
      "Server=localhost;Database=mydb;TrustServerCertificate=True"
    );
    expect(result.options["trustservercertificate"]).toBe("True");
  });
});

describe("parseConnectionString - Error handling", () => {
  it("should throw error for empty connection string", () => {
    expect(() => parseConnectionString("")).toThrow("Connection string cannot be empty");
  });

  it("should throw error for undetectable database type", () => {
    expect(() => parseConnectionString("unknown://localhost/mydb")).toThrow(
      "Could not detect database type"
    );
  });

  it("should parse minimal PostgreSQL URL without throwing", () => {
    // "postgresql://" is technically parseable - it just has empty fields
    const result = parseConnectionString("postgresql://localhost/", "postgresql");
    expect(result.databaseType).toBe("postgresql");
    expect(result.host).toBe("localhost");
  });
});

describe("validateParsedConnection", () => {
  it("should return no errors for valid connection", () => {
    const parsed = {
      host: "localhost",
      database: "mydb",
      options: {},
    };
    const errors = validateParsedConnection(parsed);
    expect(errors).toHaveLength(0);
  });

  it("should return error when host is missing", () => {
    const parsed = {
      database: "mydb",
      options: {},
    };
    const errors = validateParsedConnection(parsed);
    expect(errors).toContain("Host is required");
  });

  it("should return error when database is missing", () => {
    const parsed = {
      host: "localhost",
      options: {},
    };
    const errors = validateParsedConnection(parsed);
    expect(errors).toContain("Database name is required");
  });

  it("should return multiple errors when both are missing", () => {
    const parsed = {
      options: {},
    };
    const errors = validateParsedConnection(parsed);
    expect(errors).toHaveLength(2);
    expect(errors).toContain("Host is required");
    expect(errors).toContain("Database name is required");
  });
});
