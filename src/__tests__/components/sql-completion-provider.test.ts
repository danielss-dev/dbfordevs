import { describe, expect, it } from "vitest";
import {
  __testing,
  createSqlCompletionProvider,
} from "@/components/editor/sql-completion-provider";
import type { TableInfo } from "@/types";

function createSingleLineModel(sql: string, version = 1) {
  return {
    getValue: () => sql,
    getVersionId: () => version,
    getValueInRange: ({
      startColumn,
      endColumn,
    }: {
      startColumn: number;
      endColumn: number;
    }) => sql.slice(startColumn - 1, endColumn - 1),
    getWordUntilPosition: ({ column }: { column: number }) => {
      const left = sql.slice(0, column - 1);
      const match = left.match(/[a-zA-Z_]\w*$/);
      const word = match?.[0] ?? "";
      return {
        word,
        startColumn: column - word.length,
        endColumn: column,
      };
    },
  };
}

describe("sql completion provider helpers", () => {
  it("adds dialect-specific postgres keywords", () => {
    const postgresKeywords = __testing.getActiveKeywords("postgresql");
    const mysqlKeywords = __testing.getActiveKeywords("mysql");

    expect(postgresKeywords).toContain("ILIKE");
    expect(mysqlKeywords).not.toContain("ILIKE");
  });

  it("parses CTE columns from SELECT list", () => {
    const ctes = __testing.parseCteDefinitions(
      "WITH recent_orders AS (SELECT id, total_amount AS amount FROM orders) SELECT * FROM recent_orders"
    );

    expect(ctes.get("recent_orders")).toEqual(["id", "amount"]);
  });

  it("extracts aliases for table and CTE sources", () => {
    const tables: TableInfo[] = [
      { name: "orders", schema: "public", tableType: "TABLE" },
    ];
    const cteColumns = new Map<string, string[]>([
      ["recent", ["id"]],
    ]);

    const aliases = __testing.extractTableAliases(
      "WITH recent AS (SELECT id FROM orders) SELECT * FROM orders o JOIN recent r ON r.id = o.id",
      tables,
      cteColumns
    );

    expect(aliases.get("o")).toBe("orders");
    expect(aliases.get("r")).toBe("recent");
  });
});

describe("createSqlCompletionProvider", () => {
  it("suggests CTE columns after dot", () => {
    const sql = "WITH recent AS (SELECT id, created_at FROM orders) SELECT recent.";
    const model = createSingleLineModel(sql);
    const provider = createSqlCompletionProvider({
      getTables: () => [{ name: "orders", schema: "public", tableType: "TABLE" }],
      getTableSchema: () => null,
      getDatabaseType: () => "postgresql",
    });

    const result = provider.provideCompletionItems(
      model as never,
      { lineNumber: 1, column: sql.length + 1 } as never
    );

    const labels = result.suggestions.map((item) => String(item.label));
    expect(labels).toContain("id");
    expect(labels).toContain("created_at");
  });

  it("suggests schema-qualified table names after schema dot", () => {
    const sql = "SELECT * FROM reporting.";
    const model = createSingleLineModel(sql);
    const provider = createSqlCompletionProvider({
      getTables: () => [
        { name: "sales", schema: "reporting", tableType: "TABLE" },
        { name: "users", schema: "public", tableType: "TABLE" },
      ],
      getTableSchema: () => null,
      getDatabaseType: () => "postgresql",
    });

    const result = provider.provideCompletionItems(
      model as never,
      { lineNumber: 1, column: sql.length + 1 } as never
    );

    const labels = result.suggestions.map((item) => String(item.label));
    expect(labels).toContain("sales");
    expect(labels).not.toContain("users");
  });

  it("ranks referenced columns before keywords in default context", () => {
    const sql = "SELECT  FROM orders";
    const model = createSingleLineModel(sql);
    const provider = createSqlCompletionProvider({
      getTables: () => [{ name: "orders", schema: "public", tableType: "TABLE" }],
      getTableSchema: (tableName) => {
        if (tableName === "orders" || tableName === "public.orders") {
          return {
            tableName: "orders",
            columns: [
              { name: "id", dataType: "INT", nullable: false, isPrimaryKey: true },
            ],
            primaryKeys: ["id"],
            foreignKeys: [],
          };
        }
        return null;
      },
      getDatabaseType: () => "postgresql",
    });

    const result = provider.provideCompletionItems(
      model as never,
      { lineNumber: 1, column: 8 } as never
    );

    const idSuggestion = result.suggestions.find((item) => String(item.label) === "id");
    const selectKeyword = result.suggestions.find((item) => String(item.label) === "SELECT");

    expect(idSuggestion?.sortText).toBe("10_column_id");
    expect(selectKeyword?.sortText).toBe("90_keyword_select");
  });
});
