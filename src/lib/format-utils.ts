/**
 * Format utilities for data grid cell rendering
 * Provides configurable formatting for dates, numbers, JSON, and NULL values
 */

import type {
  DateTimeFormatConfig,
  NumberFormatConfig,
  NullDisplayConfig,
  JsonDisplayMode,
  ConditionalFormatRule,
  ConditionalFormatStyle,
} from "@/types/grid";

// Date/Time Formatting

export interface FormattedDateTime {
  formatted: string;
  date: string;
  time: string;
  milliseconds?: string;
  timezone?: string;
  relative?: string;
}

/**
 * Format a timestamp value according to configuration
 */
export function formatDateTime(
  value: string | Date | number,
  config: DateTimeFormatConfig
): FormattedDateTime | null {
  let date: Date;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "number") {
    date = new Date(value);
  } else {
    // Try to parse string
    const timestampRegex =
      /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([+-]\d{2}:\d{2}|Z)?$/;
    const match = value.match(timestampRegex);

    if (match) {
      date = new Date(value);
    } else {
      // Try Date.parse as fallback
      const parsed = Date.parse(value);
      if (isNaN(parsed)) return null;
      date = new Date(parsed);
    }
  }

  if (isNaN(date.getTime())) return null;

  let dateStr: string;
  let timeStr: string;
  let formatted: string;

  switch (config.dateFormat) {
    case "locale":
      dateStr = date.toLocaleDateString();
      break;
    case "relative":
      dateStr = getRelativeDate(date);
      break;
    case "custom":
      dateStr = config.customFormat
        ? formatCustomDate(date, config.customFormat)
        : date.toISOString().split("T")[0];
      break;
    case "iso":
    default:
      dateStr = date.toISOString().split("T")[0];
      break;
  }

  if (config.timeFormat === "12h") {
    timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } else {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    timeStr = `${hours}:${minutes}:${seconds}`;
  }

  formatted = `${dateStr} ${timeStr}`;

  // Extract milliseconds and timezone from original if it was a string
  let milliseconds: string | undefined;
  let timezone: string | undefined;

  if (typeof value === "string") {
    const msMatch = value.match(/\.(\d+)/);
    if (msMatch) milliseconds = msMatch[1];

    const tzMatch = value.match(/([+-]\d{2}:\d{2}|Z)$/);
    if (tzMatch && config.showTimezone) {
      timezone = tzMatch[1];
    }
  }

  return {
    formatted,
    date: dateStr,
    time: timeStr,
    milliseconds,
    timezone,
    relative: getRelativeTime(date),
  };
}

/**
 * Get relative date string (Today, Yesterday, etc.)
 */
function getRelativeDate(date: Date): string {
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? "s" : ""} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Get relative time string (2 hours ago, etc.)
 */
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return "just now";
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Format date with custom format string
 * Supports: YYYY, MM, DD, HH, mm, ss, SSS
 */
function formatCustomDate(date: Date, format: string): string {
  const replacements: Record<string, string> = {
    YYYY: date.getFullYear().toString(),
    MM: (date.getMonth() + 1).toString().padStart(2, "0"),
    DD: date.getDate().toString().padStart(2, "0"),
    HH: date.getHours().toString().padStart(2, "0"),
    mm: date.getMinutes().toString().padStart(2, "0"),
    ss: date.getSeconds().toString().padStart(2, "0"),
    SSS: date.getMilliseconds().toString().padStart(3, "0"),
  };

  let result = format;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(key, "g"), value);
  }
  return result;
}

// Number Formatting

/**
 * Format a number according to configuration
 */
export function formatNumber(
  value: number | string,
  config: NumberFormatConfig
): string {
  const num = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(num)) return String(value);

  let formatted: string;

  switch (config.format) {
    case "compact":
      formatted = formatCompactNumber(num);
      break;
    case "scientific":
      formatted = num.toExponential(config.decimalPlaces);
      break;
    case "percentage":
      formatted =
        (num * 100).toFixed(config.decimalPlaces) + "%";
      break;
    case "default":
    default:
      if (config.thousandsSeparator) {
        formatted = num.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: config.decimalPlaces,
        });
      } else {
        formatted = num.toFixed(
          Number.isInteger(num) ? 0 : config.decimalPlaces
        );
      }
      break;
  }

  return formatted;
}

/**
 * Format number in compact notation (1.2K, 3.4M, etc.)
 */
function formatCompactNumber(num: number): string {
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (abs >= 1e12) {
    return sign + (abs / 1e12).toFixed(1) + "T";
  } else if (abs >= 1e9) {
    return sign + (abs / 1e9).toFixed(1) + "B";
  } else if (abs >= 1e6) {
    return sign + (abs / 1e6).toFixed(1) + "M";
  } else if (abs >= 1e3) {
    return sign + (abs / 1e3).toFixed(1) + "K";
  }
  return num.toString();
}

/**
 * Check if a number is negative (for styling)
 */
export function isNegativeNumber(value: unknown): boolean {
  if (typeof value === "number") return value < 0;
  if (typeof value === "string") {
    const num = parseFloat(value);
    return !isNaN(num) && num < 0;
  }
  return false;
}

// JSON Formatting

/**
 * Format JSON value according to display mode
 */
