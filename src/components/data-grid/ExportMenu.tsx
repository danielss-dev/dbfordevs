import { Download, FileJson, FileText, Database } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { useCRUDStore } from "@/stores";
import { rowsToInsertSQL, rowsToJSON, rowsToCSV, downloadFile } from "@/lib/export-utils";
import { copyToClipboard } from "@/lib/utils";
import { showSuccessToast, showErrorToast } from "@/lib/toast-helpers";

interface ExportMenuProps {
  tableName?: string;
}

export function ExportMenu({ tableName }: ExportMenuProps) {
  const { selectedRows } = useCRUDStore();

  const handleCopyAsInsert = async () => {
    if (selectedRows.length === 0) return;

    const sql = rowsToInsertSQL(selectedRows, tableName || "table");
    const success = await copyToClipboard(sql);

    if (success) {
      showSuccessToast(`Copied ${selectedRows.length} row(s) as INSERT statements`);
    } else {
      showErrorToast("Failed to copy to clipboard");
    }
  };

  const handleCopyAsJSON = async () => {
    if (selectedRows.length === 0) return;

    const json = rowsToJSON(selectedRows);
    const success = await copyToClipboard(json);

    if (success) {
      showSuccessToast(`Copied ${selectedRows.length} row(s) as JSON`);
    } else {
      showErrorToast("Failed to copy to clipboard");
    }
  };

  const handleCopyAsCSV = async () => {
    if (selectedRows.length === 0) return;

    const csv = rowsToCSV(selectedRows);
    const success = await copyToClipboard(csv);

    if (success) {
      showSuccessToast(`Copied ${selectedRows.length} row(s) as CSV`);
    } else {
      showErrorToast("Failed to copy to clipboard");
    }
  };

  const handleDownloadJSON = () => {
    if (selectedRows.length === 0) return;

    const json = rowsToJSON(selectedRows);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${tableName || "export"}_${timestamp}.json`;

    downloadFile(json, filename, "application/json");
    showSuccessToast(`Downloaded ${selectedRows.length} row(s) as ${filename}`);
  };

  const handleDownloadCSV = () => {
    if (selectedRows.length === 0) return;

    const csv = rowsToCSV(selectedRows);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${tableName || "export"}_${timestamp}.csv`;

    downloadFile(csv, filename, "text/csv");
    showSuccessToast(`Downloaded ${selectedRows.length} row(s) as ${filename}`);
  };

  const disabled = selectedRows.length === 0;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              className="gap-2"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {disabled ? "Select rows to export" : `Export ${selectedRows.length} selected row(s)`}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={handleCopyAsInsert} disabled={disabled}>
          <Database className="mr-2 h-4 w-4" />
          Copy as INSERT
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyAsJSON} disabled={disabled}>
          <FileJson className="mr-2 h-4 w-4" />
          Copy as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyAsCSV} disabled={disabled}>
          <FileText className="mr-2 h-4 w-4" />
          Copy as CSV
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleDownloadJSON} disabled={disabled}>
          <FileJson className="mr-2 h-4 w-4" />
          Download as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadCSV} disabled={disabled}>
          <FileText className="mr-2 h-4 w-4" />
          Download as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
