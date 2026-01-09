import { useState, useCallback, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload,
  FileJson,
  FileText,
  Database,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Wand2,
  X,
  File,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useImport } from "@/hooks/useImport";
import { useDatabase } from "@/hooks/useDatabase";
import {
  detectFormat,
  autoMapColumns,
  validateMappings,
  formatFileSize,
} from "@/lib/import-utils";
import { showSuccessToast, showErrorToast } from "@/lib/toast-helpers";
import type {
  ImportFormat,
  DuplicateHandling,
  ColumnMapping,
  ImportPreviewResult,
  ImportResult,
} from "@/types/import";
import type { TableSchema } from "@/types";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  tableName: string;
  onImportComplete?: () => void;
}

type ImportStep = "upload" | "mapping" | "options" | "progress" | "complete";

export function ImportDialog({
  open: isOpen,
  onOpenChange,
  connectionId,
  tableName,
  onImportComplete,
}: ImportDialogProps) {
  const {
    previewImport,
    executeImport,
    cancelImport,
    isLoading,
    progress,
    error,
    clearError,
    resetProgress,
  } = useImport();
  const { getTableSchema } = useDatabase();

  // State
  const [step, setStep] = useState<ImportStep>("upload");
  const [fileContent, setFileContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<number>(0);
  const [format, setFormat] = useState<ImportFormat>("csv");
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [tableSchema, setTableSchema] = useState<TableSchema | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [mappingErrors, setMappingErrors] = useState<string[]>([]);

  // CSV Options
  const [hasHeader, setHasHeader] = useState(true);
  const [delimiter, setDelimiter] = useState<string>(",");

  // Import Options
  const [duplicateHandling, setDuplicateHandling] =
    useState<DuplicateHandling>("fail");
  const [useTransaction, setUseTransaction] = useState(true);
  const [stopOnError, setStopOnError] = useState(true);
  const [batchSize, setBatchSize] = useState(1000);

  // Result
  const [result, setResult] = useState<ImportResult | null>(null);

  // Load table schema when dialog opens
  useEffect(() => {
    if (isOpen && connectionId && tableName) {
      getTableSchema(connectionId, tableName).then(setTableSchema);
    }
  }, [isOpen, connectionId, tableName, getTableSchema]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setStep("upload");
      setFileContent("");
      setFileName("");
      setFileSize(0);
      setPreview(null);
      setColumnMappings([]);
      setMappingErrors([]);
      setResult(null);
      clearError();
      resetProgress();
    }
  }, [isOpen, clearError, resetProgress]);

  // Handle file selection
  const handleFileSelect = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: "Data Files", extensions: ["csv", "json", "sql", "tsv"] },
          { name: "CSV", extensions: ["csv", "tsv"] },
          { name: "JSON", extensions: ["json"] },
          { name: "SQL", extensions: ["sql"] },
        ],
      });

      if (selected && typeof selected === "string") {
        const content = await readTextFile(selected);
        const detectedFormat = detectFormat(selected);

        setFileName(selected.split(/[/\\]/).pop() || "");
        setFileContent(content);
        setFileSize(new Blob([content]).size);
        setFormat(detectedFormat || "csv");

        // Auto-detect delimiter for CSV
        if (detectedFormat === "csv") {
          const firstLine = content.split("\n")[0] || "";
          if (firstLine.includes("\t")) setDelimiter("\t");
          else if (firstLine.includes(";")) setDelimiter(";");
          else if (firstLine.includes("|")) setDelimiter("|");
          else setDelimiter(",");
        }
      }
    } catch (err) {
      console.error("File selection error:", err);
      showErrorToast("Failed to read file");
    }
  }, []);

  // Preview file content
  const handlePreview = useCallback(async () => {
    if (!fileContent) return;

    // For SQL, skip directly to options
    if (format === "sql") {
      setStep("options");
      return;
    }

    const previewResult = await previewImport({
      connectionId,
      format,
      content: fileContent,
      delimiter: format === "csv" ? delimiter : undefined,
      hasHeader: format === "csv" ? hasHeader : undefined,
      previewRows: 100,
    });

    if (previewResult) {
      setPreview(previewResult);

      // Auto-map columns
      if (tableSchema) {
        const mappings = autoMapColumns(
          previewResult.sourceColumns,
          tableSchema.columns
        );
        setColumnMappings(mappings);
      }

      setStep("mapping");
    }
  }, [
    connectionId,
    fileContent,
    format,
    delimiter,
    hasHeader,
    tableSchema,
    previewImport,
  ]);

  // Update a single column mapping
  const updateMapping = useCallback(
    (sourceColumn: string, targetColumn: string) => {
      setColumnMappings((prev) =>
        prev.map((m) =>
          m.sourceColumn === sourceColumn
            ? {
                ...m,
                targetColumn,
                dataType: tableSchema?.columns.find(
                  (c) => c.name === targetColumn
                )?.dataType,
              }
            : m
        )
      );
    },
    [tableSchema]
  );

  // Auto-map all columns
  const handleAutoMap = useCallback(() => {
    if (!tableSchema || !preview) return;
    const mappings = autoMapColumns(preview.sourceColumns, tableSchema.columns);
    setColumnMappings(mappings);
  }, [preview, tableSchema]);

  // Clear a mapping
  const clearMapping = useCallback((sourceColumn: string) => {
    setColumnMappings((prev) =>
      prev.map((m) =>
        m.sourceColumn === sourceColumn
          ? { ...m, targetColumn: "", dataType: undefined }
          : m
      )
    );
  }, []);

  // Validate mappings and proceed
  const handleMappingComplete = useCallback(() => {
    if (!tableSchema) return;

    const validation = validateMappings(columnMappings, tableSchema.columns);
    if (!validation.valid) {
      setMappingErrors(validation.errors);
      return;
    }

    setMappingErrors([]);
    setStep("options");
  }, [columnMappings, tableSchema]);

  // Execute import
  const handleExecute = useCallback(async () => {
    setStep("progress");

    const importResult = await executeImport({
      connectionId,
      tableName,
      format,
      content: fileContent,
      columnMappings: columnMappings.filter((m) => m.targetColumn),
      duplicateHandling,
      batchSize,
      delimiter: format === "csv" ? delimiter : undefined,
      hasHeader: format === "csv" ? hasHeader : undefined,
      useTransaction,
      stopOnError,
    });

    if (importResult) {
      setResult(importResult);
      setStep("complete");

      if (importResult.success) {
        showSuccessToast(importResult.message);
        onImportComplete?.();
      } else {
        showErrorToast(importResult.message);
      }
    }
  }, [
    connectionId,
    tableName,
    format,
    fileContent,
    columnMappings,
    duplicateHandling,
    batchSize,
    delimiter,
    hasHeader,
    useTransaction,
    stopOnError,
    executeImport,
    onImportComplete,
  ]);

  // Cancel import
  const handleCancel = useCallback(async () => {
    if (progress?.importId) {
      await cancelImport(progress.importId);
    }
    onOpenChange(false);
  }, [progress, cancelImport, onOpenChange]);

  // Get mapped target columns for available options
  const mappedTargets = new Set(
    columnMappings.map((m) => m.targetColumn).filter(Boolean)
  );
  const availableTargets =
    tableSchema?.columns.filter((c) => !mappedTargets.has(c.name)) || [];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Data to {tableName}
          </DialogTitle>
          <DialogDescription>
            Import data from CSV, JSON, or SQL files into your table.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-2 py-2 border-b text-xs">
          {(["upload", "mapping", "options", "progress", "complete"] as const).map(
            (s, i) => (
              <div key={s} className="flex items-center">
                {i > 0 && <div className="w-6 h-px bg-border mx-1" />}
                <div
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md",
                    step === s
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[10px] font-medium">
                    {i + 1}
                  </span>
                  <span className="capitalize">{s}</span>
                </div>
              </div>
            )
          )}
        </div>

        {/* Content based on step */}
        <div className="flex-1 overflow-auto p-4 min-h-[300px]">
          {/* UPLOAD STEP */}
          {step === "upload" && (
            <div className="space-y-6">
              {/* File selection */}
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                {fileName ? (
                  <div className="space-y-2">
                    <File className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="font-medium">{fileName}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(fileSize)} - {format.toUpperCase()}
                    </p>
                    <Button variant="outline" size="sm" onClick={handleFileSelect}>
                      Choose Different File
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Drag and drop or click to select a file
                    </p>
                    <Button onClick={handleFileSelect}>Select File</Button>
                  </div>
                )}
              </div>

              {/* Format and options */}
              {fileName && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Format</Label>
                    <Select
                      value={format}
                      onValueChange={(v) => setFormat(v as ImportFormat)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            CSV
                          </div>
                        </SelectItem>
                        <SelectItem value="json">
                          <div className="flex items-center gap-2">
                            <FileJson className="h-4 w-4" />
                            JSON
                          </div>
                        </SelectItem>
                        <SelectItem value="sql">
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            SQL
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {format === "csv" && (
                    <>
                      <div className="space-y-2">
                        <Label>Delimiter</Label>
                        <Select value={delimiter} onValueChange={setDelimiter}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value=",">Comma (,)</SelectItem>
                            <SelectItem value=";">Semicolon (;)</SelectItem>
                            <SelectItem value="\t">Tab</SelectItem>
                            <SelectItem value="|">Pipe (|)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center space-x-2 sm:col-span-2">
                        <Checkbox
                          id="hasHeader"
                          checked={hasHeader}
                          onCheckedChange={(c) => setHasHeader(c === true)}
                        />
                        <Label htmlFor="hasHeader" className="cursor-pointer">
                          First row contains column headers
                        </Label>
                      </div>
                    </>
                  )}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* MAPPING STEP */}
          {step === "mapping" && preview && tableSchema && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium">
                  Map source columns to target columns
                </h3>
                <Button variant="outline" size="sm" onClick={handleAutoMap}>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Auto Map
                </Button>
              </div>

              {mappingErrors.length > 0 && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <ul className="list-disc list-inside space-y-1">
                    {mappingErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <ScrollArea className="h-[280px] border rounded-lg">
                <table className="w-full">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                        Source Column
                      </th>
                      <th className="px-4 py-2 w-10"></th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                        Target Column
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                        Type
                      </th>
                      <th className="px-4 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {columnMappings.map((mapping) => {
                      const targetColumn = tableSchema.columns.find(
                        (c) => c.name === mapping.targetColumn
                      );

                      return (
                        <tr
                          key={mapping.sourceColumn}
                          className="hover:bg-muted/30"
                        >
                          <td className="px-4 py-2 text-sm font-mono">
                            {mapping.sourceColumn}
                          </td>
                          <td className="px-4 py-2">
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </td>
                          <td className="px-4 py-2">
                            <Select
                              value={mapping.targetColumn || "__skip__"}
                              onValueChange={(v) =>
                                updateMapping(
                                  mapping.sourceColumn,
                                  v === "__skip__" ? "" : v
                                )
                              }
                            >
                              <SelectTrigger className="w-[180px] h-8">
                                <SelectValue placeholder="Skip" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__skip__">
                                  -- Skip --
                                </SelectItem>
                                {mapping.targetColumn && (
                                  <SelectItem value={mapping.targetColumn}>
                                    {mapping.targetColumn}
                                  </SelectItem>
                                )}
                                {availableTargets.map((col) => (
                                  <SelectItem key={col.name} value={col.name}>
                                    {col.name}
                                    {!col.nullable && (
                                      <span className="text-destructive ml-1">
                                        *
                                      </span>
                                    )}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-2 text-sm text-muted-foreground font-mono">
                            {targetColumn?.dataType || "-"}
                          </td>
                          <td className="px-4 py-2">
                            {mapping.targetColumn && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => clearMapping(mapping.sourceColumn)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollArea>

              <p className="text-xs text-muted-foreground">
                <span className="text-destructive">*</span> = Required column
                (cannot be null)
              </p>

              {/* Preview sample data */}
              {preview.sampleRows.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">
                    Preview ({preview.sampleRows.length} rows)
                  </h4>
                  <ScrollArea className="h-[120px] border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          {preview.sourceColumns.map((col) => (
                            <th
                              key={col}
                              className="px-2 py-1 text-left font-medium text-muted-foreground whitespace-nowrap"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {preview.sampleRows.slice(0, 5).map((row, i) => (
                          <tr key={i} className="hover:bg-muted/30">
                            {row.map((cell, j) => (
                              <td
                                key={j}
                                className="px-2 py-1 whitespace-nowrap max-w-[150px] truncate"
                              >
                                {cell === null ? (
                                  <span className="text-muted-foreground italic">
                                    null
                                  </span>
                                ) : (
                                  String(cell)
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          {/* OPTIONS STEP */}
          {step === "options" && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Duplicate Handling</Label>
                  <Select
                    value={duplicateHandling}
                    onValueChange={(v) =>
                      setDuplicateHandling(v as DuplicateHandling)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fail">
                        Fail on duplicate (recommended)
                      </SelectItem>
                      <SelectItem value="skip">Skip duplicate rows</SelectItem>
                      <SelectItem value="replace">
                        Replace duplicate rows
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    How to handle rows that conflict with existing data
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Batch Size</Label>
                  <Select
                    value={String(batchSize)}
                    onValueChange={(v) => setBatchSize(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100">100 rows</SelectItem>
                      <SelectItem value="500">500 rows</SelectItem>
                      <SelectItem value="1000">1000 rows</SelectItem>
                      <SelectItem value="5000">5000 rows</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Rows inserted per batch
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="useTransaction"
                    checked={useTransaction}
                    onCheckedChange={(c) => setUseTransaction(c === true)}
                  />
                  <Label htmlFor="useTransaction" className="cursor-pointer">
                    Use transaction (rollback all on error)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="stopOnError"
                    checked={stopOnError}
                    onCheckedChange={(c) => setStopOnError(c === true)}
                  />
                  <Label htmlFor="stopOnError" className="cursor-pointer">
                    Stop on first error
                  </Label>
                </div>
              </div>

              {/* Summary */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <h4 className="font-medium">Import Summary</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    File: <span className="text-foreground">{fileName}</span>
                  </p>
                  <p>
                    Format:{" "}
                    <span className="text-foreground">
                      {format.toUpperCase()}
                    </span>
                  </p>
                  {format !== "sql" && preview && (
                    <p>
                      Columns mapped:{" "}
                      <span className="text-foreground">
                        {columnMappings.filter((m) => m.targetColumn).length} of{" "}
                        {columnMappings.length}
                      </span>
                    </p>
                  )}
                  <p>
                    Target table:{" "}
                    <span className="text-foreground">{tableName}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* PROGRESS STEP */}
          {step === "progress" && (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
                <p className="font-medium">
                  {progress?.status === "preparing"
                    ? "Preparing import..."
                    : progress?.status === "processing"
                    ? "Importing data..."
                    : progress?.status === "committing"
                    ? "Committing changes..."
                    : "Processing..."}
                </p>
              </div>

              {progress && (
                <div className="space-y-4">
                  {/* Progress bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>
                        {progress.percentComplete?.toFixed(0) || 0}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{
                          width: `${progress.percentComplete || 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold text-primary">
                        {progress.rowsInserted}
                      </p>
                      <p className="text-xs text-muted-foreground">Inserted</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold text-blue-500">
                        {progress.rowsUpdated}
                      </p>
                      <p className="text-xs text-muted-foreground">Updated</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold text-yellow-500">
                        {progress.rowsSkipped}
                      </p>
                      <p className="text-xs text-muted-foreground">Skipped</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold text-destructive">
                        {progress.rowsFailed}
                      </p>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground text-center">
                    Batch {progress.currentBatch} of {progress.totalBatches || "?"}
                  </p>

                  {progress.currentError && (
                    <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                      {progress.currentError}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* COMPLETE STEP */}
          {step === "complete" && result && (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                {result.success ? (
                  <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
                ) : (
                  <XCircle className="h-16 w-16 mx-auto text-destructive" />
                )}
                <div>
                  <h3 className="text-lg font-medium">
                    {result.success ? "Import Complete" : "Import Failed"}
                  </h3>
                  <p className="text-muted-foreground">{result.message}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-primary">
                    {result.rowsInserted}
                  </p>
                  <p className="text-xs text-muted-foreground">Inserted</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-blue-500">
                    {result.rowsUpdated}
                  </p>
                  <p className="text-xs text-muted-foreground">Updated</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-yellow-500">
                    {result.rowsSkipped}
                  </p>
                  <p className="text-xs text-muted-foreground">Skipped</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-destructive">
                    {result.rowsFailed}
                  </p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground text-center">
                Completed in {(result.executionTimeMs / 1000).toFixed(2)}s
              </p>

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Errors ({result.errors.length})
                  </h4>
                  <ScrollArea className="h-[120px] border rounded-lg">
                    <div className="p-2 space-y-1">
                      {result.errors.slice(0, 50).map((err, i) => (
                        <div
                          key={i}
                          className="text-xs p-2 rounded bg-destructive/10"
                        >
                          <span className="font-medium">Row {err.rowNumber}:</span>{" "}
                          {err.errorMessage}
                        </div>
                      ))}
                      {result.errors.length > 50 && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          ... and {result.errors.length - 50} more errors
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with navigation */}
        <DialogFooter className="border-t pt-4">
          {step !== "complete" && step !== "progress" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}

          {step === "upload" && fileContent && (
            <Button onClick={handlePreview} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : format === "sql" ? (
                "Next: Options"
              ) : (
                "Next: Map Columns"
              )}
            </Button>
          )}

          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button onClick={handleMappingComplete}>Next: Options</Button>
            </>
          )}

          {step === "options" && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep(format === "sql" ? "upload" : "mapping")}
              >
                Back
              </Button>
              <Button onClick={handleExecute} disabled={isLoading}>
                Start Import
              </Button>
            </>
          )}

          {step === "progress" && (
            <Button variant="destructive" onClick={handleCancel}>
              Cancel Import
            </Button>
          )}

          {step === "complete" && (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