export function formatJson(
  value: unknown,
  mode: JsonDisplayMode
): { text: string; isCollapsed: boolean } {
  if (value === null || value === undefined) {
    return { text: "null", isCollapsed: false };
  }

  const jsonStr = JSON.stringify(value);

  switch (mode) {
    case "pretty":
      return {
        text: JSON.stringify(value, null, 2),
        isCollapsed: false,
      };
    case "inline":
      return {
        text: jsonStr.length > 100 ? jsonStr.substring(0, 100) + "..." : jsonStr,
        isCollapsed: false,
      };
    case "collapsed":
    default:
      const type = Array.isArray(value) ? "array" : "object";
      const count = Array.isArray(value)
        ? value.length
        : Object.keys(value as object).length;
      return {
        text: type === "array" ? `[${count} items]` : `{${count} keys}`,
        isCollapsed: true,
      };
  }
}

// NULL Value Formatting

/**
 * Get display properties for NULL values
 */
export function getNullDisplay(config: NullDisplayConfig): {
  text: string;
  className: string;
} {
  const baseClasses = "inline-flex items-center";

  switch (config.style) {
    case "italic":
      return {
        text: config.text,
        className: `${baseClasses} italic text-muted-foreground/60`,
      };
    case "dimmed":
      return {
        text: config.text,
        className: `${baseClasses} text-muted-foreground/40`,
      };
    case "badge":
    default:
      return {
        text: config.text,
        className: `${baseClasses} px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-border/50 bg-muted text-muted-foreground/60`,
      };
  }
}

// Conditional Formatting

/**
 * Evaluate if a value matches a conditional format rule
 */
export function evaluateCondition(
  value: unknown,
  rule: ConditionalFormatRule
): boolean {
  if (!rule.enabled) return false;

  const { condition } = rule;

  // Handle null checks first
  if (condition.type === "isNull") {
    return value === null || value === undefined;
  }
  if (condition.type === "isNotNull") {
    return value !== null && value !== undefined;
  }

  // For other checks, null values don't match
  if (value === null || value === undefined) return false;

  const strValue = String(value).toLowerCase();
  const condValue = String(condition.value ?? "").toLowerCase();

  switch (condition.type) {
    case "equals":
      return strValue === condValue;
    case "notEquals":
      return strValue !== condValue;
    case "contains":
      return strValue.includes(condValue);
    case "notContains":
      return !strValue.includes(condValue);
    case "startsWith":
      return strValue.startsWith(condValue);
    case "endsWith":
      return strValue.endsWith(condValue);
    case "gt":
      return parseFloat(String(value)) > parseFloat(String(condition.value));
    case "gte":
      return parseFloat(String(value)) >= parseFloat(String(condition.value));
    case "lt":
      return parseFloat(String(value)) < parseFloat(String(condition.value));
    case "lte":
      return parseFloat(String(value)) <= parseFloat(String(condition.value));
    case "between":
      const numValue = parseFloat(String(value));
      const min = parseFloat(String(condition.value));
      const max = parseFloat(String(condition.value2));
      return numValue >= min && numValue <= max;
    case "regex":
      try {
        const regex = new RegExp(String(condition.value), "i");
        return regex.test(String(value));
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/**
 * Get the style to apply for a cell based on conditional formatting rules
 */
export function getConditionalStyle(
  value: unknown,
  columnId: string,
  rules: ConditionalFormatRule[]
): ConditionalFormatStyle | null {
  // Sort by priority (lower is higher priority)
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    // Check if rule applies to this column
    if (rule.column !== "*" && rule.column !== columnId) continue;

    // Check if condition matches
    if (evaluateCondition(value, rule)) {
      return rule.style;
    }
  }

  return null;
}

/**
 * Convert conditional style to CSS style object
 */
export function conditionalStyleToCss(
  style: ConditionalFormatStyle | null
): React.CSSProperties {
  if (!style) return {};

  const css: React.CSSProperties = {};

  if (style.backgroundColor) {
    css.backgroundColor = style.backgroundColor;
  }
  if (style.textColor) {
    css.color = style.textColor;
  }
  if (style.fontWeight) {
    css.fontWeight = style.fontWeight;
  }
  if (style.fontStyle) {
    css.fontStyle = style.fontStyle;
  }

  return css;
}

// Type detection helpers

/**
 * Check if a column type is numeric
 */
export function isNumericType(dataType: string): boolean {
  return /int|float|double|decimal|numeric|real|money|serial|number/i.test(
    dataType
  );
}

/**
 * Check if a column type is date/time
 */
export function isDateTimeType(dataType: string): boolean {
  return /date|time|timestamp/i.test(dataType);
}

/**
 * Check if a column type is boolean
 */
export function isBooleanType(dataType: string): boolean {
  return /bool|bit/i.test(dataType);
}

/**
 * Check if a column type is JSON
 */
export function isJsonType(dataType: string): boolean {
  return /json|jsonb/i.test(dataType);
}

/**
 * Check if a column type is binary
 */
export function isBinaryType(dataType: string): boolean {
  return /bytea|blob|binary|varbinary|image/i.test(dataType);
}

/**
 * Check if a value looks like it could be JSON
 */
export function isJsonValue(value: unknown): boolean {
  if (typeof value === "object" && value !== null) return true;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    );
  }
  return false;
}
