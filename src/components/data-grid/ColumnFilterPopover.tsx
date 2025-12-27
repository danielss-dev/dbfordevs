import { useState } from "react";
import { Filter, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ColumnFilter } from "@/stores/crud";

interface ColumnFilterPopoverProps {
  columnId: string;
  columnName: string;
  dataType: string;
  currentFilter?: ColumnFilter;
  onFilterChange: (filter: ColumnFilter | null) => void;
}

export function ColumnFilterPopover({
  columnId,
  columnName,
  dataType,
  currentFilter,
  onFilterChange,
}: ColumnFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [operator, setOperator] = useState<ColumnFilter["operator"]>(
    currentFilter?.operator || "contains"
  );
  const [value, setValue] = useState(currentFilter?.value || "");

  const dataTypeLower = dataType.toLowerCase();
  const isNumeric =
    dataTypeLower.includes("int") ||
    dataTypeLower.includes("decimal") ||
    dataTypeLower.includes("numeric") ||
    dataTypeLower.includes("float") ||
    dataTypeLower.includes("real");

  const isBoolean =
    dataTypeLower.includes("bool") || dataTypeLower.includes("bit");

  const isDate =
    dataTypeLower.includes("date") ||
    dataTypeLower.includes("time") ||
    dataTypeLower.includes("timestamp");

  const handleApply = () => {
    if (!value.trim()) {
      onFilterChange(null);
    } else {
      onFilterChange({
        columnId,
        value: value.trim(),
        operator,
      });
    }
    setOpen(false);
  };

  const handleClear = () => {
    setValue("");
    setOperator("contains");
    onFilterChange(null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-6 w-6 p-0 ${
            currentFilter ? "text-primary" : "text-muted-foreground/50"
          }`}
        >
          <Filter className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Filter: {columnName}</h4>
              {currentFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="h-6 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Type: {dataType}
            </p>
          </div>

          {isBoolean ? (
            <div className="space-y-2">
              <Label htmlFor="filter-value" className="text-xs">
                Value
              </Label>
              <Select value={value} onValueChange={setValue}>
                <SelectTrigger id="filter-value">
                  <SelectValue placeholder="Select value..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">True</SelectItem>
                  <SelectItem value="false">False</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              {!isDate && (
                <div className="space-y-2">
                  <Label htmlFor="filter-operator" className="text-xs">
                    Operator
                  </Label>
                  <Select
                    value={operator}
                    onValueChange={(val) =>
                      setOperator(val as ColumnFilter["operator"])
                    }
                  >
                    <SelectTrigger id="filter-operator">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {isNumeric ? (
                        <>
                          <SelectItem value="equals">Equals</SelectItem>
                          <SelectItem value="gt">Greater than</SelectItem>
                          <SelectItem value="gte">
                            Greater than or equal
                          </SelectItem>
                          <SelectItem value="lt">Less than</SelectItem>
                          <SelectItem value="lte">
                            Less than or equal
                          </SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="contains">Contains</SelectItem>
                          <SelectItem value="equals">Equals</SelectItem>
                          <SelectItem value="startsWith">
                            Starts with
                          </SelectItem>
                          <SelectItem value="endsWith">Ends with</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="filter-value" className="text-xs">
                  Value
                </Label>
                <Input
                  id="filter-value"
                  type={isNumeric ? "number" : isDate ? "date" : "text"}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={`Enter ${dataType} value...`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleApply();
                    }
                  }}
                />
              </div>
            </>
          )}

          <div className="flex gap-2">
            <Button onClick={handleApply} size="sm" className="flex-1">
              Apply Filter
            </Button>
            <Button
              onClick={() => setOpen(false)}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
