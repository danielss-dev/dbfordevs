import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X, Check, Ban } from "lucide-react";

interface EditableCellProps {
  value: unknown;
  columnType: string;
  nullable: boolean;
  onSave: (value: unknown) => void;
  onCancel: () => void;
  autoFocus?: boolean;
}

export function EditableCell({
  value: initialValue,
  columnType,
  nullable,
  onSave,
  onCancel,
  autoFocus = true,
}: EditableCellProps) {
  const [value, setValue] = useState<unknown>(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      if (typeof value === "string") {
        inputRef.current.select();
      }
    }
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSave(value);
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // If we click the NULL button, don't blur/cancel yet
    if (e.relatedTarget?.getAttribute("data-null-button")) {
      return;
    }
    onSave(value);
  };

  const toggleNull = () => {
    if (value === null) {
      setValue("");
    } else {
      setValue(null);
    }
  };

  const isNumeric = columnType.toLowerCase().includes("int") || 
                  columnType.toLowerCase().includes("decimal") || 
                  columnType.toLowerCase().includes("float") || 
                  columnType.toLowerCase().includes("number") || 
                  columnType.toLowerCase().includes("double") || 
                  columnType.toLowerCase().includes("numeric");

  const isBoolean = columnType.toLowerCase().includes("bool") || 
                   columnType.toLowerCase().includes("bit");

  const renderInput = () => {
    if (value === null) {
      return (
        <div className="flex items-center gap-2 w-full px-2 py-1 bg-muted rounded border border-dashed border-border/50">
          <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">NULL</span>
        </div>
      );
    }

    if (isBoolean) {
      return (
        <select
          className="w-full bg-background border border-input rounded px-2 py-1 text-sm focus:ring-1 focus:ring-primary outline-none"
          value={String(value)}
          onChange={(e) => setValue(e.target.value === "true")}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          autoFocus
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }

    return (
      <Input
        ref={inputRef}
        type={isNumeric ? "number" : "text"}
        value={String(value)}
        onChange={(e) => {
          const val = e.target.value;
          if (isNumeric) {
            setValue(val === "" ? null : Number(val));
          } else {
            setValue(val);
          }
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="h-8 py-1 px-2 font-mono text-sm"
      />
    );
  };

  return (
    <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
      <div className="flex-1 min-w-0">
        {renderInput()}
      </div>
      {nullable && (
        <Button
          variant={value === null ? "default" : "outline"}
          size="icon"
          className={cn(
            "h-8 w-8 shrink-0",
            value === null && "bg-primary text-primary-foreground"
          )}
          onClick={toggleNull}
          data-null-button="true"
          title={value === null ? "Set to empty" : "Set to NULL"}
        >
          <Ban className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

