import { useMemo, useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Database,
  Table as TableIcon,
  Code,
  ChevronDown,
  Settings2,
  Key,
} from "lucide-react";
import { useDataDiffStore, useConnectionsStore, useQueryStore, useSchemaStore } from "@/stores";
import { useUIStore } from "@/stores/ui";
import { useDatabase } from "@/hooks";
import { SqlEditor } from "@/components/editor";
import { getTableFullName } from "@/lib/table-utils";
import type { DataSourceType, ColumnInfo } from "@/types";

export function DataSourceSelectionStep() {
  const {
    sourceType,
    sourceConnectionId,
    sourceTableName,
    sourceSql,
    targetConnectionId,
    targetTableName,
    targetSql,
    options,
    setSourceType,
    setSourceConnectionId,
    setSourceTableName,
    setSourceSql,
    setTargetConnectionId,
    setTargetTableName,
    setTargetSql,
    setOptions,
  } = useDataDiffStore();

  const { connections } = useConnectionsStore();
  const { tablesByConnection } = useQueryStore();
  const getSchemas = useSchemaStore(state => state.getSchemas);
  const theme = useUIStore(state => state.theme);
  const { getTableSchema } = useDatabase();

  const [sourceColumns, setSourceColumns] = useState<ColumnInfo[]>([]);
  const [optionsOpen, setOptionsOpen] = useState(false);

  const connectedConnections = useMemo(
    () => connections.filter((c) => c.connected),
    [connections]
  );

  const sourceTables = useMemo(() => {
    if (!sourceConnectionId) return [];
    return tablesByConnection[sourceConnectionId] ?? [];
  }, [sourceConnectionId, tablesByConnection]);

  const targetTables = useMemo(() => {
    if (!targetConnectionId) return [];
    return tablesByConnection[targetConnectionId] ?? [];
  }, [targetConnectionId, tablesByConnection]);

  // Schemas for autocomplete in query mode
  const sourceSchemas = useMemo(() => {
    if (!sourceConnectionId) return {};
    return getSchemas(sourceConnectionId);
  }, [sourceConnectionId, getSchemas]);

  const targetSchemas = useMemo(() => {
    if (!targetConnectionId) return {};
    return getSchemas(targetConnectionId);
  }, [targetConnectionId, getSchemas]);

  // Fetch columns for source table (for key column selection)
  useEffect(() => {
    if (sourceType === "table" && sourceConnectionId && sourceTableName) {
      getTableSchema(sourceConnectionId, sourceTableName)
        .then((schema) => {
          if (schema) {
            setSourceColumns(schema.columns);
            // Auto-populate key columns from PK if not already set
            if (options.keyColumns.length === 0) {
              const pkColumns = schema.columns
                .filter((c) => c.isPrimaryKey)
                .map((c) => c.name);
              if (pkColumns.length > 0) {
                setOptions({ keyColumns: pkColumns });
              }
            }
          }
        })
        .catch(() => {
          setSourceColumns([]);
        });
    } else {
      setSourceColumns([]);
    }
  }, [sourceType, sourceConnectionId, sourceTableName]);

  const toggleKeyColumn = (colName: string) => {
    const current = options.keyColumns;
    if (current.includes(colName)) {
      setOptions({ keyColumns: current.filter((c) => c !== colName) });
    } else {
      setOptions({ keyColumns: [...current, colName] });
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Comparison mode */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Comparison Mode</Label>
          <RadioGroup
            value={sourceType}
            onValueChange={(value) => setSourceType(value as DataSourceType)}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <div className="relative">
              <RadioGroupItem
                value="table"
                id="mode-table"
                className="peer sr-only"
              />
              <Label
                htmlFor="mode-table"
                className="flex flex-col items-center gap-2 p-4 border rounded-lg cursor-pointer
                  peer-checked:border-primary peer-checked:bg-primary/5
                  hover:bg-accent transition-colors"
              >
                <TableIcon className="h-6 w-6" />
                <span className="font-medium">Table vs Table</span>
                <span className="text-xs text-muted-foreground text-center">
                  Compare all data between two tables
                </span>
              </Label>
            </div>

            <div className="relative">
              <RadioGroupItem
                value="query"
                id="mode-query"
                className="peer sr-only"
              />
              <Label
                htmlFor="mode-query"
                className="flex flex-col items-center gap-2 p-4 border rounded-lg cursor-pointer
                  peer-checked:border-primary peer-checked:bg-primary/5
                  hover:bg-accent transition-colors"
              >
                <Code className="h-6 w-6" />
                <span className="font-medium">Query vs Query</span>
                <span className="text-xs text-muted-foreground text-center">
                  Compare results of custom SQL queries
                </span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Source and Target selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Source */}
          <div className="space-y-4 p-4 border rounded-lg bg-card">
            <Badge variant="outline" className="bg-info/10 text-info">
              Source
            </Badge>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm">Connection</Label>
                <Select
                  value={sourceConnectionId ?? ""}
                  onValueChange={(value) => setSourceConnectionId(value)}
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

              {sourceType === "table" ? (
                <div className="space-y-2">
                  <Label className="text-sm">Table</Label>
                  <Select
                    value={sourceTableName ?? ""}
                    onValueChange={(value) => setSourceTableName(value)}
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
              ) : (
                <div className="space-y-2">
                  <Label className="text-sm">SQL Query</Label>
                  <div className="border rounded-md overflow-hidden">
                    <SqlEditor
                      value={sourceSql}
                      onChange={(value) => setSourceSql(value)}
                      tables={sourceTables}
                      schemas={sourceSchemas}
                      theme={theme}
                      readOnly={!sourceConnectionId}
                      height={120}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Target */}
          <div className="space-y-4 p-4 border rounded-lg bg-card">
            <Badge variant="outline" className="bg-success/10 text-success">
              Target
            </Badge>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm">Connection</Label>
                <Select
                  value={targetConnectionId ?? ""}
                  onValueChange={(value) => setTargetConnectionId(value)}
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

              {sourceType === "table" ? (
                <div className="space-y-2">
                  <Label className="text-sm">Table</Label>
                  <Select
                    value={targetTableName ?? ""}
                    onValueChange={(value) => setTargetTableName(value)}
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
              ) : (
                <div className="space-y-2">
                  <Label className="text-sm">SQL Query</Label>
                  <div className="border rounded-md overflow-hidden">
                    <SqlEditor
                      value={targetSql}
                      onChange={(value) => setTargetSql(value)}
                      tables={targetTables}
                      schemas={targetSchemas}
                      theme={theme}
                      readOnly={!targetConnectionId}
                      height={120}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Key columns (for table mode when source table is selected) */}
        {sourceType === "table" && sourceColumns.length > 0 && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              <Label className="text-sm font-medium">Key Columns</Label>
              <span className="text-xs text-muted-foreground">
                Used to match rows between source and target
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {sourceColumns.map((col) => (
                <button
                  key={col.name}
                  onClick={() => toggleKeyColumn(col.name)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    options.keyColumns.includes(col.name)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-accent border-input"
                  }`}
                >
                  {col.isPrimaryKey && <Key className="h-3 w-3" />}
                  {col.name}
                </button>
              ))}
            </div>
            {options.keyColumns.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No key columns selected. Primary keys will be auto-detected, or all columns will be used.
              </p>
            )}
          </div>
        )}

        {/* Advanced options */}
        <Collapsible open={optionsOpen} onOpenChange={setOptionsOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-foreground text-muted-foreground transition-colors">
            <Settings2 className="h-4 w-4" />
            Comparison Options
            <ChevronDown className={`h-4 w-4 transition-transform ${optionsOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 p-4 border rounded-lg bg-muted/30 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="ignore-case"
                    checked={options.ignoreCase}
                    onCheckedChange={(checked) =>
                      setOptions({ ignoreCase: checked === true })
                    }
                  />
                  <Label htmlFor="ignore-case" className="text-sm cursor-pointer">
                    Ignore case
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="ignore-whitespace"
                    checked={options.ignoreWhitespace}
                    onCheckedChange={(checked) =>
                      setOptions({ ignoreWhitespace: checked === true })
                    }
                  />
                  <Label htmlFor="ignore-whitespace" className="text-sm cursor-pointer">
                    Ignore whitespace
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="null-equals-empty"
                    checked={options.nullEqualsEmpty}
                    onCheckedChange={(checked) =>
                      setOptions({ nullEqualsEmpty: checked === true })
                    }
                  />
                  <Label htmlFor="null-equals-empty" className="text-sm cursor-pointer">
                    NULL equals empty string
                  </Label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numeric-tolerance" className="text-sm">
                    Numeric tolerance
                  </Label>
                  <Input
                    id="numeric-tolerance"
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="Exact match"
                    value={options.numericTolerance ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOptions({
                        numericTolerance: val ? parseFloat(val) : null,
                      });
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-rows" className="text-sm">
                    Max rows
                  </Label>
                  <Input
                    id="max-rows"
                    type="number"
                    min="100"
                    max="100000"
                    value={options.maxRows}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val > 0) {
                        setOptions({ maxRows: val });
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </ScrollArea>
  );
}
