import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  Switch,
  Textarea,
} from "@/components/ui";
import { useAIStore } from "@/lib/ai/store";

interface ContextConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContextConfigDialog({
  open,
  onOpenChange,
}: ContextConfigDialogProps) {
  const { contextConfig, updateContextConfig, saveContextTemplate, contextTemplates } =
    useAIStore();

  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");

  const handleSaveTemplate = () => {
    if (templateName.trim()) {
      saveContextTemplate(templateName.trim(), templateDescription.trim());
      setTemplateName("");
      setTemplateDescription("");
      setShowSaveTemplate(false);
    }
  };

  const customTemplates = contextTemplates.filter((t) => !t.isBuiltIn);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>AI Context Configuration</DialogTitle>
          <DialogDescription>
            Configure what information is included in the AI context.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Foreign Keys */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Include Foreign Keys</Label>
              <p className="text-xs text-muted-foreground">
                Show table relationships and foreign key constraints
              </p>
            </div>
            <Switch
              checked={contextConfig.includeForeignKeys}
              onCheckedChange={(checked) =>
                updateContextConfig({ includeForeignKeys: checked })
              }
            />
          </div>

          {/* Indexes */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Include Indexes</Label>
              <p className="text-xs text-muted-foreground">
                Show index information for query optimization
              </p>
            </div>
            <Switch
              checked={contextConfig.includeIndexes}
              onCheckedChange={(checked) =>
                updateContextConfig({ includeIndexes: checked })
              }
            />
          </div>

          {/* Sample Data */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Include Sample Data</Label>
              <p className="text-xs text-muted-foreground">
                Show sample rows to help understand data format
              </p>
            </div>
            <Switch
              checked={contextConfig.includeSampleData}
              onCheckedChange={(checked) =>
                updateContextConfig({ includeSampleData: checked })
              }
            />
          </div>

          {/* Sample Data Rows */}
          {contextConfig.includeSampleData && (
            <div className="space-y-2">
              <Label>Sample Data Rows</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={contextConfig.sampleDataRows}
                onChange={(e) =>
                  updateContextConfig({
                    sampleDataRows: Math.min(10, Math.max(1, parseInt(e.target.value) || 1)),
                  })
                }
                className="w-24"
              />
              <p className="text-xs text-muted-foreground">
                Number of sample rows to include (1-10)
              </p>
            </div>
          )}

          {/* Max Tables */}
          <div className="space-y-2">
            <Label>Max Tables in Context</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={contextConfig.maxTablesInContext}
              onChange={(e) =>
                updateContextConfig({
                  maxTablesInContext: Math.min(50, Math.max(1, parseInt(e.target.value) || 10)),
                })
              }
              className="w-24"
            />
            <p className="text-xs text-muted-foreground">
              Maximum number of tables to include in context (1-50)
            </p>
          </div>

          {/* Save as Template */}
          <div className="border-t border-border pt-4">
            {!showSaveTemplate ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSaveTemplate(true)}
              >
                Save as Template
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="My Custom Template"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Textarea
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Describe when to use this template..."
                    className="min-h-[60px]"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowSaveTemplate(false);
                      setTemplateName("");
                      setTemplateDescription("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveTemplate}
                    disabled={!templateName.trim()}
                  >
                    Save Template
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Custom Templates List */}
          {customTemplates.length > 0 && (
            <div className="border-t border-border pt-4">
              <Label>Custom Templates</Label>
              <div className="mt-2 space-y-2">
                {customTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-2 rounded bg-muted/50"
                  >
                    <div>
                      <p className="text-sm font-medium">{template.name}</p>
                      {template.description && (
                        <p className="text-xs text-muted-foreground">
                          {template.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
