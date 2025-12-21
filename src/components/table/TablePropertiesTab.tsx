import { useState, useEffect } from "react";
import {
  Loader2,
  Table as TableIcon,
  Columns,
  Key,
  Link2,
  ListOrdered,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui";
import { useDatabase } from "@/hooks";
import type { Tab, TableProperties } from "@/types";
import { cn } from "@/lib/utils";

type CategoryType = "columns" | "primaryKeys" | "foreignKeys" | "indexes" | "constraints";

interface CategoryItemProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function CategoryItem({ icon, label, count, active, onClick }: CategoryItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      <span className={cn(
        "text-xs px-1.5 py-0.5 rounded-full",
        active ? "bg-primary/20" : "bg-muted"
      )}>
        {count}
      </span>
    </button>
  );
}

interface TablePropertiesTabProps {
  tab: Tab;
}

export function TablePropertiesTab({ tab }: TablePropertiesTabProps) {
  const { getTableProperties } = useDatabase();
  const [isLoading, setIsLoading] = useState(true);
  const [properties, setProperties] = useState<TableProperties | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryType>("columns");
  const [error, setError] = useState<string | null>(null);

  const loadProperties = async () => {
    if (!tab.tableName || !tab.connectionId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getTableProperties(tab.connectionId, tab.tableName);
      setProperties(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load table properties");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProperties();
  }, [tab.tableName, tab.connectionId]);

  const displayName = tab.tableName?.includes(".")
    ? tab.tableName.split(".").pop()
    : tab.tableName;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !properties) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <TableIcon className="h-12 w-12 opacity-30 mb-4" />
        <p className="text-lg font-medium">{error || "Unable to load properties"}</p>
        <Button variant="outline" className="mt-4" onClick={loadProperties}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const categories = [
    { id: "columns" as const, icon: <Columns className="h-4 w-4" />, label: "Columns", count: properties.columns.length },
    { id: "primaryKeys" as const, icon: <Key className="h-4 w-4" />, label: "Primary Keys", count: properties.primaryKeys.length },
    { id: "foreignKeys" as const, icon: <Link2 className="h-4 w-4" />, label: "Foreign Keys", count: properties.foreignKeys.length },
    { id: "indexes" as const, icon: <ListOrdered className="h-4 w-4" />, label: "Indexes", count: properties.indexes.length },
    { id: "constraints" as const, icon: <ShieldCheck className="h-4 w-4" />, label: "Constraints", count: properties.constraints.length },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <TableIcon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{displayName}</span>
          {properties.rowCount != null && (
            <span className="text-xs text-muted-foreground">
              ({properties.rowCount.toLocaleString()} rows)
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={loadProperties}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Category Sidebar */}
        <div className="w-48 border-r border-border p-2 space-y-1 overflow-y-auto">
          {categories.map((cat) => (
            <CategoryItem
              key={cat.id}
              icon={cat.icon}
              label={cat.label}
              count={cat.count}
              active={activeCategory === cat.id}
              onClick={() => setActiveCategory(cat.id)}
            />
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeCategory === "columns" && (
            <ColumnsTable columns={properties.columns} />
          )}
          {activeCategory === "primaryKeys" && (
            <PrimaryKeysTable keys={properties.primaryKeys} />
          )}
          {activeCategory === "foreignKeys" && (
            <ForeignKeysTable keys={properties.foreignKeys} />
          )}
          {activeCategory === "indexes" && (
            <IndexesTable indexes={properties.indexes} />
          )}
          {activeCategory === "constraints" && (
            <ConstraintsTable constraints={properties.constraints} />
          )}
        </div>
      </div>
    </div>
  );
}

// Sub-components for each category

function ColumnsTable({ columns }: { columns: TableProperties["columns"] }) {
  if (columns.length === 0) {
    return <EmptyState message="No columns found" />;
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Name</th>
            <th className="px-4 py-2 text-left font-medium">Type</th>
            <th className="px-4 py-2 text-center font-medium">PK</th>
            <th className="px-4 py-2 text-center font-medium">Nullable</th>
            <th className="px-4 py-2 text-left font-medium">Default</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((col, idx) => (
            <tr key={col.name} className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
              <td className="px-4 py-2 font-mono text-xs">{col.name}</td>
              <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{col.dataType}</td>
              <td className="px-4 py-2 text-center">
                {col.isPrimaryKey && <Key className="h-3.5 w-3.5 mx-auto text-amber-500" />}
              </td>
              <td className="px-4 py-2 text-center">
                <span className={col.nullable ? "text-muted-foreground" : "text-green-500"}>
                  {col.nullable ? "Yes" : "No"}
                </span>
              </td>
              <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                {col.defaultValue || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PrimaryKeysTable({ keys }: { keys: string[] }) {
  if (keys.length === 0) {
    return <EmptyState message="No primary keys found" />;
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Column Name</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key, idx) => (
            <tr key={key} className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
              <td className="px-4 py-2 font-mono text-xs flex items-center gap-2">
                <Key className="h-3.5 w-3.5 text-amber-500" />
                {key}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ForeignKeysTable({ keys }: { keys: TableProperties["foreignKeys"] }) {
  if (keys.length === 0) {
    return <EmptyState message="No foreign keys found" />;
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Column</th>
            <th className="px-4 py-2 text-left font-medium">References Table</th>
            <th className="px-4 py-2 text-left font-medium">References Column</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((fk, idx) => (
            <tr key={`${fk.column}-${fk.referencesTable}`} className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
              <td className="px-4 py-2 font-mono text-xs">{fk.column}</td>
              <td className="px-4 py-2 font-mono text-xs text-blue-500">{fk.referencesTable}</td>
              <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{fk.referencesColumn}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IndexesTable({ indexes }: { indexes: TableProperties["indexes"] }) {
  if (indexes.length === 0) {
    return <EmptyState message="No indexes found" />;
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Name</th>
            <th className="px-4 py-2 text-left font-medium">Columns</th>
            <th className="px-4 py-2 text-center font-medium">Unique</th>
            <th className="px-4 py-2 text-center font-medium">Primary</th>
          </tr>
        </thead>
        <tbody>
          {indexes.map((idx, i) => (
            <tr key={idx.name} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
              <td className="px-4 py-2 font-mono text-xs">{idx.name}</td>
              <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                {idx.columns.join(", ")}
              </td>
              <td className="px-4 py-2 text-center">
                <span className={idx.isUnique ? "text-green-500" : "text-muted-foreground"}>
                  {idx.isUnique ? "Yes" : "No"}
                </span>
              </td>
              <td className="px-4 py-2 text-center">
                {idx.isPrimary && <Key className="h-3.5 w-3.5 mx-auto text-amber-500" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConstraintsTable({ constraints }: { constraints: TableProperties["constraints"] }) {
  if (constraints.length === 0) {
    return <EmptyState message="No constraints found" />;
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Name</th>
            <th className="px-4 py-2 text-left font-medium">Type</th>
            <th className="px-4 py-2 text-left font-medium">Definition</th>
          </tr>
        </thead>
        <tbody>
          {constraints.map((con, idx) => (
            <tr key={con.name} className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
              <td className="px-4 py-2 font-mono text-xs">{con.name}</td>
              <td className="px-4 py-2">
                <span className="px-2 py-0.5 bg-muted rounded text-xs">
                  {con.constraintType}
                </span>
              </td>
              <td className="px-4 py-2 font-mono text-xs text-muted-foreground truncate max-w-md" title={con.definition}>
                {con.definition}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
      {message}
    </div>
  );
}
