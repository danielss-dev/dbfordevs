import { useState, useRef, useEffect } from "react";
import { Terminal, Loader2, Trash2, Send } from "lucide-react";
import { Button, Input, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { useRedis, useToast } from "@/hooks";
import { useRedisStore } from "@/stores";

interface RedisCLIProps {
  connectionId: string;
}

export function RedisCLI({ connectionId }: RedisCLIProps) {
  const { executeCommand, clearCliHistory } = useRedis();
  const { toast } = useToast();
  const [command, setCommand] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const { cliHistoryByConnection } = useRedisStore();
  const history = cliHistoryByConnection[connectionId] || [];

  // Scroll to bottom when new output is added
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  const handleExecute = async () => {
    if (!command.trim() || isExecuting) return;

    setIsExecuting(true);
    setHistoryIndex(-1);

    try {
      await executeCommand(connectionId, command.trim());
      setCommand("");
    } catch (error) {
      toast({
        title: "Command failed",
        description: error instanceof Error ? error.message : "Failed to execute command",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleExecute();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setCommand(history[history.length - 1 - newIndex]?.command || "");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(history[history.length - 1 - newIndex]?.command || "");
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand("");
      }
    }
  };

  const handleClear = () => {
    clearCliHistory(connectionId);
    toast({
      title: "History cleared",
      description: "CLI history has been cleared.",
    });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4" />
          <span className="text-sm font-medium">Redis CLI</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleClear}
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
        className="flex-1 overflow-auto font-mono text-sm p-4 space-y-2"
      >
        {history.length === 0 && (
          <div className="text-muted-foreground">
            Enter a Redis command below. Use up/down arrows to navigate history.
          </div>
        )}

        {history.map((entry) => (
          <div key={entry.id} className="space-y-1">
            {/* Command */}
            <div className="flex items-start gap-2">
              <span className="text-primary select-none">&gt;</span>
              <span className="text-foreground">{entry.command}</span>
              <span className="text-muted-foreground text-xs ml-auto">
                {entry.executionTimeMs}ms
              </span>
            </div>

            {/* Output or Error */}
            {entry.error ? (
              <div className="pl-4 text-destructive whitespace-pre-wrap">
                (error) {entry.error}
              </div>
            ) : (
              <div className="pl-4 text-muted-foreground whitespace-pre-wrap">
                {entry.output || "(nil)"}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 p-3 border-t">
        <span className="text-primary font-mono select-none">&gt;</span>
        <Input
          ref={inputRef}
          placeholder="Enter Redis command (e.g., GET key, SET key value, INFO)"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 font-mono"
          disabled={isExecuting}
          autoFocus
        />
        <Button
          size="sm"
          onClick={handleExecute}
          disabled={!command.trim() || isExecuting}
        >
          {isExecuting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
