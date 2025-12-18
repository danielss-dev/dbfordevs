import { X, ChevronLeft, ChevronRight, Save, Trash2, RotateCcw, Table } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Input, ScrollArea, Label } from "@/components/ui";
import { useUIStore } from "@/stores";

interface FieldEditorProps {
  name: string;
  value: unknown;
  type: string;
  nullable: boolean;
  onChange: (value: unknown) => void;
}

function FieldEditor({ name, value, type, nullable, onChange }: FieldEditorProps) {
  const stringValue = value === null ? "" : String(value);
  const isNull = value === null;

  return (
    <div className="space-y-2 p-3 rounded-lg hover:bg-muted/30 transition-colors">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{name}</Label>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
          {type}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={isNull}
          className={cn(
            "font-mono text-sm",
            isNull && "bg-muted/50 text-muted-foreground"
          )}
          placeholder={isNull ? "NULL" : `Enter ${name}`}
        />
        {nullable && (
          <Button
            variant={isNull ? "default" : "outline"}
            size="sm"
            className={cn(
              "shrink-0 text-xs font-mono h-10 px-3",
              isNull && "bg-muted-foreground/20 text-foreground hover:bg-muted-foreground/30"
            )}
            onClick={() => onChange(isNull ? "" : null)}
          >
            NULL
          </Button>
        )}
      </div>
    </div>
  );
}

export function SidePanel() {
  const { sidePanelOpen, sidePanelWidth, toggleSidePanel } = useUIStore();

  if (!sidePanelOpen) {
    return null;
  }

  // Mock data for demonstration
  const mockFields = [
    { name: "id", value: 1, type: "integer", nullable: false },
    { name: "name", value: "John Doe", type: "varchar(255)", nullable: false },
    { name: "email", value: "john@example.com", type: "varchar(255)", nullable: false },
    { name: "created_at", value: "2024-01-15 10:30:00", type: "timestamp", nullable: false },
    { name: "bio", value: null, type: "text", nullable: true },
    { name: "avatar_url", value: null, type: "varchar(500)", nullable: true },
  ];

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-l border-border bg-card",
        "animate-slide-up"
      )}
      style={{ width: sidePanelWidth }}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted">
            <Table className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <span className="text-sm font-medium">Edit Row</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">users</span>
              <span className="text-xs text-muted-foreground/50">-</span>
              <span className="text-xs text-muted-foreground">id: 1</span>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleSidePanel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-muted/30">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="px-3">
            <span className="text-sm font-medium">1</span>
            <span className="text-xs text-muted-foreground mx-1">of</span>
            <span className="text-sm font-medium">100</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      {/* Fields */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          {mockFields.map((field) => (
            <FieldEditor
              key={field.name}
              name={field.name}
              value={field.value}
              type={field.type}
              nullable={field.nullable}
              onChange={(newValue) => {
                console.log(`Field ${field.name} changed to:`, newValue);
              }}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="border-t border-border p-3 bg-muted/30">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5">
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleSidePanel}>
              Cancel
            </Button>
            <Button size="sm" className="gap-1.5">
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
