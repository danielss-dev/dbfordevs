import { DownloadSimple, FileJs, FileText, Database } from "@phosphor-icons/react";
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
import { rowsToInsertSQL, rowsToJSON, rowsToCSV, saveFile } from "@/lib/export-utils";
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

  const handleDownloadJSON = async () => {
    if (selectedRows.length === 0) return;

    const json = rowsToJSON(selectedRows);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${tableName || "export"}_${timestamp}.json`;

    const saved = await saveFile(json, filename, [
      { name: "JSON", extensions: ["json"] },
    ]);

    if (saved) {
      showSuccessToast(`Saved ${selectedRows.length} row(s) as JSON`);
    }
  };

  const handleDownloadCSV = async () => {
    if (selectedRows.length === 0) return;

    const csv = rowsToCSV(selectedRows);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${tableName || "export"}_${timestamp}.csv`;

    const saved = await saveFile(csv, filename, [
      { name: "CSV", extensions: ["csv"] },
    ]);

    if (saved) {
      showSuccessToast(`Saved ${selectedRows.length} row(s) as CSV`);
    }
  };

  const disabled = selectedRows.length === 0;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={disabled}
                aria-label="Export"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
              >
                <DownloadSimple weight="regular" className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent>Export</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={handleCopyAsInsert} disabled={disabled}>
          <Database weight="regular" className="mr-2 h-4 w-4" />
          Copy as INSERT
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyAsJSON} disabled={disabled}>
          <FileJs weight="regular" className="mr-2 h-4 w-4" />
          Copy as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyAsCSV} disabled={disabled}>
          <FileText weight="regular" className="mr-2 h-4 w-4" />
          Copy as CSV
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleDownloadJSON} disabled={disabled}>
          <FileJs weight="regular" className="mr-2 h-4 w-4" />
          Download as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadCSV} disabled={disabled}>
          <FileText weight="regular" className="mr-2 h-4 w-4" />
          Download as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
