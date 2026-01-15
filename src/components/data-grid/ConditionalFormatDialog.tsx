import * as React from "react";
import {
  Paintbrush,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGridStore } from "@/stores/grid";
import type { ColumnInfo, ConditionalFormatRule, ConditionalOperator } from "@/types";
import { cn } from "@/lib/utils";

interface ConditionalFormatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ColumnInfo[];
}

const OPERATORS: { value: ConditionalOperator; label: string; needsValue: boolean; needsValue2?: boolean }[] = [
  { value: "equals", label: "Equals", needsValue: true },
  { value: "notEquals", label: "Not equals", needsValue: true },
  { value: "contains", label: "Contains", needsValue: true },
  { value: "notContains", label: "Does not contain", needsValue: true },
  { value: "startsWith", label: "Starts with", needsValue: true },
  { value: "endsWith", label: "Ends with", needsValue: true },
  { value: "gt", label: "Greater than", needsValue: true },
  { value: "gte", label: "Greater than or equal", needsValue: true },
  { value: "lt", label: "Less than", needsValue: true },
  { value: "lte", label: "Less than or equal", needsValue: true },
  { value: "between", label: "Between", needsValue: true, needsValue2: true },
  { value: "isNull", label: "Is NULL", needsValue: false },
  { value: "isNotNull", label: "Is not NULL", needsValue: false },
  { value: "regex", label: "Matches regex", needsValue: true },
];

const PRESET_COLORS = [
  { bg: "#fef2f2", text: "#dc2626", name: "Red" },
  { bg: "#fff7ed", text: "#ea580c", name: "Orange" },
  { bg: "#fefce8", text: "#ca8a04", name: "Yellow" },
  { bg: "#f0fdf4", text: "#16a34a", name: "Green" },
  { bg: "#eff6ff", text: "#2563eb", name: "Blue" },
  { bg: "#faf5ff", text: "#9333ea", name: "Purple" },
];

