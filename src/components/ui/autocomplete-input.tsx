import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import { ScrollArea } from "./scroll-area";

export interface AutocompleteOption {
  value: string;
  label?: string;
  description?: string;
}

export interface AutocompleteInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  options: AutocompleteOption[];
  value: string;
  onChange: (value: string) => void;
  emptyText?: string;
  /** Enable comma-separated multi-value input */
  multiValue?: boolean;
}

const AutocompleteInput = React.forwardRef<HTMLInputElement, AutocompleteInputProps>(
  ({ className, options, value, onChange, emptyText = "No matches found", placeholder, multiValue = false, ...props }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [filteredOptions, setFilteredOptions] = useState<AutocompleteOption[]>([]);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Combine refs using callback ref pattern
    const combinedRef = useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
        }
      },
      [ref]
    );

    // Get the current token being typed (for multi-value mode)
    const getCurrentToken = useCallback((val: string): string => {
      if (!multiValue) return val;
      const parts = val.split(",");
      return parts[parts.length - 1].trim();
    }, [multiValue]);

    // Get already selected values (for multi-value mode)
    const getSelectedValues = useCallback((val: string): Set<string> => {
      if (!multiValue) return new Set();
      const parts = val.split(",").map(p => p.trim());
      // The last part is the current token being typed, exclude it
      parts.pop();
      // All other non-empty parts are selected values
      return new Set(parts.filter(Boolean));
    }, [multiValue]);

    // Filter options based on input
    useEffect(() => {
      const currentToken = getCurrentToken(value);
      const selectedValues = getSelectedValues(value);

      // Filter out already selected values in multi-value mode
      let availableOptions = multiValue
        ? options.filter(opt => !selectedValues.has(opt.value))
        : options;

      if (!currentToken.trim()) {
        setFilteredOptions(availableOptions.slice(0, 50)); // Show first 50 when empty
      } else {
        const query = currentToken.toLowerCase();
        const filtered = availableOptions.filter(
          (opt) =>
            opt.value.toLowerCase().includes(query) ||
            opt.label?.toLowerCase().includes(query) ||
            opt.description?.toLowerCase().includes(query)
        );
        setFilteredOptions(filtered.slice(0, 50)); // Limit to 50 results
      }
      setHighlightedIndex(0);
    }, [value, options, multiValue, getCurrentToken, getSelectedValues]);

    // Handle click outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Scroll highlighted item into view
    useEffect(() => {
      if (listRef.current && highlightedIndex >= 0) {
        const items = listRef.current.querySelectorAll("[data-option]");
        const item = items[highlightedIndex];
        if (item) {
          item.scrollIntoView({ block: "nearest" });
        }
      }
    }, [highlightedIndex]);

    const handleSelect = useCallback(
      (option: AutocompleteOption) => {
        if (multiValue) {
          // In multi-value mode, replace just the current token
          const parts = value.split(",").map(p => p.trim());
          parts[parts.length - 1] = option.value;
          onChange(parts.join(", ") + ", ");
          // Keep dropdown open in multi-value mode for continued selection
        } else {
          onChange(option.value);
          setIsOpen(false);
        }
        inputRef.current?.focus();
      },
      [onChange, multiValue, value]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen) {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            setIsOpen(true);
            e.preventDefault();
          }
          return;
        }

        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            setHighlightedIndex((prev) =>
              prev < filteredOptions.length - 1 ? prev + 1 : prev
            );
            break;
          case "ArrowUp":
            e.preventDefault();
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
            break;
          case "Enter":
            e.preventDefault();
            if (filteredOptions[highlightedIndex]) {
              handleSelect(filteredOptions[highlightedIndex]);
            }
            break;
          case "Escape":
            e.preventDefault();
            setIsOpen(false);
            break;
          case "Tab":
            setIsOpen(false);
            break;
        }
      },
      [isOpen, filteredOptions, highlightedIndex, handleSelect]
    );

    return (
      <div ref={containerRef} className="relative">
        <Input
          ref={combinedRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn("font-mono text-sm", className)}
          autoComplete="off"
          {...props}
        />

        {isOpen && (
          <div className="absolute z-[100] mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
            <ScrollArea className="max-h-[200px]">
              <div ref={listRef} className="p-1">
                {filteredOptions.length === 0 ? (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    {emptyText}
                  </div>
                ) : (
                  filteredOptions.map((option, index) => (
                    <button
                      key={option.value}
                      type="button"
                      data-option
                      className={cn(
                        "flex w-full items-center gap-2 rounded-sm px-2 py-[var(--pad-menu-y)] text-sm cursor-pointer",
                        "hover:bg-accent hover:text-accent-foreground",
                        "focus:bg-accent focus:text-accent-foreground focus:outline-none",
                        index === highlightedIndex && "bg-accent text-accent-foreground"
                      )}
                      onClick={() => handleSelect(option)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <span className="flex-1 truncate font-mono text-left">
                        {option.label || option.value}
                      </span>
                      {option.description && (
                        <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {option.description}
                        </span>
                      )}
                      {!multiValue && value === option.value && (
                        <Check className="h-4 w-4 shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    );
  }
);
AutocompleteInput.displayName = "AutocompleteInput";

export { AutocompleteInput };
