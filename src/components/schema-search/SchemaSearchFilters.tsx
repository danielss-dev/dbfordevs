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
  Key,
  Database,
  FolderOpen,
  HardDrive,
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
  // Redis
  "redis-key": Key,
  // MongoDB
  "mongo-database": Database,
  "mongo-collection": FolderOpen,
  "mongo-index": ListTree,
  // Cassandra
  "cassandra-keyspace": HardDrive,
  "cassandra-table": Table,
  "cassandra-column": Columns,
  "cassandra-index": ListTree,
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
  // Redis
  "redis-key": "Keys",
  // MongoDB
  "mongo-database": "Databases",
  "mongo-collection": "Collections",
  "mongo-index": "Indexes",
  // Cassandra
  "cassandra-keyspace": "Keyspaces",
  "cassandra-table": "Tables",
  "cassandra-column": "Columns",
  "cassandra-index": "Indexes",
};

/** Order in which filters should be displayed - SQL types */
const SQL_FILTER_ORDER: SchemaObjectType[] = [
  "table",
  "column",
  "view",
  "index",
  "procedure",
  "function",
  "trigger",
  "sequence",
];

/** Redis filter types */
const REDIS_FILTER_ORDER: SchemaObjectType[] = [
  "redis-key",
];

/** MongoDB filter types */
const MONGODB_FILTER_ORDER: SchemaObjectType[] = [
  "mongo-database",
  "mongo-collection",
  "mongo-index",
];

/** Cassandra filter types */
const CASSANDRA_FILTER_ORDER: SchemaObjectType[] = [
  "cassandra-keyspace",
  "cassandra-table",
  "cassandra-column",
  "cassandra-index",
];

/** Get filter order based on database type */
function getFilterOrder(databaseType?: string): SchemaObjectType[] {
  if (databaseType === "redis") {
    return REDIS_FILTER_ORDER;
  }
  if (databaseType === "mongodb") {
    return MONGODB_FILTER_ORDER;
  }
  if (databaseType === "cassandra") {
    return CASSANDRA_FILTER_ORDER;
  }
  return SQL_FILTER_ORDER;
}

interface SchemaSearchFiltersProps {
  className?: string;
  databaseType?: string;
}

export function SchemaSearchFilters({ className, databaseType }: SchemaSearchFiltersProps) {
  const { enabledFilters, toggleFilter, selectAll, resetFilters } =
    useSchemaSearchStore();

  const filterOrder = getFilterOrder(databaseType);
  const relevantFilters = enabledFilters.filter(f => filterOrder.includes(f));
  const allSelected = relevantFilters.length === filterOrder.length;

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
            onClick={() => selectAll(filterOrder)}
            disabled={allSelected}
          >
            All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => resetFilters(filterOrder)}
            disabled={allSelected}
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Filter checkboxes in a grid */}
      <div className={cn("grid gap-1", filterOrder.length <= 2 ? "grid-cols-1" : "grid-cols-2")}>
        {filterOrder.map((objectType) => {
          const Icon = OBJECT_TYPE_ICONS[objectType];
          const isEnabled = enabledFilters.includes(objectType);

          return (
            <button
              key={objectType}
              className={cn(
                "flex items-center gap-2 px-2 py-[var(--pad-menu-y)] rounded-md text-xs transition-colors",
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
