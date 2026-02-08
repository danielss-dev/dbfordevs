import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  DataCompareOptions,
  DataCompareResult,
  DataSourceType,
  DiffFilterMode,
} from "@/types/data-diff";

interface DataDiffState {
  // Dialog state
  showDataCompareDialog: boolean;

  // Wizard step (0: source selection, 1: comparison results, 2: export)
  wizardStep: number;

  // Source configuration
  sourceType: DataSourceType;
  sourceConnectionId: string | null;
  sourceTableName: string | null;
  sourceSql: string;

  // Target configuration
  targetType: DataSourceType;
  targetConnectionId: string | null;
  targetTableName: string | null;
  targetSql: string;

  // Options
  options: DataCompareOptions;

  // Results
  compareResult: DataCompareResult | null;
  isComparing: boolean;
  error: string | null;

  // Filter
  filterMode: DiffFilterMode;

  // Actions
  openDataCompareDialog: (connectionId?: string, tableName?: string) => void;
  closeDataCompareDialog: () => void;
  setWizardStep: (step: number) => void;
  setSourceType: (type: DataSourceType) => void;
  setSourceConnectionId: (id: string | null) => void;
  setSourceTableName: (name: string | null) => void;
  setSourceSql: (sql: string) => void;
  setTargetType: (type: DataSourceType) => void;
  setTargetConnectionId: (id: string | null) => void;
  setTargetTableName: (name: string | null) => void;
  setTargetSql: (sql: string) => void;
  setOptions: (options: Partial<DataCompareOptions>) => void;
  setCompareResult: (result: DataCompareResult | null) => void;
  setIsComparing: (isComparing: boolean) => void;
  setError: (error: string | null) => void;
  setFilterMode: (mode: DiffFilterMode) => void;
  reset: () => void;
}

const defaultOptions: DataCompareOptions = {
  keyColumns: [],
  ignoreCase: false,
  ignoreWhitespace: true,
  numericTolerance: null,
  nullEqualsEmpty: false,
  maxRows: 10000,
};

const initialState = {
  showDataCompareDialog: false,
  wizardStep: 0,
  sourceType: "table" as DataSourceType,
  sourceConnectionId: null as string | null,
  sourceTableName: null as string | null,
  sourceSql: "",
  targetType: "table" as DataSourceType,
  targetConnectionId: null as string | null,
  targetTableName: null as string | null,
  targetSql: "",
  options: defaultOptions,
  compareResult: null as DataCompareResult | null,
  isComparing: false,
  error: null as string | null,
  filterMode: "all" as DiffFilterMode,
};

export const useDataDiffStore = create<DataDiffState>()(
  persist(
    (set) => ({
      ...initialState,

      openDataCompareDialog: (connectionId, tableName) =>
        set({
          showDataCompareDialog: true,
          wizardStep: 0,
          sourceConnectionId: connectionId ?? null,
          sourceTableName: tableName ?? null,
          compareResult: null,
          error: null,
        }),

      closeDataCompareDialog: () =>
        set({
          showDataCompareDialog: false,
          wizardStep: 0,
          compareResult: null,
          error: null,
        }),

      setWizardStep: (step) => set({ wizardStep: step }),

      setSourceType: (type) =>
        set({
          sourceType: type,
          sourceTableName: null,
          sourceSql: "",
          compareResult: null,
          error: null,
        }),

      setSourceConnectionId: (id) =>
        set({
          sourceConnectionId: id,
          sourceTableName: null,
          compareResult: null,
          error: null,
        }),

      setSourceTableName: (name) =>
        set({
          sourceTableName: name,
          compareResult: null,
          error: null,
        }),

      setSourceSql: (sql) => set({ sourceSql: sql }),

      setTargetType: (type) =>
        set({
          targetType: type,
          targetTableName: null,
          targetSql: "",
          compareResult: null,
          error: null,
        }),

      setTargetConnectionId: (id) =>
        set({
          targetConnectionId: id,
          targetTableName: null,
          compareResult: null,
          error: null,
        }),

      setTargetTableName: (name) =>
        set({
          targetTableName: name,
          compareResult: null,
          error: null,
        }),

      setTargetSql: (sql) => set({ targetSql: sql }),

      setOptions: (opts) =>
        set((state) => ({
          options: { ...state.options, ...opts },
        })),

      setCompareResult: (result) => set({ compareResult: result, error: null }),

      setIsComparing: (isComparing) => set({ isComparing }),

      setError: (error) => set({ error, isComparing: false }),

      setFilterMode: (mode) => set({ filterMode: mode }),

      reset: () => set(initialState),
    }),
    {
      name: "data-diff-storage",
      partialize: (state) => ({
        // Only persist user preferences (options)
        options: state.options,
      }),
    }
  )
);
