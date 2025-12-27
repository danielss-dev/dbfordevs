import { FileCode, Sparkles, Database, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DatabaseType } from "@/types";

interface ExampleQuery {
  title: string;
  description: string;
  sql: string;
  icon: React.ReactNode;
}

interface EmptyQueryStateProps {
  onSelectExample: (sql: string) => void;
  databaseType?: DatabaseType;
}

const getExampleQueries = (dbType?: DatabaseType): ExampleQuery[] => {
  const isPostgres = dbType === "postgresql" || dbType === "cockroachdb";
  const isMySQL = dbType === "mysql" || dbType === "mariadb";
  const isSQLite = dbType === "sqlite";

  const examples: ExampleQuery[] = [
    {
      title: "Select all records",
      description: "Retrieve all rows from a table",
      sql: "SELECT * FROM table_name LIMIT 100;",
      icon: <Database className="h-4 w-4" />,
    },
    {
      title: "Filter with WHERE",
      description: "Get records matching specific criteria",
      sql: "SELECT id, name, email\nFROM users\nWHERE created_at > '2024-01-01'\nORDER BY created_at DESC;",
      icon: <FileCode className="h-4 w-4" />,
    },
    {
      title: "Join tables",
      description: "Combine data from multiple tables",
      sql: "SELECT u.name, o.total, o.created_at\nFROM users u\nINNER JOIN orders o ON u.id = o.user_id\nWHERE o.status = 'completed';",
      icon: <Sparkles className="h-4 w-4" />,
    },
    {
      title: "Aggregate data",
      description: "Count, sum, and group records",
      sql: "SELECT category, COUNT(*) as count, AVG(price) as avg_price\nFROM products\nGROUP BY category\nHAVING COUNT(*) > 5;",
      icon: <Clock className="h-4 w-4" />,
    },
  ];

  // Add database-specific examples
  if (isPostgres) {
    examples.push({
      title: "JSON query (PostgreSQL)",
      description: "Query JSON/JSONB columns",
      sql: "SELECT id, data->>'name' as name, data->'attributes' as attrs\nFROM products\nWHERE data @> '{\"active\": true}';",
      icon: <Database className="h-4 w-4" />,
    });
  } else if (isMySQL) {
    examples.push({
      title: "Full-text search (MySQL)",
      description: "Search text with MATCH AGAINST",
      sql: "SELECT id, title, MATCH(title, content) AGAINST('search term') as score\nFROM articles\nWHERE MATCH(title, content) AGAINST('search term' IN NATURAL LANGUAGE MODE);",
      icon: <Database className="h-4 w-4" />,
    });
  } else if (isSQLite) {
    examples.push({
      title: "Date functions (SQLite)",
      description: "Work with dates",
      sql: "SELECT id, name, date(created_at) as date,\n       julianday('now') - julianday(created_at) as days_old\nFROM records;",
      icon: <Database className="h-4 w-4" />,
    });
  }

  return examples;
};

export function EmptyQueryState({ onSelectExample, databaseType }: EmptyQueryStateProps) {
  const examples = getExampleQueries(databaseType);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="mb-6 w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <FileCode className="h-8 w-8 text-primary" />
      </div>

      <h3 className="text-lg font-semibold mb-2">Start writing a query</h3>
      <p className="text-sm text-muted-foreground mb-8 max-w-md">
        Use the editor above to write SQL queries, or try one of these examples to get started
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full">
        {examples.map((example, index) => (
          <button
            key={index}
            onClick={() => onSelectExample(example.sql)}
            className={cn(
              "group relative flex flex-col items-start gap-2 p-4 rounded-lg border border-border",
              "bg-card hover:bg-accent/50 transition-all duration-200",
              "text-left hover:border-primary/50 hover:shadow-sm"
            )}
          >
            <div className="flex items-center gap-2 w-full">
              <div className="flex-shrink-0 w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                {example.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium truncate">{example.title}</h4>
              </div>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {example.description}
            </p>
            <code className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded w-full overflow-hidden text-ellipsis whitespace-nowrap">
              {example.sql.split('\n')[0]}...
            </code>
          </button>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Cmd+Enter</kbd>
          <span>to run query</span>
        </div>
      </div>
    </div>
  );
}
