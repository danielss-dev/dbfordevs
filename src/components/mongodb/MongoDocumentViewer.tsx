import { useState, useCallback } from "react";
import { ChevronRight, ChevronDown, Copy, Check, Edit2, Save, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Tooltip, TooltipContent, TooltipTrigger, Textarea } from "@/components/ui";
import { useMongoDB, useToast } from "@/hooks";

interface MongoDocumentViewerProps {
  document: unknown;
  connectionId?: string;
  database?: string;
  collection?: string;
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
    if (value === undefined) return <span className="text-muted-foreground">undefined</span>;
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
                <Check className="h-3 w-3 text-success" />
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

export function MongoDocumentViewer({ document, connectionId, database, collection, className }: MongoDocumentViewerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentDoc, setCurrentDoc] = useState(document);
  const { replaceDocument } = useMongoDB();
  const { toast } = useToast();

  const canEdit = !!(connectionId && database && collection);

  const handleStartEdit = useCallback(() => {
    setEditValue(JSON.stringify(currentDoc, null, 2));
    setEditError(null);
    setIsEditing(true);
  }, [currentDoc]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditError(null);
  }, []);

  const handleEditChange = useCallback((text: string) => {
    setEditValue(text);
    if (text.trim()) {
      try {
        JSON.parse(text);
        setEditError(null);
      } catch (e) {
        setEditError(e instanceof Error ? e.message : "Invalid JSON");
      }
    } else {
      setEditError(null);
    }
  }, []);

  const handleFormat = useCallback(() => {
    try {
      const parsed = JSON.parse(editValue);
      setEditValue(JSON.stringify(parsed, null, 2));
      setEditError(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }, [editValue]);

  const handleSave = useCallback(async () => {
    if (!connectionId || !database || !collection) return;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(editValue);
    } catch {
      return;
    }

    // Extract _id for the filter
    const docAny = currentDoc as { _id?: { $oid?: string } | string };
    const id = typeof docAny._id === "object" && docAny._id?.$oid
      ? docAny._id.$oid
      : String(docAny._id || "");

    if (!id) {
      setEditError("Cannot save: document has no _id field");
      return;
    }

    // Remove _id from the replacement document (MongoDB doesn't allow changing _id)
    const { _id: _removedId, ...replacement } = parsed;
    void _removedId;

    const filter = typeof docAny._id === "object" && docAny._id?.$oid
      ? JSON.stringify({ _id: { $oid: id } })
      : JSON.stringify({ _id: id });

    setSaving(true);
    try {
      const result = await replaceDocument(
        connectionId,
        database,
        collection,
        filter,
        JSON.stringify(replacement)
      );

      if (result && result.modifiedCount > 0) {
        setCurrentDoc(parsed);
        setIsEditing(false);
        toast({
          title: "Document updated",
          description: "The document has been saved successfully.",
        });
      } else {
        setEditError("No documents were modified. The document may have been changed or deleted.");
      }
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to save document");
    } finally {
      setSaving(false);
    }
  }, [connectionId, database, collection, editValue, currentDoc, replaceDocument, toast]);

  if (currentDoc === null || currentDoc === undefined) {
    return (
      <div className={cn("p-4 text-muted-foreground", className)}>
        No document to display
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
        {!isEditing ? (
          <>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={handleStartEdit}>
                <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
            )}
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={handleFormat}>
              Format JSON
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={handleCancelEdit}>
              <X className="h-3.5 w-3.5 mr-1.5" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!!editError || saving}>
              {saving ? (
                "Saving..."
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Save
                </>
              )}
            </Button>
          </>
        )}
      </div>

      {/* Content */}
      {isEditing ? (
        <div className="flex-1 relative p-4 overflow-auto">
          <Textarea
            value={editValue}
            onChange={(e) => handleEditChange(e.target.value)}
            className={cn(
              "min-h-full h-full font-mono text-sm resize-none",
              editError && "border-destructive focus-visible:ring-destructive"
            )}
          />
          {editError && (
            <div className="absolute bottom-6 left-6 right-6 flex items-center gap-2 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span className="truncate">{editError}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 font-mono text-sm p-4 overflow-auto">
          <JsonNode value={currentDoc} level={0} isLast={true} />
        </div>
      )}
    </div>
  );
}
