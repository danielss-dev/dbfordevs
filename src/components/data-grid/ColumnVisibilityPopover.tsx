import * as React from "react";
import { Eye, EyeOff, Columns } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useGridStore } from "@/stores/grid";
import type { ColumnInfo } from "@/types";
import { cn } from "@/lib/utils";

interface ColumnVisibilityPopoverProps {
  tableKey: string;
  columns: ColumnInfo[];
}

export function ColumnVisibilityPopover({
  tableKey,
  columns,
}: ColumnVisibilityPopoverProps) {
  const {
    gridPreferences,
    initGridPreferences,
    setColumnVisibility,
    setAllColumnsVisibility,
  } = useGridStore();

  // Initialize preferences if not exists
  React.useEffect(() => {
    if (!gridPreferences[tableKey]) {
      initGridPreferences(
        tableKey,
        columns.map((c) => c.name)
      );
    }
  }, [tableKey, columns, gridPreferences, initGridPreferences]);

  const prefs = gridPreferences[tableKey];

  const visibleCount = prefs
    ? Object.values(prefs.columns).filter((c) => c.visible).length
    : columns.length;
  const totalCount = columns.length;

  const isColumnVisible = (columnId: string): boolean => {
    if (!prefs) return true;
    return prefs.columns[columnId]?.visible ?? true;
  };

  const handleToggle = (columnId: string, checked: boolean) => {
    setColumnVisibility(tableKey, columnId, checked);
  };

  const handleShowAll = () => {
    setAllColumnsVisibility(tableKey, true);
  };

  const handleHideAll = () => {
    setAllColumnsVisibility(tableKey, false);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
        >
          <Columns className="h-3.5 w-3.5" />
          <span>
            {visibleCount}/{totalCount}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="p-2 pb-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Columns</span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleShowAll}
              >
                <Eye className="h-3 w-3 mr-1" />
                All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleHideAll}
              >
                <EyeOff className="h-3 w-3 mr-1" />
                None
              </Button>
            </div>
          </div>
        </div>
        <Separator />
        <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
          {columns.map((column) => {
            const isVisible = isColumnVisible(column.name);
            const checkboxId = `col-vis-${column.name}`;
            return (
              <div
                key={column.name}
                className={cn(
                  "flex items-center gap-2 py-1 px-1 rounded cursor-pointer hover:bg-accent transition-colors",
                  !isVisible && "opacity-50"
                )}
                onClick={() => handleToggle(column.name, !isVisible)}
              >
                <Checkbox
                  id={checkboxId}
                  checked={isVisible}
                  onCheckedChange={(checked) =>
                    handleToggle(column.name, checked === true)
                  }
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-sm truncate flex-1" title={column.name}>
                  {column.name}
                </span>
                {column.isPrimaryKey && (
                  <span className="text-[10px] px-1 py-0.5 bg-primary/10 text-primary rounded">
                    PK
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
