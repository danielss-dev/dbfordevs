import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  DateTimeFormatConfig,
  NumberFormatConfig,
  NullDisplayConfig,
  ConditionalFormatRule,
  RowHeightConfig,
  GridPreferences,
  ColumnConfig,
  FindReplaceState,
  FindMatch,
  BinaryPreviewConfig,
  JsonDisplayMode,
  ColumnStats,
} from "@/types/grid";

interface GridState {
  // Global formatting settings (apply to all grids)
  dateTimeFormat: DateTimeFormatConfig;
  numberFormat: NumberFormatConfig;
  nullDisplay: NullDisplayConfig;
  jsonDisplay: JsonDisplayMode;
  binaryPreview: BinaryPreviewConfig;

  // Default row height for new grids
  defaultRowHeight: RowHeightConfig;

  // Conditional formatting rules (global)
  conditionalRules: ConditionalFormatRule[];

  // Per-table/query preferences (column visibility, order, pinning)
  gridPreferences: Record<string, GridPreferences>;

  // Find & Replace state (transient, not persisted)
  findReplace: FindReplaceState;

  // Statistics dialog state (transient)
  statisticsColumn: string | null;
  statisticsDialogOpen: boolean;

  // Binary preview dialog state (transient)
  binaryPreviewValue: string | null;
  binaryPreviewDialogOpen: boolean;

  // Actions - Formatting
  updateDateTimeFormat: (config: Partial<DateTimeFormatConfig>) => void;
  updateNumberFormat: (config: Partial<NumberFormatConfig>) => void;
  updateNullDisplay: (config: Partial<NullDisplayConfig>) => void;
  setJsonDisplay: (mode: JsonDisplayMode) => void;
  updateBinaryPreview: (config: Partial<BinaryPreviewConfig>) => void;

  // Actions - Row Height
  setDefaultRowHeight: (config: RowHeightConfig) => void;
  getTableRowHeight: (tableKey: string) => RowHeightConfig;
  setTableRowHeight: (tableKey: string, config: RowHeightConfig) => void;

  // Actions - Conditional Formatting
  addConditionalRule: (rule: Omit<ConditionalFormatRule, "id">) => void;
  updateConditionalRule: (
    id: string,
    updates: Partial<ConditionalFormatRule>
  ) => void;
  removeConditionalRule: (id: string) => void;
  toggleConditionalRule: (id: string) => void;
  reorderConditionalRules: (ruleIds: string[]) => void;

  // Actions - Grid Preferences (column visibility, order, pinning)
  getGridPreferences: (tableKey: string) => GridPreferences | undefined;
  initGridPreferences: (tableKey: string, columnIds: string[]) => void;
  setColumnVisibility: (
    tableKey: string,
    columnId: string,
    visible: boolean
  ) => void;
  setAllColumnsVisibility: (tableKey: string, visible: boolean) => void;
  setColumnPinning: (
    tableKey: string,
    columnId: string,
    pinned: "left" | "right" | false
  ) => void;
  setColumnOrder: (tableKey: string, columnOrder: string[]) => void;
  setColumnWidth: (tableKey: string, columnId: string, width: number) => void;
  resetGridPreferences: (tableKey: string) => void;

  // Actions - Find & Replace
  openFindReplace: () => void;
  closeFindReplace: () => void;
  setFindText: (text: string) => void;
  setReplaceText: (text: string) => void;
  setFindOptions: (
    options: Partial<
      Pick<FindReplaceState, "matchCase" | "wholeWord" | "useRegex">
    >
  ) => void;
  setFindColumn: (columnId: string | null) => void;
  setMatches: (matches: FindMatch[]) => void;
  setCurrentMatchIndex: (index: number) => void;
  nextMatch: () => void;
  prevMatch: () => void;
  clearFindReplace: () => void;

  // Actions - Statistics Dialog
  openStatisticsDialog: (columnId: string) => void;
  closeStatisticsDialog: () => void;

  // Actions - Binary Preview Dialog
  openBinaryPreviewDialog: (value: string) => void;
  closeBinaryPreviewDialog: () => void;
}

