import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Database,
  Key,
  List,
  Rows,
  X,
  Settings,
  Plus,
  FileText,
} from "lucide-react";
import {
  Button,
  ScrollArea,
  Badge,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Switch,
  Textarea,
} from "@/components/ui";
import { useAIStore } from "@/lib/ai/store";
import { getTokenCountColor } from "@/lib/ai/context-builder";
import { cn } from "@/lib/utils";

interface AIContextPanelProps {
  onOpenConfig: () => void;
}

export function AIContextPanel({ onOpenConfig }: AIContextPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualText, setManualText] = useState("");

  const {
    context,
    contextConfig,
    manualContextEntries,
    contextTemplates,
    enhancedTables,
    contextPanelOpen,
    setContextPanelOpen,
    addManualContextEntry,
    removeManualContextEntry,
    applyContextTemplate,
    estimateContextSize,
    updateContextConfig,
  } = useAIStore();

  if (!contextPanelOpen) return null;

  const contextSize = estimateContextSize();
  const tokenColor = getTokenCountColor(contextSize.estimatedTokens);

  const handleAddManualContext = () => {
    if (manualText.trim()) {
      addManualContextEntry({
        type: "custom",
        customText: manualText.trim(),
      });
      setManualText("");
      setShowManualInput(false);
    }
  };

  return (
    <div className="absolute right-0 top-12 bottom-16 w-64 border-l border-border bg-background/95 backdrop-blur-sm flex flex-col z-10">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Context</span>
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onOpenConfig}
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Configure Context</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setContextPanelOpen(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Token Count Indicator */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Estimated Tokens</span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] h-5",
              tokenColor === "green" && "border-success text-success",
              tokenColor === "yellow" && "border-warning text-warning",
              tokenColor === "red" && "border-destructive text-destructive"
            )}
          >
            {contextSize.estimatedTokens >= 1000
              ? `${(contextSize.estimatedTokens / 1000).toFixed(1)}k`
              : contextSize.estimatedTokens}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
          <span>{contextSize.tableCount} tables</span>
          <span>{contextSize.relationshipCount} FKs</span>
          <span>{contextSize.indexCount} indexes</span>
        </div>
      </div>

      {/* Template Selector */}
      <div className="px-3 py-2 border-b border-border">
        <label className="micro-label">
          Context Template
        </label>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {contextTemplates.filter(t => t.isBuiltIn).map((template) => (
            <Button
              key={template.id}
              variant="outline"
              size="sm"
              className={cn(
                "text-[10px] h-6 px-2",
                contextConfig.includeForeignKeys === template.includeForeignKeys &&
                  contextConfig.includeIndexes === template.includeIndexes &&
                  contextConfig.includeSampleData === template.includeSampleData &&
                  "bg-primary/10 border-primary text-primary"
              )}
              onClick={() => applyContextTemplate(template.id)}
            >
              {template.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Quick Toggles */}
      <div className="px-3 py-2 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs">Foreign Keys</span>
          </div>
          <Switch
            checked={contextConfig.includeForeignKeys}
            onCheckedChange={(checked) =>
              updateContextConfig({ includeForeignKeys: checked })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <List className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs">Indexes</span>
          </div>
          <Switch
            checked={contextConfig.includeIndexes}
            onCheckedChange={(checked) =>
              updateContextConfig({ includeIndexes: checked })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rows className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs">Sample Data</span>
          </div>
          <Switch
            checked={contextConfig.includeSampleData}
            onCheckedChange={(checked) =>
              updateContextConfig({ includeSampleData: checked })
            }
          />
        </div>
      </div>

      {/* Tables in Context */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={() => setExpanded(!expanded)}
          >
            <span className="micro-label">
              Tables in Context ({enhancedTables.length || context.tables.length})
            </span>
            {expanded ? (
              <ChevronUp className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            )}
          </button>

          {expanded && (
            <div className="mt-2 space-y-1">
              {(enhancedTables.length > 0 ? enhancedTables : context.tables).map(
                (table) => (
                  <div
                    key={table.name}
                    className="flex items-center gap-2 px-2 py-1 rounded bg-muted/50 text-xs"
                  >
                    <Database className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate flex-1">
                      {table.schema ? `${table.schema}.` : ""}
                      {table.name}
                    </span>
                    {"relationships" in table &&
                      (table as { relationships?: unknown[] }).relationships &&
                      ((table as { relationships?: unknown[] }).relationships?.length ?? 0) > 0 && (
                      <Badge variant="secondary" className="text-[8px] h-4">
                        {(table as { relationships?: unknown[] }).relationships?.length} FK
                      </Badge>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Manual Context Entries */}
        <div className="px-3 pb-3">
          <div className="flex items-center justify-between">
            <span className="micro-label">
              Custom Context
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => setShowManualInput(!showManualInput)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {showManualInput && (
            <div className="mt-2 space-y-2">
              <Textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Add custom context (e.g., business rules, domain knowledge)..."
                className="text-xs min-h-[60px]"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => {
                    setManualText("");
                    setShowManualInput(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-6 text-xs"
                  onClick={handleAddManualContext}
                  disabled={!manualText.trim()}
                >
                  Add
                </Button>
              </div>
            </div>
          )}

          {manualContextEntries.length > 0 && (
            <div className="mt-2 space-y-1">
              {manualContextEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-2 px-2 py-1.5 rounded bg-muted/50 text-xs"
                >
                  <FileText className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="flex-1 line-clamp-2">
                    {entry.customText}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 shrink-0"
                    onClick={() => removeManualContextEntry(entry.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