export function ConditionalFormatDialog({
  open,
  onOpenChange,
  columns,
}: ConditionalFormatDialogProps) {
  const {
    conditionalRules,
    addConditionalRule,
    updateConditionalRule,
    removeConditionalRule,
    toggleConditionalRule,
    reorderConditionalRules,
  } = useGridStore();

  const [expandedRule, setExpandedRule] = React.useState<string | null>(null);

  const handleAddRule = () => {
    addConditionalRule({
      name: `Rule ${conditionalRules.length + 1}`,
      column: "*",
      condition: { type: "equals", value: "" },
      style: { backgroundColor: "#fef2f2", textColor: "#dc2626" },
      enabled: true,
      priority: conditionalRules.length,
    });
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...conditionalRules.map((r) => r.id)];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    reorderConditionalRules(newOrder);
  };

  const handleMoveDown = (index: number) => {
    if (index === conditionalRules.length - 1) return;
    const newOrder = [...conditionalRules.map((r) => r.id)];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    reorderConditionalRules(newOrder);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paintbrush className="h-5 w-5" />
            Conditional Formatting Rules
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-2">
            {conditionalRules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Paintbrush className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No conditional formatting rules</p>
                <p className="text-sm">Add a rule to highlight cells based on their values</p>
              </div>
            ) : (
              conditionalRules.map((rule, index) => (
                <RuleEditor
                  key={rule.id}
                  rule={rule}
                  columns={columns}
                  isExpanded={expandedRule === rule.id}
                  onToggleExpand={() =>
                    setExpandedRule(expandedRule === rule.id ? null : rule.id)
                  }
                  onUpdate={(updates) => updateConditionalRule(rule.id, updates)}
                  onToggle={() => toggleConditionalRule(rule.id)}
                  onDelete={() => removeConditionalRule(rule.id)}
                  onMoveUp={() => handleMoveUp(index)}
                  onMoveDown={() => handleMoveDown(index)}
                  canMoveUp={index > 0}
                  canMoveDown={index < conditionalRules.length - 1}
                />
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="outline" className="gap-1.5" onClick={handleAddRule}>
            <Plus className="h-4 w-4" />
            Add Rule
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RuleEditorProps {
  rule: ConditionalFormatRule;
  columns: ColumnInfo[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<ConditionalFormatRule>) => void;
  onToggle: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

function RuleEditor({
  rule,
  columns,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onToggle,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: RuleEditorProps) {
  const operator = OPERATORS.find((o) => o.value === rule.condition.type);

  return (
    <div
      className={cn(
        "border rounded-lg transition-colors",
        rule.enabled ? "bg-background" : "bg-muted/50 opacity-60"
      )}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 p-2 cursor-pointer"
        onClick={onToggleExpand}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded border"
              style={{
                backgroundColor: rule.style.backgroundColor,
                borderColor: rule.style.textColor,
              }}
            />
            <span className="font-medium truncate">{rule.name}</span>
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {rule.column === "*" ? "All columns" : rule.column} {operator?.label.toLowerCase()} {rule.condition.value}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            disabled={!canMoveUp}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            disabled={!canMoveDown}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Switch
            checked={rule.enabled}
            onCheckedChange={() => onToggle()}
            onClick={(e) => e.stopPropagation()}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded editor */}
      {isExpanded && (
        <div className="border-t p-3 space-y-3">
          {/* Name */}
          <div className="grid grid-cols-4 gap-2 items-center">
            <Label className="text-right text-sm">Name</Label>
            <Input
              value={rule.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="col-span-3 h-8"
            />
          </div>

          {/* Column */}
          <div className="grid grid-cols-4 gap-2 items-center">
            <Label className="text-right text-sm">Column</Label>
            <Select
              value={rule.column}
              onValueChange={(v) => onUpdate({ column: v })}
            >
              <SelectTrigger className="col-span-3 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="*">All columns</SelectItem>
                {columns.map((col) => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Condition */}
          <div className="grid grid-cols-4 gap-2 items-center">
            <Label className="text-right text-sm">Condition</Label>
            <Select
              value={rule.condition.type}
              onValueChange={(v) =>
                onUpdate({
                  condition: { ...rule.condition, type: v as ConditionalOperator },
                })
              }
            >
              <SelectTrigger className="col-span-3 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Value */}
          {operator?.needsValue && (
            <div className="grid grid-cols-4 gap-2 items-center">
              <Label className="text-right text-sm">Value</Label>
              <Input
                value={String(rule.condition.value ?? "")}
                onChange={(e) =>
                  onUpdate({
                    condition: { ...rule.condition, value: e.target.value },
                  })
                }
                className="col-span-3 h-8"
                placeholder="Enter value..."
              />
            </div>
          )}

          {/* Value2 for between */}
          {operator?.needsValue2 && (
            <div className="grid grid-cols-4 gap-2 items-center">
              <Label className="text-right text-sm">And</Label>
              <Input
                type="number"
                value={String(rule.condition.value2 ?? "")}
                onChange={(e) =>
                  onUpdate({
                    condition: { ...rule.condition, value2: parseFloat(e.target.value) },
                  })
                }
                className="col-span-3 h-8"
                placeholder="Enter second value..."
              />
            </div>
          )}

          {/* Style */}
          <div className="grid grid-cols-4 gap-2 items-center">
            <Label className="text-right text-sm">Style</Label>
            <div className="col-span-3 flex gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color.name}
                  className={cn(
                    "w-6 h-6 rounded border-2 transition-all",
                    rule.style.backgroundColor === color.bg
                      ? "border-primary scale-110"
                      : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: color.bg }}
                  onClick={() =>
                    onUpdate({
                      style: { ...rule.style, backgroundColor: color.bg, textColor: color.text },
                    })
                  }
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Custom colors */}
          <div className="grid grid-cols-4 gap-2 items-center">
            <Label className="text-right text-sm">Custom</Label>
            <div className="col-span-3 flex gap-2 items-center">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">BG:</span>
                <input
                  type="color"
                  value={rule.style.backgroundColor || "#ffffff"}
                  onChange={(e) =>
                    onUpdate({
                      style: { ...rule.style, backgroundColor: e.target.value },
                    })
                  }
                  className="w-6 h-6 rounded cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Text:</span>
                <input
                  type="color"
                  value={rule.style.textColor || "#000000"}
                  onChange={(e) =>
                    onUpdate({
                      style: { ...rule.style, textColor: e.target.value },
                    })
                  }
                  className="w-6 h-6 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="grid grid-cols-4 gap-2 items-center">
            <Label className="text-right text-sm">Preview</Label>
            <div
              className="col-span-3 px-3 py-1.5 rounded text-sm"
              style={{
                backgroundColor: rule.style.backgroundColor,
                color: rule.style.textColor,
                fontWeight: rule.style.fontWeight,
                fontStyle: rule.style.fontStyle,
              }}
            >
              Sample cell value
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