const generateId = () =>
  `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

export const useGridStore = create<GridState>()(
  persist(
    (set, get) => ({
      // Default values
      dateTimeFormat: {
        dateFormat: "iso",
        timeFormat: "24h",
        showTimezone: true,
      },
      numberFormat: {
        format: "default",
        decimalPlaces: 2,
        thousandsSeparator: true,
        negativeColor: false,
      },
      nullDisplay: {
        text: "NULL",
        style: "badge",
      },
      jsonDisplay: "collapsed",
      binaryPreview: {
        defaultMode: "hex",
        hexBytesPerRow: 16,
        autoDetectImages: true,
      },
      defaultRowHeight: {
        mode: "default",
      },
      conditionalRules: [],
      gridPreferences: {},
      findReplace: {
        isOpen: false,
        findText: "",
        replaceText: "",
        matchCase: false,
        wholeWord: false,
        useRegex: false,
        selectedColumn: null,
        currentMatchIndex: 0,
        matches: [],
      },
      statisticsColumn: null,
      statisticsDialogOpen: false,
      binaryPreviewValue: null,
      binaryPreviewDialogOpen: false,

      // Formatting actions
      updateDateTimeFormat: (config) =>
        set((state) => ({
          dateTimeFormat: { ...state.dateTimeFormat, ...config },
        })),

      updateNumberFormat: (config) =>
        set((state) => ({
          numberFormat: { ...state.numberFormat, ...config },
        })),

      updateNullDisplay: (config) =>
        set((state) => ({
          nullDisplay: { ...state.nullDisplay, ...config },
        })),

      setJsonDisplay: (mode) => set({ jsonDisplay: mode }),

      updateBinaryPreview: (config) =>
        set((state) => ({
          binaryPreview: { ...state.binaryPreview, ...config },
        })),

      // Row Height actions
      setDefaultRowHeight: (config) => set({ defaultRowHeight: config }),

      getTableRowHeight: (tableKey) => {
        const prefs = get().gridPreferences[tableKey];
        return prefs?.rowHeight || get().defaultRowHeight;
      },

      setTableRowHeight: (tableKey, config) =>
        set((state) => {
          const existing = state.gridPreferences[tableKey];
          if (!existing) return state;
          return {
            gridPreferences: {
              ...state.gridPreferences,
              [tableKey]: { ...existing, rowHeight: config },
            },
          };
        }),

      // Conditional Formatting actions
      addConditionalRule: (rule) =>
        set((state) => ({
          conditionalRules: [
            ...state.conditionalRules,
            { ...rule, id: generateId() },
          ],
        })),

      updateConditionalRule: (id, updates) =>
        set((state) => ({
          conditionalRules: state.conditionalRules.map((rule) =>
            rule.id === id ? { ...rule, ...updates } : rule
          ),
        })),

      removeConditionalRule: (id) =>
        set((state) => ({
          conditionalRules: state.conditionalRules.filter(
            (rule) => rule.id !== id
          ),
        })),

      toggleConditionalRule: (id) =>
        set((state) => ({
          conditionalRules: state.conditionalRules.map((rule) =>
            rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
          ),
        })),

      reorderConditionalRules: (ruleIds) =>
        set((state) => {
          const ruleMap = new Map(
            state.conditionalRules.map((r) => [r.id, r])
          );
          const reordered = ruleIds
            .map((id, index) => {
              const rule = ruleMap.get(id);
              return rule ? { ...rule, priority: index } : null;
            })
            .filter((r): r is ConditionalFormatRule => r !== null);
          return { conditionalRules: reordered };
        }),

      // Grid Preferences actions
      getGridPreferences: (tableKey) => get().gridPreferences[tableKey],

      initGridPreferences: (tableKey, columnIds) =>
        set((state) => {
          // Don't overwrite existing preferences
          if (state.gridPreferences[tableKey]) return state;

          const columns: Record<string, ColumnConfig> = {};
          columnIds.forEach((id, index) => {
            columns[id] = {
              columnId: id,
              visible: true,
              pinned: false,
              order: index,
            };
          });

          return {
            gridPreferences: {
              ...state.gridPreferences,
              [tableKey]: {
                tableKey,
                columns,
                columnOrder: columnIds,
              },
            },
          };
        }),

      setColumnVisibility: (tableKey, columnId, visible) =>
        set((state) => {
          const existing = state.gridPreferences[tableKey];
          if (!existing) return state;

          const updatedColumns = { ...existing.columns };
          if (updatedColumns[columnId]) {
            updatedColumns[columnId] = {
              ...updatedColumns[columnId],
              visible,
            };
          }

          return {
            gridPreferences: {
              ...state.gridPreferences,
              [tableKey]: { ...existing, columns: updatedColumns },
            },
          };
        }),

      setAllColumnsVisibility: (tableKey, visible) =>
        set((state) => {
          const existing = state.gridPreferences[tableKey];
          if (!existing) return state;

          const updatedColumns = { ...existing.columns };
          Object.keys(updatedColumns).forEach((key) => {
            updatedColumns[key] = { ...updatedColumns[key], visible };
          });

          return {
            gridPreferences: {
              ...state.gridPreferences,
              [tableKey]: { ...existing, columns: updatedColumns },
            },
          };
        }),

      setColumnPinning: (tableKey, columnId, pinned) =>
        set((state) => {
          const existing = state.gridPreferences[tableKey];
          if (!existing) return state;

          const updatedColumns = { ...existing.columns };
          if (updatedColumns[columnId]) {
            updatedColumns[columnId] = {
              ...updatedColumns[columnId],
              pinned,
            };
          }

          return {
            gridPreferences: {
              ...state.gridPreferences,
              [tableKey]: { ...existing, columns: updatedColumns },
            },
          };
        }),

      setColumnOrder: (tableKey, columnOrder) =>
        set((state) => {
          const existing = state.gridPreferences[tableKey];
          if (!existing) return state;

          // Also update order in column configs
          const updatedColumns = { ...existing.columns };
          columnOrder.forEach((id, index) => {
            if (updatedColumns[id]) {
              updatedColumns[id] = { ...updatedColumns[id], order: index };
            }
          });

          return {
            gridPreferences: {
              ...state.gridPreferences,
              [tableKey]: {
                ...existing,
                columns: updatedColumns,
                columnOrder,
              },
            },
          };
        }),

      setColumnWidth: (tableKey, columnId, width) =>
        set((state) => {
          const existing = state.gridPreferences[tableKey];
          if (!existing) return state;

          const updatedColumns = { ...existing.columns };
          if (updatedColumns[columnId]) {
            updatedColumns[columnId] = {
              ...updatedColumns[columnId],
              width,
            };
          }

          return {
            gridPreferences: {
              ...state.gridPreferences,
              [tableKey]: { ...existing, columns: updatedColumns },
            },
          };
        }),

      resetGridPreferences: (tableKey) =>
        set((state) => {
          const { [tableKey]: _, ...rest } = state.gridPreferences;
          return { gridPreferences: rest };
        }),

      // Find & Replace actions
      openFindReplace: () =>
        set((state) => ({
          findReplace: { ...state.findReplace, isOpen: true },
        })),

      closeFindReplace: () =>
        set((state) => ({
          findReplace: { ...state.findReplace, isOpen: false },
        })),

      setFindText: (text) =>
        set((state) => ({
          findReplace: {
            ...state.findReplace,
            findText: text,
            currentMatchIndex: 0,
          },
        })),

      setReplaceText: (text) =>
        set((state) => ({
          findReplace: { ...state.findReplace, replaceText: text },
        })),

      setFindOptions: (options) =>
        set((state) => ({
          findReplace: {
            ...state.findReplace,
            ...options,
            currentMatchIndex: 0,
          },
        })),

      setFindColumn: (columnId) =>
        set((state) => ({
          findReplace: {
            ...state.findReplace,
            selectedColumn: columnId,
            currentMatchIndex: 0,
          },
        })),

      setMatches: (matches) =>
        set((state) => ({
          findReplace: {
            ...state.findReplace,
            matches,
            currentMatchIndex:
              matches.length > 0
                ? Math.min(state.findReplace.currentMatchIndex, matches.length - 1)
                : 0,
          },
        })),

      setCurrentMatchIndex: (index) =>
        set((state) => ({
          findReplace: { ...state.findReplace, currentMatchIndex: index },
        })),

      nextMatch: () =>
        set((state) => {
          const { matches, currentMatchIndex } = state.findReplace;
          if (matches.length === 0) return state;
          const nextIndex = (currentMatchIndex + 1) % matches.length;
          return {
            findReplace: { ...state.findReplace, currentMatchIndex: nextIndex },
          };
        }),

      prevMatch: () =>
        set((state) => {
          const { matches, currentMatchIndex } = state.findReplace;
          if (matches.length === 0) return state;
          const prevIndex =
            currentMatchIndex === 0 ? matches.length - 1 : currentMatchIndex - 1;
          return {
            findReplace: { ...state.findReplace, currentMatchIndex: prevIndex },
          };
        }),

      clearFindReplace: () =>
        set({
          findReplace: {
            isOpen: false,
            findText: "",
            replaceText: "",
            matchCase: false,
            wholeWord: false,
            useRegex: false,
            selectedColumn: null,
            currentMatchIndex: 0,
            matches: [],
          },
        }),

      // Statistics Dialog actions
      openStatisticsDialog: (columnId) =>
        set({ statisticsColumn: columnId, statisticsDialogOpen: true }),

      closeStatisticsDialog: () =>
        set({ statisticsColumn: null, statisticsDialogOpen: false }),

      // Binary Preview Dialog actions
      openBinaryPreviewDialog: (value) =>
        set({ binaryPreviewValue: value, binaryPreviewDialogOpen: true }),

      closeBinaryPreviewDialog: () =>
        set({ binaryPreviewValue: null, binaryPreviewDialogOpen: false }),
    }),
    {
      name: "dbfordevs-grid",
      partialize: (state) => ({
        dateTimeFormat: state.dateTimeFormat,
        numberFormat: state.numberFormat,
        nullDisplay: state.nullDisplay,
        jsonDisplay: state.jsonDisplay,
        binaryPreview: state.binaryPreview,
        defaultRowHeight: state.defaultRowHeight,
        conditionalRules: state.conditionalRules,
        // gridPreferences is NOT persisted - resets to defaults each session
        // findReplace, statisticsColumn, binaryPreviewValue are NOT persisted (transient state)
      }),
    }
  )
);

// Utility function to calculate column statistics
export function calculateColumnStats(
  data: Record<string, unknown>[],
  columnId: string,
  dataType: string
): ColumnStats {
  const values = data.map((row) => row[columnId]);
  const totalCount = values.length;
  const nullCount = values.filter(
    (v) => v === null || v === undefined
  ).length;
  const nonNullValues = values.filter((v) => v !== null && v !== undefined);
  const distinctCount = new Set(
    nonNullValues.map((v) => JSON.stringify(v))
  ).size;

  const stats: ColumnStats = {
    columnId,
    dataType,
    totalCount,
    nullCount,
    distinctCount,
  };

  // Check if numeric
  const isNumeric =
    /int|float|double|decimal|numeric|real|money|serial|number/i.test(dataType);

  if (isNumeric && nonNullValues.length > 0) {
    const numbers = nonNullValues
      .map((v) => Number(v))
      .filter((n) => !isNaN(n));

    if (numbers.length > 0) {
      stats.sum = numbers.reduce((a, b) => a + b, 0);
      stats.avg = stats.sum / numbers.length;
      stats.min = Math.min(...numbers);
      stats.max = Math.max(...numbers);

      // Standard deviation
      const mean = stats.avg;
      const squaredDiffs = numbers.map((n) => Math.pow(n - mean, 2));
      stats.stdDev = Math.sqrt(
        squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length
      );
    }
  }

  // Check if string type
  const isString = /char|text|varchar|string/i.test(dataType);

  if (isString && nonNullValues.length > 0) {
    const strings = nonNullValues.map((v) => String(v));
    const lengths = strings.map((s) => s.length);
    stats.minLength = Math.min(...lengths);
    stats.maxLength = Math.max(...lengths);
    stats.avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  }

  // Check if date type
  const isDate = /date|time|timestamp/i.test(dataType);

  if (isDate && nonNullValues.length > 0) {
    const dates = nonNullValues
      .map((v) => {
        const d = new Date(v as string);
        return isNaN(d.getTime()) ? null : d;
      })
      .filter((d): d is Date => d !== null);

    if (dates.length > 0) {
      const sortedDates = dates.sort((a, b) => a.getTime() - b.getTime());
      stats.earliestDate = sortedDates[0].toISOString();
      stats.latestDate = sortedDates[sortedDates.length - 1].toISOString();
      stats.min = stats.earliestDate;
      stats.max = stats.latestDate;
    }
  }

  return stats;
}
