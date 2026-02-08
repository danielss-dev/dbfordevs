import { useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Download,
  Copy,
  CheckCircle,
  PlusCircle,
  MinusCircle,
  Pencil,
  FileJson,
  FileSpreadsheet,
} from "lucide-react";
import { escapeCSV } from "@/lib/export-utils";
import type { DataCompareResult } from "@/types";

interface Props {
  result: DataCompareResult;
}

type ExportFormat = "csv" | "json";

export function DataDiffExportStep({ result }: Props) {
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [copied, setCopied] = useState(false);

  const exportContent = useMemo(() => {
    if (format === "json") {
      return generateJSON(result);
    }
    return generateCSV(result);
  }, [result, format]);

  const preview = useMemo(() => {
    const lines = exportContent.split("\n");
    if (lines.length > 20) {
      return lines.slice(0, 20).join("\n") + `\n... (${lines.length - 20} more lines)`;
    }
    return exportContent;
  }, [exportContent]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = exportContent;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const mimeType = format === "json" ? "application/json" : "text/csv";
    const ext = format === "json" ? "json" : "csv";
    const filename = `data-comparison-${Date.now()}.${ext}`;
    const blob = new Blob([exportContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Summary card */}
        <div className="p-4 border rounded-lg bg-card space-y-3">
          <h3 className="text-sm font-medium">Comparison Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-lg font-semibold">{result.summary.matchedRows}</p>
                <p className="text-xs text-muted-foreground">Matched</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-lg font-semibold">{result.summary.modifiedRows}</p>
                <p className="text-xs text-muted-foreground">Modified</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4 text-emerald-500" />
              <div>
                <p className="text-lg font-semibold">{result.summary.addedRows}</p>
                <p className="text-xs text-muted-foreground">Added</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MinusCircle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-lg font-semibold">{result.summary.removedRows}</p>
                <p className="text-xs text-muted-foreground">Removed</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
            <span>Source: {result.summary.totalSourceRows} rows</span>
            <span>Target: {result.summary.totalTargetRows} rows</span>
            <span>Time: {result.summary.comparisonTimeMs}ms</span>
            {result.truncated && (
              <Badge variant="outline" className="text-amber-600">Truncated</Badge>
            )}
          </div>
        </div>

        {/* Export format */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Export Format</Label>
          <RadioGroup
            value={format}
            onValueChange={(v) => setFormat(v as ExportFormat)}
            className="grid grid-cols-2 gap-3"
          >
            <div className="relative">
              <RadioGroupItem value="csv" id="fmt-csv" className="peer sr-only" />
              <Label
                htmlFor="fmt-csv"
                className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer
                  peer-checked:border-primary peer-checked:bg-primary/5
                  hover:bg-accent transition-colors"
              >
                <FileSpreadsheet className="h-5 w-5" />
                <div>
                  <span className="font-medium text-sm">CSV</span>
                  <p className="text-xs text-muted-foreground">
                    With diff_status column
                  </p>
                </div>
              </Label>
            </div>
            <div className="relative">
              <RadioGroupItem value="json" id="fmt-json" className="peer sr-only" />
              <Label
                htmlFor="fmt-json"
                className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer
                  peer-checked:border-primary peer-checked:bg-primary/5
                  hover:bg-accent transition-colors"
              >
                <FileJson className="h-5 w-5" />
                <div>
                  <span className="font-medium text-sm">JSON</span>
                  <p className="text-xs text-muted-foreground">
                    Structured diff report
                  </p>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Preview</Label>
          <pre className="p-3 bg-muted rounded-lg text-xs font-mono overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre">
            {preview}
          </pre>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={handleDownload} className="gap-2">
            <Download className="h-4 w-4" />
            Download {format.toUpperCase()}
          </Button>
          <Button variant="outline" onClick={handleCopy} className="gap-2">
            {copied ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy to clipboard
              </>
            )}
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

function generateCSV(result: DataCompareResult): string {
  const headers = ["diff_status", ...result.columns.map((c) => c.name)];
  const lines: string[] = [headers.map(escapeCSV).join(",")];

  for (const row of result.rows) {
    const values: string[] = [row.status];

    if (row.sourceRow && row.status !== "added") {
      for (let i = 0; i < result.columns.length; i++) {
        const val = i < row.sourceRow.length ? row.sourceRow[i] : null;
        values.push(formatCellValue(val));
      }
    } else if (row.targetRow) {
      for (let i = 0; i < result.columns.length; i++) {
        const val = i < row.targetRow.length ? row.targetRow[i] : null;
        values.push(formatCellValue(val));
      }
    }

    lines.push(values.map(escapeCSV).join(","));

    // For modified rows, also output the target row
    if (row.status === "modified" && row.targetRow) {
      const targetValues: string[] = ["modified_target"];
      for (let i = 0; i < result.columns.length; i++) {
        const val = i < row.targetRow.length ? row.targetRow[i] : null;
        targetValues.push(formatCellValue(val));
      }
      lines.push(targetValues.map(escapeCSV).join(","));
    }
  }

  return lines.join("\n");
}

function generateJSON(result: DataCompareResult): string {
  const report = {
    summary: result.summary,
    sourceLabel: result.sourceLabel,
    targetLabel: result.targetLabel,
    keyColumns: result.keyColumns,
    columns: result.columns.map((c) => c.name),
    warnings: result.warnings,
    truncated: result.truncated,
    rows: result.rows.map((row) => ({
      status: row.status,
      keyValues: row.keyValues,
      sourceRow: row.sourceRow
        ? Object.fromEntries(
            result.columns.map((c, i) => [
              c.name,
              row.sourceRow && i < row.sourceRow.length ? row.sourceRow[i] : null,
            ])
          )
        : null,
      targetRow: row.targetRow
        ? Object.fromEntries(
            result.columns.map((c, i) => [
              c.name,
              row.targetRow && i < row.targetRow.length ? row.targetRow[i] : null,
            ])
          )
        : null,
      cellDiffs: row.cellDiffs,
    })),
  };

  return JSON.stringify(report, null, 2);
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
