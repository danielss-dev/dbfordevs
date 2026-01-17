import { useState, useCallback } from "react";
import { AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Textarea } from "@/components/ui";

interface MongoDocumentEditorProps {
  initialValue?: string;
  onSave: (document: string) => Promise<void>;
  onCancel: () => void;
}

export function MongoDocumentEditor({ initialValue = "{}", onSave, onCancel }: MongoDocumentEditorProps) {
  const [value, setValue] = useState(() => {
    try {
      // Pretty print initial value if it's valid JSON
      const parsed = JSON.parse(initialValue);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return initialValue;
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validateJson = useCallback((text: string): boolean => {
    try {
      JSON.parse(text);
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
      return false;
    }
  }, []);

  const handleChange = (newValue: string) => {
    setValue(newValue);
    if (newValue.trim()) {
      validateJson(newValue);
    } else {
      setError(null);
    }
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(value);
      setValue(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  };

  const handleSave = async () => {
    if (!validateJson(value)) return;

    setSaving(true);
    try {
      await onSave(value);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Textarea
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className={cn(
            "min-h-[300px] font-mono text-sm resize-none",
            error && "border-destructive focus-visible:ring-destructive"
          )}
          placeholder='{ "key": "value" }'
        />
        {error && (
          <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={handleFormat}>
          Format JSON
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!!error || saving}>
            {saving ? (
              <>Saving...</>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
