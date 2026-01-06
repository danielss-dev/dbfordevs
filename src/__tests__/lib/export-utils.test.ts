import { describe, it, expect } from "vitest";
import { rowsToInsertSQL, rowsToJSON, rowsToCSV } from "@/lib/export-utils";
import type { SelectedRow } from "@/stores/crud";
import type { ColumnInfo } from "@/types";

const mockColumns: ColumnInfo[] = [
  { name: "id", dataType: "integer", nullable: false, isPrimaryKey: true },
  { name: "name", dataType: "varchar", nullable: true, isPrimaryKey: false },
  { name: "active", dataType: "boolean", nullable: false, isPrimaryKey: false },
];

const mockRows: SelectedRow[] = [
  {
    rowId: "1",
    tableName: "users",
    rowData: { id: 1, name: "John Doe", active: true },
    columns: mockColumns,
  },
  {
    rowId: "2",
    tableName: "users",
    rowData: { id: 2, name: "Jane Smith", active: false },
    columns: mockColumns,
  },
];

describe("rowsToInsertSQL", () => {
  it("should generate INSERT statements for rows", () => {
    const result = rowsToInsertSQL(mockRows, "users");
    expect(result).toContain("INSERT INTO users");
    expect(result).toContain("(id, name, active)");
    expect(result).toContain("VALUES (1, 'John Doe', TRUE)");
    expect(result).toContain("VALUES (2, 'Jane Smith', FALSE)");
  });

  it("should return empty string for empty rows", () => {
    const result = rowsToInsertSQL([], "users");
    expect(result).toBe("");
  });

  it("should use table name from first row if not provided", () => {
    const result = rowsToInsertSQL(mockRows, "");
    expect(result).toContain("INSERT INTO users");
  });

  it("should handle NULL values", () => {
    const rowsWithNull: SelectedRow[] = [
      {
        rowId: "1",
        tableName: "users",
        rowData: { id: 1, name: null, active: true },
        columns: mockColumns,
      },
    ];
    const result = rowsToInsertSQL(rowsWithNull, "users");
    expect(result).toContain("NULL");
  });

  it("should escape single quotes in string values", () => {
    const rowsWithQuotes: SelectedRow[] = [
      {
        rowId: "1",
        tableName: "users",
        rowData: { id: 1, name: "O'Brien", active: true },
        columns: mockColumns,
      },
    ];
    const result = rowsToInsertSQL(rowsWithQuotes, "users");
    expect(result).toContain("'O''Brien'");
  });

  it("should handle numeric values", () => {
    const result = rowsToInsertSQL(mockRows, "users");
    expect(result).toContain("VALUES (1,");
    expect(result).toContain("VALUES (2,");
  });

  it("should handle object values as JSON", () => {
    const columnsWithJson: ColumnInfo[] = [
      { name: "id", dataType: "integer", nullable: false, isPrimaryKey: true },
      { name: "data", dataType: "jsonb", nullable: true, isPrimaryKey: false },
    ];
    const rowsWithJson: SelectedRow[] = [
      {
        rowId: "1",
        tableName: "items",
        rowData: { id: 1, data: { foo: "bar" } },
        columns: columnsWithJson,
      },
    ];
    const result = rowsToInsertSQL(rowsWithJson, "items");
    expect(result).toContain('\'{"foo":"bar"}\'');
  });
});

describe("rowsToJSON", () => {
  it("should convert rows to JSON format", () => {
    const result = rowsToJSON(mockRows);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({ id: 1, name: "John Doe", active: true });
    expect(parsed[1]).toEqual({ id: 2, name: "Jane Smith", active: false });
  });

  it("should return empty array for empty rows", () => {
    const result = rowsToJSON([]);
    expect(result).toBe("[]");
  });

  it("should format JSON with 2-space indentation", () => {
    const result = rowsToJSON(mockRows);
    expect(result).toContain("  ");
    expect(result).toContain("\n");
  });
});

describe("rowsToCSV", () => {
  it("should convert rows to CSV format with headers", () => {
    const result = rowsToCSV(mockRows, true);
    const lines = result.split("\n");
    expect(lines[0]).toBe("id,name,active");
    expect(lines[1]).toBe("1,John Doe,true");
    expect(lines[2]).toBe("2,Jane Smith,false");
  });

  it("should convert rows to CSV format without headers", () => {
    const result = rowsToCSV(mockRows, false);
    const lines = result.split("\n");
    expect(lines[0]).toBe("1,John Doe,true");
    expect(lines).toHaveLength(2);
  });

  it("should return empty string for empty rows", () => {
    const result = rowsToCSV([], true);
    expect(result).toBe("");
  });

  it("should escape values containing commas", () => {
    const rowsWithComma: SelectedRow[] = [
      {
        rowId: "1",
        tableName: "users",
        rowData: { id: 1, name: "Doe, John", active: true },
        columns: mockColumns,
      },
    ];
    const result = rowsToCSV(rowsWithComma, false);
    expect(result).toContain('"Doe, John"');
  });

  it("should escape values containing quotes", () => {
    const rowsWithQuotes: SelectedRow[] = [
      {
        rowId: "1",
        tableName: "users",
        rowData: { id: 1, name: 'John "The Dev" Doe', active: true },
        columns: mockColumns,
      },
    ];
    const result = rowsToCSV(rowsWithQuotes, false);
    expect(result).toContain('"John ""The Dev"" Doe"');
  });

  it("should escape values containing newlines", () => {
    const rowsWithNewline: SelectedRow[] = [
      {
        rowId: "1",
        tableName: "users",
        rowData: { id: 1, name: "John\nDoe", active: true },
        columns: mockColumns,
      },
    ];
    const result = rowsToCSV(rowsWithNewline, false);
    expect(result).toContain('"John\nDoe"');
  });

  it("should handle null and undefined as empty strings", () => {
    const rowsWithNull: SelectedRow[] = [
      {
        rowId: "1",
        tableName: "users",
        rowData: { id: 1, name: null, active: true },
        columns: mockColumns,
      },
    ];
    const result = rowsToCSV(rowsWithNull, false);
    expect(result).toBe("1,,true");
  });
});
