import { useState } from "react";
import {
  Sparkles,
  Search,
  Layers,
  Play,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Button,
  Textarea,
  Tabs,
  TabsList,
  TabsTrigger,
  ScrollArea,
  Badge,
} from "@/components/ui";
import { useAIStore } from "@/lib/ai/store";
import {
  generateMongoQuery,
  generateAggregationPipeline,
} from "@/lib/ai/nosql-ai";
import type { MongoContext } from "@/lib/ai/types";

interface MongoAIHelperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: MongoContext;
  onApplyQuery?: (query: string) => void;
  onApplyPipeline?: (pipeline: object[]) => void;
}

export function MongoAIHelper({
  open,
  onOpenChange,
  context,
  onApplyQuery,
  onApplyPipeline,
}: MongoAIHelperProps) {
  const { settings, isConfigured } = useAIStore();

  const [mode, setMode] = useState<"find" | "aggregate">("find");
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [explanation, setExplanation] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim() || !isConfigured()) return;

    setIsLoading(true);
    setError(null);
    setResult("");
    setExplanation("");

    try {
      if (mode === "find") {
        const response = await generateMongoQuery(prompt, context, settings);
        setResult(response.query);
        setExplanation(response.explanation);
      } else {
        const response = await generateAggregationPipeline(
          prompt,
          context,
          settings
        );
        setResult(JSON.stringify(response.pipeline, null, 2));
        setExplanation(response.explanation);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate query");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    if (mode === "find" && onApplyQuery) {
      onApplyQuery(result);
    } else if (mode === "aggregate" && onApplyPipeline) {
      try {
        const pipeline = JSON.parse(result);
        onApplyPipeline(pipeline);
      } catch {
        // Invalid JSON
      }
    }
    onOpenChange(false);
  };

  const isApiConfigured = isConfigured();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            MongoDB AI Assistant
          </DialogTitle>
          <DialogDescription>
            Generate MongoDB queries from natural language.
          </DialogDescription>
        </DialogHeader>

        {!isApiConfigured ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">
              Please configure your AI API key in settings to use this feature.
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 space-y-4">
            {/* Context Badge */}
            {context.selectedCollection && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Collection:
                </span>
                <Badge variant="secondary">{context.selectedCollection}</Badge>
              </div>
            )}

            {/* Mode Selector */}
            <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="find" className="gap-2">
                  <Search className="h-4 w-4" />
                  Find Query
                </TabsTrigger>
                <TabsTrigger value="aggregate" className="gap-2">
                  <Layers className="h-4 w-4" />
                  Aggregation
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Prompt Input */}
            <div className="space-y-2">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  mode === "find"
                    ? "Describe what you want to find... (e.g., 'Find all users where status is active and age is greater than 25')"
                    : "Describe your aggregation... (e.g., 'Count documents by category and sort by count descending')"
                }
                className="min-h-[80px]"
              />
              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isLoading}
                className="w-full gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate {mode === "find" ? "Query" : "Pipeline"}
                  </>
                )}
              </Button>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="flex-1 min-h-0 space-y-3">
                {/* Explanation */}
                {explanation && (
                  <div className="p-3 rounded-lg bg-muted/50 text-sm">
                    {explanation}
                  </div>
                )}

                {/* Query/Pipeline */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
                    <span className="text-xs font-medium text-muted-foreground uppercase">
                      {mode === "find" ? "Query" : "Pipeline"}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={handleCopy}
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="max-h-48">
                    <pre className="p-3 text-xs font-mono">
                      <code>{result}</code>
                    </pre>
                  </ScrollArea>
                </div>

                {/* Apply Button */}
                {(onApplyQuery || onApplyPipeline) && (
                  <Button onClick={handleApply} className="w-full gap-2">
                    <Play className="h-4 w-4" />
                    Apply {mode === "find" ? "Query" : "Pipeline"}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Compact AI helper button for toolbar integration
 */
interface MongoAIButtonProps {
  context: MongoContext;
  onApplyQuery?: (query: string) => void;
  onApplyPipeline?: (pipeline: object[]) => void;
}

export function MongoAIButton({
  context,
  onApplyQuery,
  onApplyPipeline,
}: MongoAIButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        AI Query
      </Button>
      <MongoAIHelper
        open={open}
        onOpenChange={setOpen}
        context={context}
        onApplyQuery={onApplyQuery}
        onApplyPipeline={onApplyPipeline}
      />
    </>
  );
}
