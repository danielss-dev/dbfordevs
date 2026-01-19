import {
  Table,
  Eye,
  ListTree,
  Code2,
  FunctionSquare,
  Zap,
  Hash,
  Columns,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import { useSchemaSearchStore } from "@/stores";
import type { SchemaObjectType } from "@/types";

/** Icon for each schema object type */
const OBJECT_TYPE_ICONS: Record<SchemaObjectType, React.ComponentType<{ className?: string }>> = {
  table: Table,
  column: Columns,
  view: Eye,
  index: ListTree,
  procedure: Code2,
  function: FunctionSquare,
  trigger: Zap,
  sequence: Hash,
};

/** Display labels for filters */
const FILTER_LABELS: Record<SchemaObjectType, string> = {
  table: "Tables",
  column: "Columns",
  view: "Views",
  index: "Indexes",
  procedure: "Procedures",
  function: "Functions",
  trigger: "Triggers",
  sequence: "Sequences",
};

/** Order in which filters should be displayed */
const FILTER_ORDER: SchemaObjectType[] = [
  "table",
  "column",
  "view",
  "index",
  "procedure",
  "function",
  "trigger",
  "sequence",
];

interface SchemaSearchFiltersProps {
  className?: string;
}

export function SchemaSearchFilters({ className }: SchemaSearchFiltersProps) {
  const { enabledFilters, toggleFilter, selectAll, resetFilters } =
    useSchemaSearchStore();

  const allSelected = enabledFilters.length === FILTER_ORDER.length;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header with actions */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium text-muted-foreground">
          Filter by type
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={selectAll}
            disabled={allSelected}
          >
            All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={resetFilters}
            disabled={allSelected}
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Filter checkboxes in a grid */}
      <div className="grid grid-cols-2 gap-1">
        {FILTER_ORDER.map((objectType) => {
          const Icon = OBJECT_TYPE_ICONS[objectType];
          const isEnabled = enabledFilters.includes(objectType);

          return (
            <button
              key={objectType}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors",
                isEnabled
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50 text-muted-foreground"
              )}
              onClick={() => toggleFilter(objectType)}
            >
              <div className="flex items-center gap-2 flex-1">
                <Icon className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{FILTER_LABELS[objectType]}</span>
              </div>
              {isEnabled && (
                <Check className="h-3 w-3 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
