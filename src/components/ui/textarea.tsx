import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm transition-all duration-150 ease-swift",
          "placeholder:text-muted-foreground/70",
          "hover:border-muted-foreground/50",
          "focus-visible:outline-none focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_var(--accent-glow)]",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
          "resize-none",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
