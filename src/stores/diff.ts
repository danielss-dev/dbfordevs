import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ComparisonMode,
  SchemaDiffResult,
  SchemaSnapshot,
} from "@/types";

type MigrationDirection = "source_to_target" | "target_to_source";

interface DiffState {
  // Dialog state
  showSchemaDiffDialog: boolean;

  // Wizard step (0: source selection, 1: diff visualization, 2: migration preview)
  wizardStep: number;

  // Comparison configuration
  comparisonMode: ComparisonMode;
  sourceConnectionId: string | null;
  sourceTableName: string | null;
  targetConnectionId: string | null;
  targetTableName: string | null;
  migrationDirection: MigrationDirection;

  // For snapshot mode
  selectedSnapshotId: string | null;

  // Results
  diffResult: SchemaDiffResult | null;
  isComparing: boolean;
  error: string | null;

  // Snapshots
  snapshots: SchemaSnapshot[];
  isLoadingSnapshots: boolean;

  // Actions
  openSchemaDiffDialog: (connectionId?: string, tableName?: string) => void;
  closeSchemaDiffDialog: () => void;
  setWizardStep: (step: number) => void;
  setComparisonMode: (mode: ComparisonMode) => void;
  setSourceConnection: (connectionId: string, tableName: string) => void;
  setTargetConnection: (connectionId: string, tableName: string) => void;
  setMigrationDirection: (direction: MigrationDirection) => void;
  setSelectedSnapshotId: (snapshotId: string | null) => void;
  setDiffResult: (result: SchemaDiffResult | null) => void;
  setIsComparing: (isComparing: boolean) => void;
  setError: (error: string | null) => void;
  setSnapshots: (snapshots: SchemaSnapshot[]) => void;
  setIsLoadingSnapshots: (isLoading: boolean) => void;
  addSnapshot: (snapshot: SchemaSnapshot) => void;
  removeSnapshot: (snapshotId: string) => void;
  reset: () => void;
}

const initialState = {
  showSchemaDiffDialog: false,
  wizardStep: 0,
  comparisonMode: "connections" as ComparisonMode,
  sourceConnectionId: null,
  sourceTableName: null,
  targetConnectionId: null,
  targetTableName: null,
  migrationDirection: "source_to_target" as MigrationDirection,
  selectedSnapshotId: null,
  diffResult: null,
  isComparing: false,
  error: null,
  snapshots: [],
  isLoadingSnapshots: false,
};

export const useDiffStore = create<DiffState>()(
  persist(
    (set) => ({
      ...initialState,

      openSchemaDiffDialog: (connectionId, tableName) =>
        set({
          showSchemaDiffDialog: true,
          wizardStep: 0,
          sourceConnectionId: connectionId ?? null,
          sourceTableName: tableName ?? null,
          diffResult: null,
          error: null,
        }),

      closeSchemaDiffDialog: () =>
        set({
          showSchemaDiffDialog: false,
          wizardStep: 0,
          diffResult: null,
          error: null,
        }),

      setWizardStep: (step) => set({ wizardStep: step }),

      setComparisonMode: (mode) =>
        set({
          comparisonMode: mode,
          targetConnectionId: null,
          targetTableName: null,
          selectedSnapshotId: null,
          diffResult: null,
          error: null,
        }),

      setSourceConnection: (connectionId, tableName) =>
        set({
          sourceConnectionId: connectionId,
          sourceTableName: tableName,
          diffResult: null,
          error: null,
        }),

      setTargetConnection: (connectionId, tableName) =>
        set({
          targetConnectionId: connectionId,
          targetTableName: tableName,
          diffResult: null,
          error: null,
        }),

      setMigrationDirection: (direction) =>
        set({
          migrationDirection: direction,
          diffResult: null,
        }),

      setSelectedSnapshotId: (snapshotId) =>
        set({
          selectedSnapshotId: snapshotId,
          diffResult: null,
          error: null,
        }),

      setDiffResult: (result) => set({ diffResult: result, error: null }),

      setIsComparing: (isComparing) => set({ isComparing }),

      setError: (error) => set({ error, isComparing: false }),

      setSnapshots: (snapshots) => set({ snapshots }),

      setIsLoadingSnapshots: (isLoading) => set({ isLoadingSnapshots: isLoading }),

      addSnapshot: (snapshot) =>
        set((state) => ({
          snapshots: [...state.snapshots, snapshot],
        })),

      removeSnapshot: (snapshotId) =>
        set((state) => ({
          snapshots: state.snapshots.filter((s) => s.id !== snapshotId),
          selectedSnapshotId:
            state.selectedSnapshotId === snapshotId
              ? null
              : state.selectedSnapshotId,
        })),

      reset: () => set(initialState),
    }),
    {
      name: "diff-storage",
      partialize: (state) => ({
        // Only persist snapshots, not dialog state
        snapshots: state.snapshots,
      }),
    }
  )
);
