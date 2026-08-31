import { useState } from "react";
import { Chat, Lightning, MagnifyingGlass, Sparkle, Trash, Plus } from "@phosphor-icons/react";
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
  Textarea,
  ScrollArea,
} from "@/components/ui";
import { useAIStore } from "@/lib/ai/store";
import type { ChatTemplate } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

interface ChatTemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TEMPLATE_ICONS: Record<string, typeof Chat> = {
  "query-builder": Chat,
  "query-optimization": Lightning,
  "data-exploration": MagnifyingGlass,
};

function TemplateCard({
  template,
  onSelect,
  onDelete,
}: {
  template: ChatTemplate;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  const Icon = TEMPLATE_ICONS[template.id] || Sparkle;

  return (
    <div
      className={cn(
        "relative group p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors cursor-pointer",
        !template.isBuiltIn && "pr-10"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
          <Icon weight="regular" className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm">{template.name}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {template.description}
          </p>
          {template.starterPrompts.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {template.starterPrompts.slice(0, 2).map((prompt, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                >
                  {prompt.slice(0, 25)}
                  {prompt.length > 25 && "..."}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {!template.isBuiltIn && onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash weight="regular" className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </Button>
      )}
    </div>
  );
}

export function ChatTemplateSelector({
  open,
  onOpenChange,
}: ChatTemplateSelectorProps) {
  const {
    chatTemplates,
    createSessionFromTemplate,
    saveChatAsTemplate,
    deleteChatTemplate,
    getActiveSession,
  } = useAIStore();

  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");

  const activeSession = getActiveSession();
  const canSaveAsTemplate = activeSession && activeSession.messages.length > 0;

  const builtInTemplates = chatTemplates.filter((t) => t.isBuiltIn);
  const customTemplates = chatTemplates.filter((t) => !t.isBuiltIn);

  const handleSelectTemplate = (templateId: string) => {
    createSessionFromTemplate(templateId);
    onOpenChange(false);
  };

  const handleSaveAsTemplate = () => {
    if (templateName.trim()) {
      saveChatAsTemplate(templateName.trim(), templateDescription.trim());
      setTemplateName("");
      setTemplateDescription("");
      setShowSaveTemplate(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Chat Templates</DialogTitle>
          <DialogDescription>
            Start a new chat from a template or save your current chat as a
            template.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Built-in Templates */}
            <div>
              <h3 className="text-sm font-medium mb-3">Built-in Templates</h3>
              <div className="space-y-2">
                {builtInTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onSelect={() => handleSelectTemplate(template.id)}
                  />
                ))}
              </div>
            </div>

            {/* Custom Templates */}
            {customTemplates.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3">Custom Templates</h3>
                <div className="space-y-2">
                  {customTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onSelect={() => handleSelectTemplate(template.id)}
                      onDelete={() => deleteChatTemplate(template.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Save Current Chat as Template */}
            {canSaveAsTemplate && (
              <div className="border-t border-border pt-4">
                {!showSaveTemplate ? (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => setShowSaveTemplate(true)}
                  >
                    <Plus weight="regular" className="h-4 w-4" />
                    Save Current Chat as Template
                  </Button>
                ) : (
                  <div className="space-y-3 p-4 rounded-lg border border-border">
                    <h4 className="font-medium text-sm">
                      Save as Template
                    </h4>
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
                        onClick={handleSaveAsTemplate}
                        disabled={!templateName.trim()}
                      >
                        Save Template
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
