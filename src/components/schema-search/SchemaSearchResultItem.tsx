import {
  Table,
  Eye,
  ListTree,
  Code2,
  FunctionSquare,
  Zap,
  Hash,
  Columns,
  Key,
  Database,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { highlightMatches } from "@/lib/fuzzy-search";
import type { SchemaObjectType, SchemaSearchResult } from "@/types";

interface SchemaSearchResultItemProps {
  result: SchemaSearchResult;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

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
};

/** Colors for each schema object type */
const OBJECT_TYPE_COLORS: Record<SchemaObjectType, string> = {
  table: "text-blue-500",
  column: "text-emerald-500",
  view: "text-purple-500",
  index: "text-orange-500",
  procedure: "text-pink-500",
  function: "text-cyan-500",
  trigger: "text-yellow-500",
  sequence: "text-red-500",
  // Redis
  "redis-key": "text-red-500",
  // MongoDB
  "mongo-database": "text-green-500",
  "mongo-collection": "text-green-600",
  "mongo-index": "text-green-400",
};

export function SchemaSearchResultItem({
  result,
  isSelected,
  onClick,
  onMouseEnter,
}: SchemaSearchResultItemProps) {
  const Icon = OBJECT_TYPE_ICONS[result.objectType];
  const iconColor = OBJECT_TYPE_COLORS[result.objectType];

  // Highlight matching characters in the name
  const highlightedParts = highlightMatches(result.name, result.matchIndices);

  return (
    <button
      className={cn(
        "w-full text-left px-2 py-1.5 rounded-md transition-colors flex items-center gap-2 group",
        isSelected
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent/50"
      )}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      {/* Icon */}
      <div className={cn("flex-shrink-0", iconColor)}>
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {/* Name with highlights */}
        <div className="text-sm truncate">
          {highlightedParts.map((part, index) => (
            <span
              key={index}
              className={cn(
                part.isMatch && "font-semibold text-primary"
              )}
            >
              {part.text}
            </span>
          ))}
        </div>

        {/* Secondary info */}
        <div className="text-[10px] text-muted-foreground truncate">
          {result.parentName ? (
            <span>
              {result.parentName}
              {typeof result.metadata?.dataType === "string" && (
                <span className="opacity-75">
                  {" "}
                  ({result.metadata.dataType})
                </span>
              )}
            </span>
          ) : (
            <span>{result.fullPath}</span>
          )}
        </div>
      </div>

      {/* Object type badge */}
      <div className="flex-shrink-0 text-[9px] uppercase tracking-wider text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
        {result.objectType}
      </div>
    </button>
  );
}
