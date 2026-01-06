import { describe, it, expect } from "vitest";
import { cn, formatTimestamp } from "@/lib/utils";

describe("cn (class name utility)", () => {
  it("should merge class names", () => {
    const result = cn("foo", "bar");
    expect(result).toBe("foo bar");
  });

  it("should handle conditional classes", () => {
    const result = cn("base", true && "included", false && "excluded");
    expect(result).toBe("base included");
  });

  it("should handle undefined and null values", () => {
    const result = cn("base", undefined, null, "end");
    expect(result).toBe("base end");
  });

  it("should merge tailwind classes correctly", () => {
    const result = cn("px-2 py-1", "px-4");
    expect(result).toBe("py-1 px-4");
  });

  it("should handle arrays of class names", () => {
    const result = cn(["foo", "bar"], "baz");
    expect(result).toBe("foo bar baz");
  });

  it("should handle objects with boolean values", () => {
    const result = cn("base", { active: true, disabled: false });
    expect(result).toBe("base active");
  });
});

describe("formatTimestamp", () => {
  it("should parse ISO 8601 timestamp with T separator", () => {
    const result = formatTimestamp("2024-01-15T10:30:45");
    expect(result).not.toBeNull();
    expect(result?.formatted).toBe("2024-01-15 10:30:45");
    expect(result?.date).toBe("2024-01-15");
    expect(result?.time).toBe("10:30:45");
  });

  it("should parse timestamp with space separator", () => {
    const result = formatTimestamp("2024-01-15 10:30:45");
    expect(result).not.toBeNull();
    expect(result?.formatted).toBe("2024-01-15 10:30:45");
  });

  it("should handle milliseconds", () => {
    const result = formatTimestamp("2024-01-15T10:30:45.123");
    expect(result).not.toBeNull();
    expect(result?.milliseconds).toBe("123");
  });

  it("should handle timezone with positive offset", () => {
    const result = formatTimestamp("2024-01-15T10:30:45+05:30");
    expect(result).not.toBeNull();
    expect(result?.timezone).toBe("+05:30");
  });

  it("should handle timezone with negative offset", () => {
    const result = formatTimestamp("2024-01-15T10:30:45-08:00");
    expect(result).not.toBeNull();
    expect(result?.timezone).toBe("-08:00");
  });

  it("should handle Z (UTC) timezone", () => {
    const result = formatTimestamp("2024-01-15T10:30:45Z");
    expect(result).not.toBeNull();
    expect(result?.timezone).toBe("Z");
  });

  it("should handle milliseconds with timezone", () => {
    const result = formatTimestamp("2024-01-15T10:30:45.999+00:00");
    expect(result).not.toBeNull();
    expect(result?.milliseconds).toBe("999");
    expect(result?.timezone).toBe("+00:00");
  });

  it("should return null for invalid format", () => {
    expect(formatTimestamp("invalid")).toBeNull();
    expect(formatTimestamp("01/15/2024")).toBeNull(); // Wrong format (US date)
    expect(formatTimestamp("2024/01/15")).toBeNull(); // Wrong separator
  });

  it("should parse format without validating date values", () => {
    // Note: formatTimestamp validates format structure, not date validity
    // 2024-13-01 matches the regex pattern even though month 13 is invalid
    const result = formatTimestamp("2024-13-01T00:00:00");
    expect(result).not.toBeNull();
    expect(result?.date).toBe("2024-13-01");
  });

  it("should return null for empty string", () => {
    expect(formatTimestamp("")).toBeNull();
  });
});
