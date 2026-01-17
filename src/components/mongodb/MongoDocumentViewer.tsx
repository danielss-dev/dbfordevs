import { useState } from "react";
import { ChevronRight, ChevronDown, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";

interface MongoDocumentViewerProps {
  document: unknown;
  className?: string;
}

interface JsonNodeProps {
  keyName?: string;
  value: unknown;
  level: number;
  isLast: boolean;
}

function JsonNode({ keyName, value, level, isLast }: JsonNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const [copied, setCopied] = useState(false);

  const isObject = value !== null && typeof value === "object" && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getValueDisplay = () => {
    if (value === null) return <span className="text-orange-500">null</span>;
    if (value === undefined) return <span className="text-gray-500">undefined</span>;
    if (typeof value === "boolean") return <span className="text-purple-500">{String(value)}</span>;
    if (typeof value === "number") return <span className="text-blue-500">{value}</span>;
    if (typeof value === "string") return <span className="text-green-500">"{value}"</span>;
    return null;
  };

  const indent = level * 16;

  if (!isExpandable) {
    return (
      <div className="flex items-center group" style={{ paddingLeft: indent }}>
        <span className="w-4" />
        {keyName !== undefined && (
          <>
            <span className="text-cyan-500">"{keyName}"</span>
            <span className="text-muted-foreground">: </span>
          </>
        )}
        {getValueDisplay()}
        {!isLast && <span className="text-muted-foreground">,</span>}
      </div>
    );
  }

  const entries = isArray ? value : Object.entries(value as Record<string, unknown>);
  const isEmpty = isArray ? value.length === 0 : Object.keys(value as object).length === 0;
  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";

  return (
    <div className="group/node">
      <div
        className="flex items-center hover:bg-muted/50 cursor-pointer"
        style={{ paddingLeft: indent }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <button className="w-4 flex items-center justify-center">
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
        {keyName !== undefined && (
          <>
            <span className="text-cyan-500">"{keyName}"</span>
            <span className="text-muted-foreground">: </span>
          </>
        )}
        <span className="text-muted-foreground">{openBracket}</span>
        {!isExpanded && (
          <>
            <span className="text-muted-foreground mx-1">...</span>
            <span className="text-muted-foreground">{closeBracket}</span>
            {!isLast && <span className="text-muted-foreground">,</span>}
          </>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-2 opacity-0 group-hover/node:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy value</TooltipContent>
        </Tooltip>
      </div>

      {isExpanded && (
        <>
          {isEmpty ? (
            <div style={{ paddingLeft: indent + 16 }}>
              <span className="text-muted-foreground italic">empty</span>
            </div>
          ) : isArray ? (
            (value as unknown[]).map((item, index) => (
              <JsonNode
                key={index}
                value={item}
                level={level + 1}
                isLast={index === (value as unknown[]).length - 1}
              />
            ))
          ) : (
            (entries as [string, unknown][]).map(([key, val], index) => (
              <JsonNode
                key={key}
                keyName={key}
                value={val}
                level={level + 1}
                isLast={index === (entries as [string, unknown][]).length - 1}
              />
            ))
          )}
          <div style={{ paddingLeft: indent }}>
            <span className="w-4 inline-block" />
            <span className="text-muted-foreground">{closeBracket}</span>
            {!isLast && <span className="text-muted-foreground">,</span>}
          </div>
        </>
      )}
    </div>
  );
}

export function MongoDocumentViewer({ document, className }: MongoDocumentViewerProps) {
  if (document === null || document === undefined) {
    return (
      <div className={cn("p-4 text-muted-foreground", className)}>
        No document to display
      </div>
    );
  }

  return (
    <div className={cn("font-mono text-sm p-4 overflow-auto", className)}>
      <JsonNode value={document} level={0} isLast={true} />
    </div>
  );
}
