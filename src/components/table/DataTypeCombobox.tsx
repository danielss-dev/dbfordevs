import { useState, useMemo, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { DatabaseType } from "@/types";
import { getDataTypesForDatabase } from "@/lib/data-types";

interface DataTypeComboboxProps {
  value: string;
  onChange: (value: string) => void;
  databaseType: DatabaseType;
}

export function DataTypeCombobox({
  value,
  onChange,
  databaseType,
}: DataTypeComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const dataTypeCategories = getDataTypesForDatabase(databaseType);

  // Flatten all types for easy searching
  const allTypes = useMemo(() => {
    return dataTypeCategories.flatMap((category) =>
      category.types.map((type) => ({
        ...type,
        categoryName: category.name,
      }))
    );
  }, [dataTypeCategories]);

  // Filter types based on search
  const filteredCategories = useMemo(() => {
    if (!search.trim()) {
      return dataTypeCategories;
    }

    const searchLower = search.toLowerCase();
    return dataTypeCategories
      .map((category) => ({
        ...category,
        types: category.types.filter(
          (type) =>
            type.name.toLowerCase().includes(searchLower) ||
            category.name.toLowerCase().includes(searchLower)
        ),
      }))
      .filter((category) => category.types.length > 0);
  }, [dataTypeCategories, search]);

  // Focus input when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setSearch("");
    }
  }, [open]);

  const handleSelect = (typeName: string) => {
    onChange(typeName);
    setOpen(false);
  };

  const selectedType = allTypes.find((t) => t.name === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-8 justify-between text-sm font-normal px-2 min-w-[100px]"
        >
          <span className="truncate">{value || "Select type..."}</span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0 overflow-hidden" align="start">
        {/* Search input */}
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            ref={inputRef}
            placeholder="Search data types..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 border-0 bg-transparent p-0 text-sm placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        {/* Data types list */}
        <div
          className="max-h-[300px] overflow-y-auto overscroll-contain"
          onWheel={(e) => e.stopPropagation()}
        >
          {filteredCategories.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No data types found.
            </div>
          ) : (
            <div className="p-1">
              {filteredCategories.map((category, categoryIndex) => (
                <div key={category.name}>
                  {/* Category separator */}
                  <div
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5",
                      categoryIndex > 0 && "mt-2 border-t pt-2"
                    )}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {category.name}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  {/* Types in category */}
                  {category.types.map((type) => (
                    <button
                      key={type.name}
                      onClick={() => handleSelect(type.name)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
                        "hover:bg-accent hover:text-accent-foreground",
                        "focus:bg-accent focus:text-accent-foreground",
                        value === type.name && "bg-accent"
                      )}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          value === type.name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="font-mono text-xs">{type.name}</span>
                      {type.supportsAutoIncrement && (
                        <span className="ml-auto text-[10px] text-muted-foreground bg-muted px-1 rounded">
                          AI
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Type info footer */}
        {selectedType && (
          <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
            <span className="font-medium text-foreground font-mono">{selectedType.name}</span>
            <span className="text-muted-foreground">({selectedType.categoryName})</span>
            {selectedType.supportsAutoIncrement && (
              <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
                Auto Increment
              </span>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
