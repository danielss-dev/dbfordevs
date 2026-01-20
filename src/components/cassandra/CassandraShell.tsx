import { useState, useRef, useEffect } from "react";
import { Play, Trash2, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import Editor, { type Monaco } from "@monaco-editor/react";
import { cn } from "@/lib/utils";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { useCassandra } from "@/hooks";
import { useCassandraStore, useUIStore } from "@/stores";
import { registerCustomThemes, getMonacoTheme } from "@/components/editor/monaco-themes";
import type { CassandraConsistencyLevel } from "@/types";

interface CassandraShellProps {
  connectionId: string;
}

export function CassandraShell({ connectionId }: CassandraShellProps) {
  const { executeCql, listKeyspaces } = useCassandra();
  const { keyspacesByConnection, shellHistoryByConnection, loadingRows, clearShellHistory } =
    useCassandraStore();
  const { theme } = useUIStore();
  const [cql, setCql] = useState("SELECT * FROM system.local;");
  const [selectedKeyspace, setSelectedKeyspace] = useState<string | undefined>();
  const [consistency, setConsistency] = useState<CassandraConsistencyLevel>("ONE");
  const outputRef = useRef<HTMLDivElement>(null);

  const keyspaces = keyspacesByConnection[connectionId] || [];
  const history = shellHistoryByConnection[connectionId] || [];

  useEffect(() => {
    if (keyspaces.length === 0) {
      listKeyspaces(connectionId);
    }
  }, [connectionId, keyspaces.length, listKeyspaces]);

  // Scroll to bottom when history changes
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  const handleExecute = async () => {
    if (!cql.trim()) return;
    await executeCql(connectionId, cql, selectedKeyspace, 100, undefined, consistency);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleExecute();
    }
  };

  const handleClearHistory = () => {
    clearShellHistory(connectionId);
  };

  const consistencyLevels: CassandraConsistencyLevel[] = [
    "ONE",
    "QUORUM",
    "ALL",
    "LOCAL_QUORUM",
    "LOCAL_ONE",
    "EACH_QUORUM",
    "ANY",
  ];

  const handleEditorMount = (_editor: any, monaco: Monaco) => {
    // Register custom themes for Monaco
    registerCustomThemes(monaco);
    // Set the theme after registering
    monaco.editor.setTheme(getMonacoTheme(theme));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
        <Select value={selectedKeyspace} onValueChange={setSelectedKeyspace}>
          <SelectTrigger className="w-[180px] h-8">
            <SelectValue placeholder="Select keyspace" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value=" ">No keyspace</SelectItem>
            {keyspaces.filter(ks => !ks.name.startsWith("system")).map((ks) => (
              <SelectItem key={ks.name} value={ks.name}>
                {ks.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={consistency} onValueChange={(v) => setConsistency(v as CassandraConsistencyLevel)}>
          <SelectTrigger className="w-[140px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {consistencyLevels.map((level) => (
              <SelectItem key={level} value={level}>
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          onClick={handleExecute}
          disabled={loadingRows || !cql.trim()}
          className="gap-1"
        >
          <Play className="h-3.5 w-3.5" />
          Execute
        </Button>

        <span className="text-xs text-muted-foreground ml-auto">
          Ctrl+Enter to execute
        </span>

        <Button
          size="sm"
          variant="ghost"
          onClick={handleClearHistory}
          disabled={history.length === 0}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Editor */}
      <div className="h-[200px] border-b" onKeyDown={handleKeyDown}>
        <Editor
          height="100%"
          defaultLanguage="sql"
          value={cql}
          onChange={(value) => setCql(value || "")}
          theme={getMonacoTheme(theme)}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
            tabSize: 2,
            padding: { top: 8, bottom: 8 },
          }}
        />
      </div>

      {/* Output */}
      <div
        ref={outputRef}
        className="flex-1 overflow-auto p-4 font-mono text-sm bg-muted/20"
      >
        {history.length === 0 ? (
          <div className="text-muted-foreground text-center py-8">
            <p>CQL Shell - Execute CQL queries</p>
            <p className="text-xs mt-2">
              Enter a CQL query above and press Ctrl+Enter or click Execute
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((entry) => (
              <div key={entry.id} className="space-y-1">
                {/* Command */}
                <div className="flex items-start gap-2">
                  <span className="text-purple-500 shrink-0">cqlsh&gt;</span>
                  <pre className="whitespace-pre-wrap break-all text-foreground">{entry.cql}</pre>
                </div>

                {/* Execution info */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground ml-6">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {entry.executionTimeMs}ms
                  </span>
                  <span>
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  {entry.error ? (
                    <span className="flex items-center gap-1 text-red-500">
                      <AlertCircle className="h-3 w-3" />
                      Error
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-green-500">
                      <CheckCircle2 className="h-3 w-3" />
                      OK
                    </span>
                  )}
                </div>

                {/* Output/Error */}
                {entry.error ? (
                  <div className="ml-6 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-xs">
                    {entry.error}
                  </div>
                ) : entry.output ? (
                  <pre className={cn(
                    "ml-6 p-2 bg-muted rounded text-xs overflow-x-auto",
                    "whitespace-pre-wrap"
                  )}>
                    {entry.output}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
