import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  EyeOff,
  Pin,
  PinOff,
  BarChart3,
  Filter,
  Copy,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useGridStore } from "@/stores/grid";
import { copyToClipboard } from "@/lib/utils";
import { showSuccessToast } from "@/lib/toast-helpers";
import type { ColumnInfo } from "@/types";
import type { Column } from "@tanstack/react-table";

interface ColumnHeaderMenuProps {
  column: Column<Record<string, unknown>, unknown>;
  columnInfo: ColumnInfo;
  tableKey: string;
  data: Record<string, unknown>[];
  onShowFilter?: () => void;
}

export function ColumnHeaderMenu({
  column,
  columnInfo,
  tableKey,
  data,
  onShowFilter,
}: ColumnHeaderMenuProps) {
  const {
    gridPreferences,
    setColumnVisibility,
    setColumnPinning,
    openStatisticsDialog,
  } = useGridStore();

  const prefs = gridPreferences[tableKey];
  const columnConfig = prefs?.columns[columnInfo.name];
  const isPinned = columnConfig?.pinned || false;

  const handleSort = (desc: boolean | undefined) => {
    if (desc === undefined) {
      column.clearSorting();
    } else {
      column.toggleSorting(desc);
    }
  };

  const handleHide = () => {
    setColumnVisibility(tableKey, columnInfo.name, false);
  };

  const handlePin = (position: "left" | "right" | false) => {
    setColumnPinning(tableKey, columnInfo.name, position);
  };

  const handleCopyColumn = async () => {
    const values = data
      .map((row) => {
        const value = row[columnInfo.name];
        if (value === null || value === undefined) return "NULL";
        if (typeof value === "object") return JSON.stringify(value);
        return String(value);
      })
      .join("\n");

    await copyToClipboard(values);
    showSuccessToast(
      "Column copied",
      `${data.length} values copied to clipboard`
    );
  };

  const handleShowStatistics = () => {
    openStatisticsDialog(columnInfo.name);
  };

  const isSorted = column.getIsSorted();

  // Shared menu content for both dropdown and context menu
  const MenuItems = ({ isContextMenu = false }: { isContextMenu?: boolean }) => {
    const MenuItem = isContextMenu ? ContextMenuItem : DropdownMenuItem;
    const MenuSeparator = isContextMenu ? ContextMenuSeparator : DropdownMenuSeparator;
    const MenuSub = isContextMenu ? ContextMenuSub : DropdownMenuSub;
    const MenuSubTrigger = isContextMenu ? ContextMenuSubTrigger : DropdownMenuSubTrigger;
    const MenuSubContent = isContextMenu ? ContextMenuSubContent : DropdownMenuSubContent;

    return (
      <>
        {/* Sorting */}
        <MenuItem onClick={() => handleSort(false)}>
          <ArrowUp className="mr-2 h-4 w-4" />
          Sort Ascending
          {isSorted === "asc" && (
            <span className="ml-auto text-xs text-primary">Active</span>
          )}
        </MenuItem>
        <MenuItem onClick={() => handleSort(true)}>
          <ArrowDown className="mr-2 h-4 w-4" />
          Sort Descending
          {isSorted === "desc" && (
            <span className="ml-auto text-xs text-primary">Active</span>
          )}
        </MenuItem>
        {isSorted && (
          <MenuItem onClick={() => handleSort(undefined)}>
            <ArrowUpDown className="mr-2 h-4 w-4" />
            Clear Sort
          </MenuItem>
        )}

        <MenuSeparator />

        {/* Filter */}
        {onShowFilter && (
          <>
            <MenuItem onClick={onShowFilter}>
              <Filter className="mr-2 h-4 w-4" />
              Filter...
            </MenuItem>
            <MenuSeparator />
          </>
        )}

        {/* Pinning */}
        <MenuSub>
          <MenuSubTrigger>
            <Pin className="mr-2 h-4 w-4" />
            Pin Column
          </MenuSubTrigger>
          <MenuSubContent>
            <MenuItem onClick={() => handlePin("left")}>
              Pin to Left
              {isPinned === "left" && (
                <span className="ml-auto text-xs text-primary">Active</span>
              )}
            </MenuItem>
            <MenuItem onClick={() => handlePin("right")}>
              Pin to Right
              {isPinned === "right" && (
                <span className="ml-auto text-xs text-primary">Active</span>
              )}
            </MenuItem>
            {isPinned && (
              <>
                <MenuSeparator />
                <MenuItem onClick={() => handlePin(false)}>
                  <PinOff className="mr-2 h-4 w-4" />
                  Unpin
                </MenuItem>
              </>
            )}
          </MenuSubContent>
        </MenuSub>

        {/* Visibility */}
        <MenuItem onClick={handleHide}>
          <EyeOff className="mr-2 h-4 w-4" />
          Hide Column
        </MenuItem>

        <MenuSeparator />

        {/* Copy */}
        <MenuItem onClick={handleCopyColumn}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Column Values
        </MenuItem>

        {/* Statistics */}
        <MenuItem onClick={handleShowStatistics}>
          <BarChart3 className="mr-2 h-4 w-4" />
          Column Statistics
        </MenuItem>
      </>
    );
  };

  return (
    <>
      {/* Dropdown Menu (button trigger) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <MenuItems isContextMenu={false} />
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

// Wrapper component for context menu on column header
interface ColumnHeaderContextMenuProps {
  column: Column<Record<string, unknown>, unknown>;
  columnInfo: ColumnInfo;
  tableKey: string;
  data: Record<string, unknown>[];
  children: ReactNode;
}

export function ColumnHeaderContextMenu({
  column,
  columnInfo,
  tableKey,
  data,
  children,
}: ColumnHeaderContextMenuProps) {
  const {
    gridPreferences,
    setColumnVisibility,
    setColumnPinning,
    openStatisticsDialog,
  } = useGridStore();

  const prefs = gridPreferences[tableKey];
  const columnConfig = prefs?.columns[columnInfo.name];
  const isPinned = columnConfig?.pinned || false;

  const handleSort = (desc: boolean | undefined) => {
    if (desc === undefined) {
      column.clearSorting();
    } else {
      column.toggleSorting(desc);
    }
  };

  const handleHide = () => {
    setColumnVisibility(tableKey, columnInfo.name, false);
  };

  const handlePin = (position: "left" | "right" | false) => {
    setColumnPinning(tableKey, columnInfo.name, position);
  };

  const handleCopyColumn = async () => {
    const values = data
      .map((row) => {
        const value = row[columnInfo.name];
        if (value === null || value === undefined) return "NULL";
        if (typeof value === "object") return JSON.stringify(value);
        return String(value);
      })
      .join("\n");

    await copyToClipboard(values);
    showSuccessToast(
      "Column copied",
      `${data.length} values copied to clipboard`
    );
  };

  const handleShowStatistics = () => {
    openStatisticsDialog(columnInfo.name);
  };

  const isSorted = column.getIsSorted();

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {/* Sorting */}
        <ContextMenuItem onClick={() => handleSort(false)}>
          <ArrowUp className="mr-2 h-4 w-4" />
          Sort Ascending
          {isSorted === "asc" && (
            <span className="ml-auto text-xs text-primary">Active</span>
          )}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleSort(true)}>
          <ArrowDown className="mr-2 h-4 w-4" />
          Sort Descending
          {isSorted === "desc" && (
            <span className="ml-auto text-xs text-primary">Active</span>
          )}
        </ContextMenuItem>
        {isSorted && (
          <ContextMenuItem onClick={() => handleSort(undefined)}>
            <ArrowUpDown className="mr-2 h-4 w-4" />
            Clear Sort
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {/* Pinning */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Pin className="mr-2 h-4 w-4" />
            Pin Column
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={() => handlePin("left")}>
              Pin to Left
              {isPinned === "left" && (
                <span className="ml-auto text-xs text-primary">Active</span>
              )}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handlePin("right")}>
              Pin to Right
              {isPinned === "right" && (
                <span className="ml-auto text-xs text-primary">Active</span>
              )}
            </ContextMenuItem>
            {isPinned && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => handlePin(false)}>
                  <PinOff className="mr-2 h-4 w-4" />
                  Unpin
                </ContextMenuItem>
              </>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* Visibility */}
        <ContextMenuItem onClick={handleHide}>
          <EyeOff className="mr-2 h-4 w-4" />
          Hide Column
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Copy */}
        <ContextMenuItem onClick={handleCopyColumn}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Column Values
        </ContextMenuItem>

        {/* Statistics */}
        <ContextMenuItem onClick={handleShowStatistics}>
          <BarChart3 className="mr-2 h-4 w-4" />
          Column Statistics
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
