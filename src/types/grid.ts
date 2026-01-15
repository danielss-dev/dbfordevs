// Grid Enhancement Types

// Date/Time formatting options
export type DateFormat = "iso" | "locale" | "relative" | "custom";
export type TimeFormat = "12h" | "24h";

export interface DateTimeFormatConfig {
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  showTimezone: boolean;
  customFormat?: string;
}

// Number formatting options
export type NumberFormat = "default" | "compact" | "scientific" | "percentage";

export interface NumberFormatConfig {
  format: NumberFormat;
  decimalPlaces: number;
  thousandsSeparator: boolean;
  negativeColor: boolean;
}

// JSON display options
export type JsonDisplayMode = "collapsed" | "inline" | "pretty";

// NULL display options
export type NullDisplayStyle = "badge" | "italic" | "dimmed";

export interface NullDisplayConfig {
  text: string;
  style: NullDisplayStyle;
  customColor?: string;
}

// Conditional formatting
export type ConditionalOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "isNull"
  | "isNotNull"
  | "regex";

export interface ConditionalFormatCondition {
  type: ConditionalOperator;
  value?: string | number;
  value2?: number; // For 'between'
}

export interface ConditionalFormatStyle {
  backgroundColor?: string;
  textColor?: string;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
}

export interface ConditionalFormatRule {
  id: string;
  name: string;
  column: string | "*"; // '*' means all columns
  condition: ConditionalFormatCondition;
  style: ConditionalFormatStyle;
  enabled: boolean;
  priority: number;
}

// Row height options
export type RowHeightMode = "compact" | "default" | "comfortable" | "custom";

export interface RowHeightConfig {
  mode: RowHeightMode;
  customHeight?: number; // pixels
}

// Row height pixel values
export const ROW_HEIGHT_VALUES: Record<RowHeightMode, number> = {
  compact: 28,
  default: 36,
  comfortable: 44,
  custom: 36,
};

// Column configuration (per-column preferences)
export interface ColumnConfig {
  columnId: string;
  width?: number;
  visible: boolean;
  pinned: "left" | "right" | false;
  order: number;
}

// Grid preferences (per-table)
export interface GridPreferences {
  tableKey: string; // connectionId:tableName or queryHash
  columns: Record<string, ColumnConfig>;
  columnOrder: string[];
  rowHeight?: RowHeightConfig;
}

// Column statistics
export interface ColumnStats {
  columnId: string;
  dataType: string;
  totalCount: number;
  nullCount: number;
  distinctCount: number;
  // For numeric columns
  sum?: number;
  avg?: number;
  min?: number | string;
  max?: number | string;
  stdDev?: number;
  // For string columns
  minLength?: number;
  maxLength?: number;
  avgLength?: number;
  // For date columns
  earliestDate?: string;
  latestDate?: string;
}

// Find & Replace state
export interface FindMatch {
  rowIndex: number;
  columnId: string;
  startPos: number;
  endPos: number;
  value: string;
}

export interface FindReplaceState {
  isOpen: boolean;
  findText: string;
  replaceText: string;
  matchCase: boolean;
  wholeWord: boolean;
  useRegex: boolean;
  selectedColumn: string | null; // null = all columns
  currentMatchIndex: number;
  matches: FindMatch[];
}

// Binary preview
export type BinaryPreviewMode = "hex" | "base64" | "image" | "text";

export interface BinaryPreviewConfig {
  defaultMode: BinaryPreviewMode;
  hexBytesPerRow: 16 | 32;
  autoDetectImages: boolean;
}

// Cell context for copy/paste operations
export interface CellContext {
  rowIndex: number;
  columnId: string;
  value: unknown;
  rowData: Record<string, unknown>;
}

// Image detection result
export interface DetectedImageInfo {
  type: "png" | "jpeg" | "gif" | "webp" | "bmp" | "unknown";
  mimeType: string;
  width?: number;
  height?: number;
}
