import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatRelativeTime,
  formatExecutionTime,
  truncateSQL,
} from "@/components/query-history/query-history-utils";

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return 'just now' for recent timestamps", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    expect(formatRelativeTime(now)).toBe("just now");
    expect(formatRelativeTime(now - 30 * 1000)).toBe("just now"); // 30 seconds ago
  });

  it("should return minutes for timestamps within the hour", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    expect(formatRelativeTime(now - 60 * 1000)).toBe("1m ago");
    expect(formatRelativeTime(now - 5 * 60 * 1000)).toBe("5m ago");
    expect(formatRelativeTime(now - 59 * 60 * 1000)).toBe("59m ago");
  });

  it("should return hours for timestamps within the day", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    expect(formatRelativeTime(now - 60 * 60 * 1000)).toBe("1h ago");
    expect(formatRelativeTime(now - 3 * 60 * 60 * 1000)).toBe("3h ago");
    expect(formatRelativeTime(now - 23 * 60 * 60 * 1000)).toBe("23h ago");
  });

  it("should return days for older timestamps", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    expect(formatRelativeTime(now - 24 * 60 * 60 * 1000)).toBe("1d ago");
    expect(formatRelativeTime(now - 7 * 24 * 60 * 60 * 1000)).toBe("7d ago");
    expect(formatRelativeTime(now - 30 * 24 * 60 * 60 * 1000)).toBe("30d ago");
  });
});

describe("formatExecutionTime", () => {
  it("should return empty string for undefined", () => {
    expect(formatExecutionTime(undefined)).toBe("");
  });

  it("should format milliseconds under 1 second", () => {
    expect(formatExecutionTime(0)).toBe("0ms");
    expect(formatExecutionTime(1)).toBe("1ms");
    expect(formatExecutionTime(500)).toBe("500ms");
    expect(formatExecutionTime(999)).toBe("999ms");
  });

  it("should format as seconds for 1000ms or more", () => {
    expect(formatExecutionTime(1000)).toBe("1.00s");
    expect(formatExecutionTime(1500)).toBe("1.50s");
    expect(formatExecutionTime(2345)).toBe("2.35s");
    expect(formatExecutionTime(10000)).toBe("10.00s");
  });

  it("should handle edge cases", () => {
    expect(formatExecutionTime(0)).toBe("0ms");
    expect(formatExecutionTime(1000)).toBe("1.00s");
  });
});

describe("truncateSQL", () => {
  it("should not truncate short SQL", () => {
    const sql = "SELECT * FROM users";
    expect(truncateSQL(sql)).toBe(sql);
  });

  it("should truncate long SQL with ellipsis", () => {
    const sql = "SELECT * FROM users WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20)";
    const result = truncateSQL(sql, 50);
    expect(result.length).toBe(53); // 50 + "..."
    expect(result.endsWith("...")).toBe(true);
  });

  it("should collapse multiple whitespace to single space", () => {
    const sql = `SELECT *
    FROM   users
    WHERE  id = 1`;
    const result = truncateSQL(sql);
    expect(result).toBe("SELECT * FROM users WHERE id = 1");
  });

  it("should trim whitespace", () => {
    const sql = "  SELECT * FROM users  ";
    expect(truncateSQL(sql)).toBe("SELECT * FROM users");
  });

  it("should use default max length of 100", () => {
    const longSql = "SELECT " + "a, ".repeat(50) + "b FROM users";
    const result = truncateSQL(longSql);
    expect(result.length).toBeLessThanOrEqual(103); // 100 + "..."
  });

  it("should handle custom max length", () => {
    const sql = "SELECT * FROM users WHERE active = true";
    const result = truncateSQL(sql, 20);
    expect(result).toBe("SELECT * FROM users ...");
  });

  it("should handle empty string", () => {
    expect(truncateSQL("")).toBe("");
  });

  it("should handle SQL at exact max length", () => {
    const sql = "SELECT * FROM users"; // 19 characters
    expect(truncateSQL(sql, 19)).toBe(sql);
    expect(truncateSQL(sql, 18)).toBe("SELECT * FROM user...");
  });
});
