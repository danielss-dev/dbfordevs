import { useState, useRef, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

interface AIInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function AIInput({ onSend, isLoading }: AIInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [value]);

  const handleSubmit = () => {
    if (!value.trim() || isLoading) return;
    onSend(value.trim());
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-border bg-muted/30 p-4">
      <div
        className={cn(
          "flex items-end gap-2 rounded-xl border border-border bg-background p-2",
          "focus-within:ring-2 focus-within:ring-violet-500/20 focus-within:border-violet-500/50",
          "transition-all duration-200"
        )}
      >
        <div className="flex-1 min-h-[40px] flex items-center">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question or describe a query..."
            disabled={isLoading}
            rows={1}
            className={cn(
              "w-full resize-none bg-transparent px-2 py-2 text-sm",
              "placeholder:text-muted-foreground focus:outline-none",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          />
        </div>
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!value.trim() || isLoading}
          className={cn(
            "h-9 w-9 shrink-0 rounded-lg",
            "bg-gradient-to-r from-violet-500 to-purple-600",
            "hover:from-violet-600 hover:to-purple-700",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-all duration-200"
          )}
        >
          {isLoading ? (
            <Sparkles className="h-4 w-4 animate-pulse" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground text-center">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}

