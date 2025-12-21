import { useState } from "react";
import { Loader2, FolderTree } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button, Input, Label } from "@/components/ui";
import { useDatabase } from "@/hooks";
import { useUIStore } from "@/stores";

export function CreateSchemaDialog() {
  const { executeQuery, getTables } = useDatabase();
  const {
    showCreateSchemaDialog,
    creatingSchemaConnectionId,
    setShowCreateSchemaDialog,
  } = useUIStore();

  const [schemaName, setSchemaName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!creatingSchemaConnectionId || !schemaName.trim()) return;

    // Validate schema name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schemaName.trim())) {
      setError("Schema name must start with a letter or underscore and contain only alphanumeric characters and underscores");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await executeQuery(
        {
          connectionId: creatingSchemaConnectionId,
          sql: `CREATE SCHEMA "${schemaName.trim()}"`,
        },
        "create-schema" // Dummy tabId for the store
      );

      if (result && !result.error) {
        // Refresh tables/schemas list
        await getTables(creatingSchemaConnectionId);
        setShowCreateSchemaDialog(false);
        setSchemaName("");
      } else {
        setError(result?.error || "Failed to create schema");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create schema");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!isLoading) {
      setShowCreateSchemaDialog(open);
      if (!open) {
        setSchemaName("");
        setError(null);
      }
    }
  };

  return (
    <Dialog open={showCreateSchemaDialog} onOpenChange={handleClose}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            Create Schema
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="schema-name">Schema Name</Label>
            <Input
              id="schema-name"
              value={schemaName}
              onChange={(e) => {
                setSchemaName(e.target.value);
                setError(null);
              }}
              placeholder="Enter schema name"
              disabled={isLoading}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isLoading && schemaName.trim()) {
                  handleCreate();
                }
              }}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isLoading || !schemaName.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

