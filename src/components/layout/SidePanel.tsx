import { X, ChevronLeft, ChevronRight, Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Input, ScrollArea, Separator } from "@/components/ui";
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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{name}</label>
        <span className="text-xs text-muted-foreground">{type}</span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={isNull}
          className={cn(isNull && "bg-muted text-muted-foreground")}
          placeholder={isNull ? "NULL" : `Enter ${name}`}
        />
        {nullable && (
          <Button
            variant={isNull ? "default" : "outline"}
            size="sm"
            className="shrink-0 text-xs"
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
        "animate-slide-in-right"
      )}
      style={{ width: sidePanelWidth }}
    >
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Edit Row</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            users
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleSidePanel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">Row 1 of 100</span>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Fields */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
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

      <Separator />

      {/* Actions */}
      <div className="flex items-center justify-between p-3">
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-1 h-3 w-3" />
          Delete
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleSidePanel}>
            Cancel
          </Button>
          <Button size="sm">
            <Save className="mr-1 h-3 w-3" />
            Save
          </Button>
        </div>
      </div>
    </aside>
  );
}

