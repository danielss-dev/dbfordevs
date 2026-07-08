import { useState } from "react";
import {
  Sparkles,
  Terminal,
  Lightbulb,
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
  generateRedisCommands,
  suggestDataStructure,
} from "@/lib/ai/nosql-ai";
import type { RedisContext } from "@/lib/ai/types";

interface RedisAIHelperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: RedisContext;
  onApplyCommands?: (commands: string[]) => void;
}

export function RedisAIHelper({
  open,
  onOpenChange,
  context,
  onApplyCommands,
}: RedisAIHelperProps) {
  const { settings, isConfigured } = useAIStore();

  const [mode, setMode] = useState<"commands" | "structure">("commands");
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [commands, setCommands] = useState<string[]>([]);
  const [recommendation, setRecommendation] = useState<string>("");
  const [example, setExample] = useState<string>("");
  const [explanation, setExplanation] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim() || !isConfigured()) return;

    setIsLoading(true);
    setError(null);
    setCommands([]);
    setRecommendation("");
    setExample("");
    setExplanation("");

    try {
      if (mode === "commands") {
        const response = await generateRedisCommands(prompt, context, settings);
        setCommands(response.commands);
        setExplanation(response.explanation);
      } else {
        const response = await suggestDataStructure(prompt, settings);
        setRecommendation(response.recommendation);
        setExample(response.example);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate response"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    const text =
      mode === "commands" ? commands.join("\n") : `${recommendation}\n\n${example}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    if (mode === "commands" && onApplyCommands && commands.length > 0) {
      onApplyCommands(commands);
    }
    onOpenChange(false);
  };

  const isApiConfigured = isConfigured();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-orange-600 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            Redis AI Assistant
          </DialogTitle>
          <DialogDescription>
            Generate Redis commands or get data structure recommendations.
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
            {/* Context Badges */}
            {context.selectedKey && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Selected Key:
                </span>
                <Badge variant="secondary">{context.selectedKey.key}</Badge>
                <Badge variant="outline" className="text-xs">
                  {context.selectedKey.type}
                </Badge>
              </div>
            )}

            {/* Mode Selector */}
            <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="commands" className="gap-2">
                  <Terminal className="h-4 w-4" />
                  Generate Commands
                </TabsTrigger>
                <TabsTrigger value="structure" className="gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Data Structure Advice
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Prompt Input */}
            <div className="space-y-2">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  mode === "commands"
                    ? "Describe what you want to do... (e.g., 'Store user session data with 30 minute expiry')"
                    : "Describe your use case... (e.g., 'I need to track unique visitors per day')"
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
                    {mode === "commands"
                      ? "Generate Commands"
                      : "Get Recommendation"}
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

            {/* Commands Result */}
            {mode === "commands" && commands.length > 0 && (
              <div className="flex-1 min-h-0 space-y-3">
                {explanation && (
                  <div className="p-3 rounded-lg bg-muted/50 text-sm">
                    {explanation}
                  </div>
                )}

                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
                    <span className="text-xs font-medium text-muted-foreground uppercase">
                      Redis Commands
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
                    <div className="p-3 space-y-1">
                      {commands.map((cmd, i) => (
                        <pre
                          key={i}
                          className="text-xs font-mono p-2 rounded bg-[#1e1e2e] text-green-400"
                        >
                          <code>{cmd}</code>
                        </pre>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {onApplyCommands && (
                  <Button onClick={handleApply} className="w-full gap-2">
                    <Play className="h-4 w-4" />
                    Execute Commands
                  </Button>
                )}
              </div>
            )}

            {/* Structure Recommendation Result */}
            {mode === "structure" && recommendation && (
              <div className="flex-1 min-h-0 space-y-3">
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
                    <span className="text-xs font-medium text-muted-foreground uppercase">
                      Recommendation
                    </span>
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
                  <ScrollArea className="max-h-64">
                    <div className="p-3 space-y-4">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {recommendation.split("\n").map((line, i) => (
                          <p key={i} className="text-sm">
                            {line}
                          </p>
                        ))}
                      </div>

                      {example && (
                        <div className="mt-4">
                          <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                            Example Commands
                          </p>
                          <pre className="p-3 rounded bg-[#1e1e2e] text-xs font-mono text-green-400 whitespace-pre-wrap">
                            <code>{example}</code>
                          </pre>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
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
interface RedisAIButtonProps {
  context: RedisContext;
  onApplyCommands?: (commands: string[]) => void;
}

export function RedisAIButton({
  context,
  onApplyCommands,
}: RedisAIButtonProps) {
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
        AI Commands
      </Button>
      <RedisAIHelper
        open={open}
        onOpenChange={setOpen}
        context={context}
        onApplyCommands={onApplyCommands}
      />
    </>
  );
}
