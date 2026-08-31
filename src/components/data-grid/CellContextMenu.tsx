import * as React from "react";
import { Copy, FileJs, FileText, Table, Eye, PencilSimple, Trash, Binary } from "@phosphor-icons/react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { copyToClipboard } from "@/lib/utils";
import { showSuccessToast } from "@/lib/toast-helpers";
import { formatSQLValue, escapeCSV } from "@/lib/export-utils";
import { useGridStore } from "@/stores/grid";
import { isJsonValue, isBinaryType } from "@/lib/format-utils";
import type { ColumnInfo } from "@/types";

interface CellContextMenuProps {
  children: React.ReactNode;
  value: unknown;
  rowData: Record<string, unknown>;
  columnId: string;
  columnInfo: ColumnInfo;
  tableName: string;
  data: Record<string, unknown>[];
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
}

export function CellContextMenu({
  children,
  value,
  rowData,
  columnId,
  columnInfo,
  tableName,
  data,
  onEdit,
  onDelete,
  canEdit = true,
}: CellContextMenuProps) {
  const { openBinaryPreviewDialog } = useGridStore();

  const handleCopyCell = async () => {
    let copyValue: string;
    if (value === null || value === undefined) {
      copyValue = "";
    } else if (typeof value === "object") {
      copyValue = JSON.stringify(value);
    } else {
      copyValue = String(value);
    }
    await copyToClipboard(copyValue);
    showSuccessToast("Copied", "Cell value copied to clipboard");
  };

  const handleCopyRowAsJSON = async () => {
    const json = JSON.stringify(rowData, null, 2);
    await copyToClipboard(json);
    showSuccessToast("Copied", "Row copied as JSON");
  };

  const handleCopyRowAsCSV = async () => {
    const columnNames = Object.keys(rowData);
    const header = columnNames.map(escapeCSV).join(",");
    const values = columnNames.map((col) => escapeCSV(String(rowData[col] ?? ""))).join(",");
    const csv = `${header}\n${values}`;
    await copyToClipboard(csv);
    showSuccessToast("Copied", "Row copied as CSV");
  };

  const handleCopyRowAsInsert = async () => {
    const columnNames = Object.keys(rowData);
    const values = columnNames.map((col) => formatSQLValue(rowData[col]));
    const sql = `INSERT INTO ${tableName} (${columnNames.join(", ")}) VALUES (${values.join(", ")});`;
    await copyToClipboard(sql);
    showSuccessToast("Copied", "Row copied as INSERT statement");
  };

  const handleCopyColumn = async () => {
    const values = data
      .map((row) => {
        const val = row[columnId];
        if (val === null || val === undefined) return "NULL";
        if (typeof val === "object") return JSON.stringify(val);
        return String(val);
      })
      .join("\n");
    await copyToClipboard(values);
    showSuccessToast("Copied", `${data.length} values copied to clipboard`);
  };

  const handleViewJson = () => {
    // Open a dialog or viewer for JSON
    const jsonStr =
      typeof value === "object"
        ? JSON.stringify(value, null, 2)
        : String(value);
    // For now, copy to clipboard; later could open a viewer dialog
    copyToClipboard(jsonStr);
    showSuccessToast("JSON Preview", "JSON copied to clipboard");
  };

  const handleViewBinary = () => {
    if (typeof value === "string") {
      openBinaryPreviewDialog(value);
    }
  };

  const isJson = isJsonValue(value);
  const isBinary = isBinaryType(columnInfo.dataType);

  return (
    <ContextMenu>
      {children}
      <ContextMenuContent className="w-56">
        {/* Copy operations */}
        <ContextMenuItem onClick={handleCopyCell}>
          <Copy weight="regular" className="mr-2 h-4 w-4" />
          Copy Cell
          <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Table weight="regular" className="mr-2 h-4 w-4" />
            Copy Row
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={handleCopyRowAsJSON}>
              <FileJs weight="regular" className="mr-2 h-4 w-4" />
              As JSON
            </ContextMenuItem>
            <ContextMenuItem onClick={handleCopyRowAsCSV}>
              <FileText weight="regular" className="mr-2 h-4 w-4" />
              As CSV
            </ContextMenuItem>
            <ContextMenuItem onClick={handleCopyRowAsInsert}>
              <Table weight="regular" className="mr-2 h-4 w-4" />
              As INSERT
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuItem onClick={handleCopyColumn}>
          <Copy weight="regular" className="mr-2 h-4 w-4" />
          Copy Column ({columnId})
        </ContextMenuItem>

        {/* View operations for special types */}
        {(isJson || isBinary) && (
          <>
            <ContextMenuSeparator />
            {isJson && (
              <ContextMenuItem onClick={handleViewJson}>
                <Eye weight="regular" className="mr-2 h-4 w-4" />
                View JSON
              </ContextMenuItem>
            )}
            {isBinary && value && (
              <ContextMenuItem onClick={handleViewBinary}>
                <Binary weight="regular" className="mr-2 h-4 w-4" />
                View Binary Data
              </ContextMenuItem>
            )}
          </>
        )}

        {/* Edit operations */}
        {canEdit && (
          <>
            <ContextMenuSeparator />
            {onEdit && (
              <ContextMenuItem onClick={onEdit}>
                <PencilSimple weight="regular" className="mr-2 h-4 w-4" />
                PencilSimple Cell
              </ContextMenuItem>
            )}
            {onDelete && (
              <ContextMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash weight="regular" className="mr-2 h-4 w-4" />
                Delete Row
              </ContextMenuItem>
            )}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

// Wrapper component that can be used as a ContextMenuTrigger
export function CellContextMenuTrigger({
  children,
  ...props
}: CellContextMenuProps) {
  return (
    <CellContextMenu {...props}>
      <div className="contents">{children}</div>
    </CellContextMenu>
  );
}
