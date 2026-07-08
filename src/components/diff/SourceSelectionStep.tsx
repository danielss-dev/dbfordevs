import { useMemo, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Database,
  Table as TableIcon,
  ArrowRight,
  Layers,
  Camera,
  Trash2,
  Loader2,
} from "lucide-react";
import { useDiffStore, useConnectionsStore, useQueryStore } from "@/stores";
import { useDatabase } from "@/hooks";
import { getTableFullName } from "@/lib/table-utils";
import type { ComparisonMode } from "@/types";

export function SourceSelectionStep() {
  const {
    comparisonMode,
    sourceConnectionId,
    sourceTableName,
    targetConnectionId,
    targetTableName,
    selectedSnapshotId,
    migrationDirection,
    snapshots,
    isLoadingSnapshots,
    setComparisonMode,
    setSourceConnection,
    setTargetConnection,
    setSelectedSnapshotId,
    setMigrationDirection,
    removeSnapshot,
  } = useDiffStore();

  const { connections } = useConnectionsStore();
  const { tablesByConnection } = useQueryStore();
  const { deleteSchemaSnapshot } = useDatabase();

  // Get connected connections
  const connectedConnections = useMemo(
    () => connections.filter((c) => c.connected),
    [connections]
  );

  // Get tables for source connection
  const sourceTables = useMemo(() => {
    if (!sourceConnectionId) return [];
    return tablesByConnection[sourceConnectionId] ?? [];
  }, [sourceConnectionId, tablesByConnection]);

  // Get tables for target connection
  const targetTables = useMemo(() => {
    if (!targetConnectionId) return [];
    return tablesByConnection[targetConnectionId] ?? [];
  }, [targetConnectionId, tablesByConnection]);

  // Filter snapshots for current source table
  const filteredSnapshots = useMemo(() => {
    if (!sourceTableName) return snapshots;
    return snapshots.filter(
      (s) =>
        s.tableName === sourceTableName ||
        s.tableName === sourceTableName.split(".").pop()
    );
  }, [snapshots, sourceTableName]);

  // Handle snapshot deletion
  const handleDeleteSnapshot = async (snapshotId: string) => {
    try {
      await deleteSchemaSnapshot(snapshotId);
      removeSnapshot(snapshotId);
    } catch (err) {
      console.error("Failed to delete snapshot:", err);
    }
  };

  // Auto-set target connection to source when mode is schemas
  useEffect(() => {
    if (comparisonMode === "schemas" && sourceConnectionId && targetConnectionId !== sourceConnectionId) {
      setTargetConnection(sourceConnectionId, "");
    }
  }, [comparisonMode, sourceConnectionId, targetConnectionId, setTargetConnection]);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Comparison mode selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Comparison Mode</Label>
          <RadioGroup
            value={comparisonMode}
            onValueChange={(value) => setComparisonMode(value as ComparisonMode)}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <div className="relative">
              <RadioGroupItem
                value="connections"
                id="mode-connections"
                className="peer sr-only"
              />
              <Label
                htmlFor="mode-connections"
                className="flex flex-col items-center gap-2 p-4 border rounded-lg cursor-pointer
                  peer-checked:border-primary peer-checked:bg-primary/5
                  hover:bg-accent transition-colors"
              >
                <Database className="h-6 w-6" />
                <span className="font-medium">Two Connections</span>
                <span className="text-xs text-muted-foreground text-center">
                  Compare tables across databases
                </span>
              </Label>
            </div>

            <div className="relative">
              <RadioGroupItem
                value="schemas"
                id="mode-schemas"
                className="peer sr-only"
              />
              <Label
                htmlFor="mode-schemas"
                className="flex flex-col items-center gap-2 p-4 border rounded-lg cursor-pointer
                  peer-checked:border-primary peer-checked:bg-primary/5
                  hover:bg-accent transition-colors"
              >
                <Layers className="h-6 w-6" />
                <span className="font-medium">Two Tables</span>
                <span className="text-xs text-muted-foreground text-center">
                  Compare tables in same database
                </span>
              </Label>
            </div>

            <div className="relative">
              <RadioGroupItem
                value="snapshot"
                id="mode-snapshot"
                className="peer sr-only"
              />
              <Label
                htmlFor="mode-snapshot"
                className="flex flex-col items-center gap-2 p-4 border rounded-lg cursor-pointer
                  peer-checked:border-primary peer-checked:bg-primary/5
                  hover:bg-accent transition-colors"
              >
                <Camera className="h-6 w-6" />
                <span className="font-medium">Vs Snapshot</span>
                <span className="text-xs text-muted-foreground text-center">
                  Compare with saved snapshot
                </span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Source selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Source side */}
          <div className="space-y-4 p-4 border rounded-lg bg-card">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-info/10 text-info">
                Source
              </Badge>
              {comparisonMode !== "snapshot" && (
                <span className="text-xs text-muted-foreground">Current state</span>
              )}
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm">Connection</Label>
                <Select
                  value={sourceConnectionId ?? ""}
                  onValueChange={(value) => setSourceConnection(value, "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select connection" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedConnections.map((conn) => (
                      <SelectItem key={conn.id} value={conn.id}>
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          {conn.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Table</Label>
                <Select
                  value={sourceTableName ?? ""}
                  onValueChange={(value) => setSourceConnection(sourceConnectionId ?? "", value)}
                  disabled={!sourceConnectionId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select table" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceTables.map((table) => {
                      const fullName = getTableFullName(table);
                      return (
                        <SelectItem key={fullName} value={fullName}>
                          <div className="flex items-center gap-2">
                            <TableIcon className="h-4 w-4" />
                            {fullName}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="hidden md:flex items-center justify-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
          </div>

          {/* Target side */}
          <div className="space-y-4 p-4 border rounded-lg bg-card">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-success/10 text-success">
                Target
              </Badge>
              {comparisonMode !== "snapshot" && (
                <span className="text-xs text-muted-foreground">Desired state</span>
              )}
            </div>

            {comparisonMode === "snapshot" ? (
              <div className="space-y-3">
                <Label className="text-sm">Saved Snapshot</Label>
                {isLoadingSnapshots ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Loading snapshots...
                  </div>
                ) : filteredSnapshots.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Camera className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No snapshots available</p>
                    <p className="text-xs mt-1">
                      Save a snapshot from the table context menu
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredSnapshots.map((snapshot) => (
                      <div
                        key={snapshot.id}
                        className={`flex items-center justify-between p-3 border rounded-md cursor-pointer
                          hover:bg-accent transition-colors
                          ${selectedSnapshotId === snapshot.id ? "border-primary bg-primary/5" : ""}`}
                        onClick={() => setSelectedSnapshotId(snapshot.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{snapshot.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {snapshot.tableName} &middot;{" "}
                            {new Date(snapshot.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSnapshot(snapshot.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm">Connection</Label>
                  <Select
                    value={targetConnectionId ?? ""}
                    onValueChange={(value) => setTargetConnection(value, "")}
                    disabled={comparisonMode === "schemas"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select connection" />
                    </SelectTrigger>
                    <SelectContent>
                      {connectedConnections.map((conn) => (
                        <SelectItem key={conn.id} value={conn.id}>
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            {conn.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Table</Label>
                  <Select
                    value={targetTableName ?? ""}
                    onValueChange={(value) =>
                      setTargetConnection(targetConnectionId ?? "", value)
                    }
                    disabled={!targetConnectionId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select table" />
                    </SelectTrigger>
                    <SelectContent>
                      {targetTables.map((table) => {
                        const fullName = getTableFullName(table);
                        return (
                          <SelectItem key={fullName} value={fullName}>
                            <div className="flex items-center gap-2">
                              <TableIcon className="h-4 w-4" />
                              {fullName}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Migration direction (only for non-snapshot comparisons) */}
        {comparisonMode !== "snapshot" && sourceTableName && targetTableName && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <Label className="text-sm font-medium">Migration Direction</Label>
            <RadioGroup
              value={migrationDirection}
              onValueChange={(value) =>
                setMigrationDirection(value as "source_to_target" | "target_to_source")
              }
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="source_to_target" id="dir-s2t" />
                <Label htmlFor="dir-s2t" className="cursor-pointer text-sm">
                  Make <span className="font-medium text-success">target</span> match{" "}
                  <span className="font-medium text-info">source</span>
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="target_to_source" id="dir-t2s" />
                <Label htmlFor="dir-t2s" className="cursor-pointer text-sm">
                  Make <span className="font-medium text-info">source</span> match{" "}
                  <span className="font-medium text-success">target</span>
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
