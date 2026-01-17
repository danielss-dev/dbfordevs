import { useState, useRef, useEffect } from "react";
import { Send, Trash2, Loader2 } from "lucide-react";
import { Button, Input, Tooltip, TooltipContent, TooltipTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { useMongoDB } from "@/hooks";
import { useMongoDBStore } from "@/stores";

interface MongoShellProps {
  connectionId: string;
}

export function MongoShell({ connectionId }: MongoShellProps) {
  const { runCommand, listDatabases } = useMongoDB();
  const { shellHistoryByConnection, databasesByConnection, clearShellHistory, loading } =
    useMongoDBStore();

  const [command, setCommand] = useState("");
  const [selectedDb, setSelectedDb] = useState("admin");
  const outputRef = useRef<HTMLDivElement>(null);

  const history = shellHistoryByConnection[connectionId] || [];
  const databases = databasesByConnection[connectionId] || [];

  // Load databases on mount
  useEffect(() => {
    if (databases.length === 0) {
      listDatabases(connectionId);
    }
  }, [connectionId, databases.length, listDatabases]);

  // Auto-scroll to bottom when history changes
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || loading) return;

    await runCommand(connectionId, selectedDb, command);
    setCommand("");
  };

  const handleClearHistory = () => {
    clearShellHistory(connectionId);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b p-2">
        <Select value={selectedDb} onValueChange={setSelectedDb}>
          <SelectTrigger className="w-40 h-8">
            <SelectValue placeholder="Select database" />
          </SelectTrigger>
          <SelectContent>
            {databases.map((db) => (
              <SelectItem key={db.name} value={db.name}>
                {db.name}
              </SelectItem>
            ))}
            {databases.length === 0 && (
              <SelectItem value="admin">admin</SelectItem>
            )}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleClearHistory}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear history</TooltipContent>
        </Tooltip>
      </div>

      {/* Output */}
      <div
        ref={outputRef}
        className="flex-1 overflow-auto bg-muted/30 p-4 font-mono text-sm"
      >
        {history.length === 0 ? (
          <div className="text-muted-foreground">
            <p>MongoDB Shell</p>
            <p className="mt-2 text-xs">
              Enter MongoDB commands as JSON objects. Examples:
            </p>
            <pre className="mt-2 text-xs text-muted-foreground/70">
{`{ "ping": 1 }
{ "listCollections": 1 }
{ "serverStatus": 1 }
{ "find": "collectionName", "filter": {} }
{ "insert": "collectionName", "documents": [{"name": "test"}] }`}
            </pre>
          </div>
        ) : (
          history.map((entry) => (
            <div key={entry.id} className="mb-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-green-500">{">"}</span>
                <span className="text-cyan-500">{selectedDb}</span>
                <span>{entry.command}</span>
              </div>
              {entry.error ? (
                <div className="mt-1 text-destructive whitespace-pre-wrap">
                  Error: {entry.error}
                </div>
              ) : (
                <pre className="mt-1 whitespace-pre-wrap text-foreground/80 overflow-x-auto">
                  {entry.output}
                </pre>
              )}
              <div className="mt-1 text-xs text-muted-foreground">
                {entry.executionTimeMs}ms
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Executing...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t p-2">
        <span className="text-green-500 font-mono">{">"}</span>
        <Input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder='Enter command as JSON: { "ping": 1 }'
          className="flex-1 font-mono text-sm h-9"
          disabled={loading}
        />
        <Button type="submit" size="sm" className="h-9" disabled={!command.trim() || loading}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
