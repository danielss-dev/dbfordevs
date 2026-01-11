import { useState, useEffect, useCallback, useMemo } from "react";
import { FileCode, Play } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea, AutocompleteInput, type AutocompleteOption } from "@/components/ui";
import { useUIStore } from "@/stores/ui";
import { useBookmarkStore } from "@/stores/bookmarks";
import { useQueryStore, selectActiveTab } from "@/stores/query";
import { useSchemaStore } from "@/stores/schema";
import { useConnectionsStore, selectActiveConnection } from "@/stores/connections";
import { applyTemplateVariables } from "@/lib/bookmark-templates";

interface TemplateVariableDialogProps {
  onApply: (sql: string) => void;
}

// Variable names that should have table autocomplete
const TABLE_VARIABLE_PATTERNS = [
  "table",
  "table_name",
  "table1",
  "table2",
  "target_table",
  "source_table",
  "subquery_table",
];

// Variable names that should have column autocomplete
const COLUMN_VARIABLE_PATTERNS = [
  "column",
  "columns",
  "join_column",
  "order_column",
  "group_column",
  "partition_column",
  "sum_column",
  "avg_column",
  "min_column",
  "max_column",
  "target_columns",
  "source_columns",
  "subquery_column",
  "conflict_column",
  "update_column",
];

// Check if variable name matches a pattern
function matchesPattern(varName: string, patterns: string[]): boolean {
  const lowerName = varName.toLowerCase();
  return patterns.some((pattern) => lowerName === pattern || lowerName.includes(pattern));
}

