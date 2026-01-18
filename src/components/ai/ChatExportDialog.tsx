import { useState, useMemo } from "react";
import {
  Download,
  Copy,
  Check,
  FileText,
  FileJson,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Label,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ScrollArea,
} from "@/components/ui";
import { useAIStore } from "@/lib/ai/store";
import {
  exportToMarkdown,
  exportToJSON,
  downloadExport,
  generateExportFilename,
  copyToClipboard,
} from "@/lib/ai/export";
import type { ExportFormat, ExportOptions } from "@/lib/ai/types";

interface ChatExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatExportDialog({ open, onOpenChange }: ChatExportDialogProps) {
  const { getActiveSession } = useAIStore();
  const session = getActiveSession();

  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [options, setOptions] = useState<ExportOptions>({
    includeTimestamps: true,
    includeUsageStats: false,
    sqlOnly: false,
  });
  const [copied, setCopied] = useState(false);

  const preview = useMemo(() => {
    if (!session) return "";

    if (format === "json") {
      return exportToJSON(session);
    }
    return exportToMarkdown(session, options);
  }, [session, format, options]);

  const handleDownload = () => {
    if (!session) return;

    const content = format === "json" ? exportToJSON(session) : exportToMarkdown(session, options);
    const filename = generateExportFilename(session, format);
    downloadExport(content, filename, format);
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(preview);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!session) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Export Chat</DialogTitle>
          <DialogDescription>
            Export "{session.title}" to Markdown or JSON format.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4">
          {/* Format Selection */}
          <Tabs
            value={format}
            onValueChange={(v) => setFormat(v as ExportFormat)}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="markdown" className="gap-2">
                <FileText className="h-4 w-4" />
                Markdown
              </TabsTrigger>
              <TabsTrigger value="json" className="gap-2">
                <FileJson className="h-4 w-4" />
                JSON
              </TabsTrigger>
            </TabsList>

            <TabsContent value="markdown" className="mt-4">
              {/* Markdown Options */}
              <div className="space-y-3 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Include Timestamps</Label>
                  <Switch
                    checked={options.includeTimestamps}
                    onCheckedChange={(checked) =>
                      setOptions({ ...options, includeTimestamps: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Include Usage Stats</Label>
                  <Switch
                    checked={options.includeUsageStats}
                    onCheckedChange={(checked) =>
                      setOptions({ ...options, includeUsageStats: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">SQL Only Mode</Label>
                    <p className="text-xs text-muted-foreground">
                      Export only SQL queries without conversation
                    </p>
                  </div>
                  <Switch
                    checked={options.sqlOnly}
                    onCheckedChange={(checked) =>
                      setOptions({ ...options, sqlOnly: checked })
                    }
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="json" className="mt-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  JSON export includes all message data, timestamps, and usage
                  statistics in a structured format suitable for backup or
                  import.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Preview */}
          <div className="flex-1 min-h-0">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm">Preview</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5"
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <ScrollArea className="h-64 rounded-lg border border-border">
              <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">
                {preview.slice(0, 3000)}
                {preview.length > 3000 && (
                  <span className="text-muted-foreground">
                    {"\n\n... (truncated for preview)"}
                  </span>
                )}
              </pre>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleDownload} className="gap-2">
            <Download className="h-4 w-4" />
            Download {format === "json" ? ".json" : ".md"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