export function TemplateVariableDialog({ onApply }: TemplateVariableDialogProps) {
  const {
    showTemplateVariableDialog,
    setShowTemplateVariableDialog,
    templateVariableBookmarkId,
    setShowBookmarkManagerDialog,
  } = useUIStore();

  const { getBookmarkById } = useBookmarkStore();
  const activeTab = useQueryStore(selectActiveTab);
  const { tablesByConnection } = useQueryStore();
  const { getSchemas } = useSchemaStore();
  const activeConnection = useConnectionsStore(selectActiveConnection);

  const [values, setValues] = useState<Record<string, string>>({});
  const [previewSql, setPreviewSql] = useState("");

  const bookmark = templateVariableBookmarkId
    ? getBookmarkById(templateVariableBookmarkId)
    : null;

  // Get current connection ID from active tab or active connection
  const connectionId = activeTab?.connectionId || activeConnection?.id || null;

  // Get tables for the current connection
  const tables = useMemo(() => {
    if (!connectionId) return [];
    return tablesByConnection[connectionId] || [];
  }, [connectionId, tablesByConnection]);

  // Get schemas (columns) for all tables
  const schemas = useMemo(() => {
    if (!connectionId) return {};
    return getSchemas(connectionId);
  }, [connectionId, getSchemas]);

  // Build table autocomplete options
  const tableOptions: AutocompleteOption[] = useMemo(() => {
    return tables.map((table) => ({
      value: table.schema ? `${table.schema}.${table.name}` : table.name,
      label: table.name,
      description: table.schema || undefined,
    }));
  }, [tables]);

  // Build column autocomplete options (from all tables)
  const columnOptions: AutocompleteOption[] = useMemo(() => {
    const columns: AutocompleteOption[] = [];
    const seenColumns = new Set<string>();

    // Add columns from schemas
    for (const [, schema] of Object.entries(schemas)) {
      for (const column of schema.columns) {
        // Add both simple column name and table.column format
        if (!seenColumns.has(column.name)) {
          columns.push({
            value: column.name,
            label: column.name,
            description: `${column.dataType}${column.nullable ? "" : " NOT NULL"}`,
          });
          seenColumns.add(column.name);
        }
      }
    }

    // Sort alphabetically
    return columns.sort((a, b) => a.value.localeCompare(b.value));
  }, [schemas]);

  // Build column options for a specific table (used when user has already selected a table)
  const getColumnsForTable = useCallback(
    (tableName: string): AutocompleteOption[] => {
      // Find schema that matches the table name
      const schema = schemas[tableName];
      if (!schema) {
        // Try to find by just the table name part (without schema prefix)
        for (const [key, value] of Object.entries(schemas)) {
          if (key.endsWith(`.${tableName}`) || key === tableName) {
            return value.columns.map((col) => ({
              value: col.name,
              label: col.name,
              description: `${col.dataType}${col.nullable ? "" : " NOT NULL"}`,
            }));
          }
        }
        return columnOptions; // Fallback to all columns
      }
      return schema.columns.map((col) => ({
        value: col.name,
        label: col.name,
        description: `${col.dataType}${col.nullable ? "" : " NOT NULL"}`,
      }));
    },
    [schemas, columnOptions]
  );

  // Determine which autocomplete type to use for a variable
  const getAutocompleteType = useCallback(
    (varName: string): "table" | "column" | "none" => {
      if (matchesPattern(varName, TABLE_VARIABLE_PATTERNS)) {
        return "table";
      }
      if (matchesPattern(varName, COLUMN_VARIABLE_PATTERNS)) {
        return "column";
      }
      return "none";
    },
    []
  );

  // Get autocomplete options for a variable
  const getOptionsForVariable = useCallback(
    (varName: string): AutocompleteOption[] => {
      const type = getAutocompleteType(varName);

      if (type === "table") {
        return tableOptions;
      }

      if (type === "column") {
        // If there's a related table variable, use columns from that table
        // Look for table1 -> columns pattern or table_name -> column pattern
        const relatedTableVars = Object.entries(values).filter(([key]) =>
          matchesPattern(key, TABLE_VARIABLE_PATTERNS)
        );

        // If we have a table variable with a value, use columns from that table
        for (const [, tableValue] of relatedTableVars) {
          if (tableValue && tableValue !== "table_name" && tableValue !== "table1" && tableValue !== "table2") {
            const tableColumns = getColumnsForTable(tableValue);
            if (tableColumns.length > 0) {
              return tableColumns;
            }
          }
        }

        // Otherwise return all columns
        return columnOptions;
      }

      return [];
    },
    [getAutocompleteType, tableOptions, columnOptions, values, getColumnsForTable]
  );

  // Initialize values from bookmark variables
  useEffect(() => {
    if (bookmark?.variables) {
      const initialValues: Record<string, string> = {};
      for (const variable of bookmark.variables) {
        initialValues[variable.name] = variable.defaultValue || "";
      }
      setValues(initialValues);
    } else {
      setValues({});
    }
  }, [bookmark]);

  // Update preview when values change
  useEffect(() => {
    if (bookmark) {
      const sql = applyTemplateVariables(bookmark.sql, values);
      setPreviewSql(sql);
    }
  }, [bookmark, values]);

  const handleValueChange = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleApply = useCallback(() => {
    if (previewSql) {
      onApply(previewSql);
      setShowTemplateVariableDialog(false);
      setShowBookmarkManagerDialog(false); // Also close bookmark manager
    }
  }, [previewSql, onApply, setShowTemplateVariableDialog, setShowBookmarkManagerDialog]);

  const handleClose = useCallback(() => {
    setShowTemplateVariableDialog(false);
    setValues({});
    setPreviewSql("");
  }, [setShowTemplateVariableDialog]);

  if (!bookmark) return null;

  return (
    <Dialog open={showTemplateVariableDialog} onOpenChange={setShowTemplateVariableDialog}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            Fill Template Variables
          </DialogTitle>
          <DialogDescription>
            Enter values for the template variables to generate your SQL query
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 py-4 overflow-y-auto">
          {/* Template name */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Template:</span>
            <span className="font-medium">{bookmark.name}</span>
          </div>

          {/* Variables form */}
          <div className="space-y-4 overflow-visible">
            <Label className="text-sm font-medium">Variables</Label>
            <div className="grid grid-cols-2 gap-4">
              {bookmark.variables?.map((variable) => {
                const autocompleteType = getAutocompleteType(variable.name);
                const options = getOptionsForVariable(variable.name);

                return (
                  <div key={variable.name} className="space-y-1">
                    <Label htmlFor={`var-${variable.name}`} className="text-xs">
                      <code className="text-violet-600 dark:text-violet-400">
                        {variable.placeholder}
                      </code>
                    </Label>
                    {autocompleteType !== "none" && options.length > 0 ? (
                      <AutocompleteInput
                        id={`var-${variable.name}`}
                        value={values[variable.name] || ""}
                        onChange={(value) => handleValueChange(variable.name, value)}
                        options={options}
                        placeholder={variable.defaultValue || variable.name}
                        emptyText={
                          autocompleteType === "table"
                            ? "No tables found"
                            : "No columns found"
                        }
                        multiValue={autocompleteType === "column"}
                      />
                    ) : (
                      <Input
                        id={`var-${variable.name}`}
                        value={values[variable.name] || ""}
                        onChange={(e) => handleValueChange(variable.name, e.target.value)}
                        placeholder={variable.defaultValue || variable.name}
                        className="font-mono text-sm"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preview */}
          <div className="flex-1 min-h-0 space-y-2">
            <Label className="text-sm font-medium">Preview</Label>
            <ScrollArea className="h-[200px] border rounded-md">
              <pre className="text-sm font-mono p-3 whitespace-pre-wrap">
                {previewSql}
              </pre>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleApply} className="gap-2">
            <Play className="h-4 w-4" />
            Use Query
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
