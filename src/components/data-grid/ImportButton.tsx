import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ImportDialog } from "./ImportDialog";

interface ImportButtonProps {
  connectionId: string;
  tableName?: string;
  onImportComplete?: () => void;
}

export function ImportButton({ connectionId, tableName, onImportComplete }: ImportButtonProps) {
  const [showDialog, setShowDialog] = useState(false);

  const disabled = !tableName;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => setShowDialog(true)}
            className="gap-2"
          >
            <Upload className="h-3.5 w-3.5" />
            Import
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {disabled ? "Select a table to import data" : "Import data from file"}
        </TooltipContent>
      </Tooltip>

      {tableName && (
        <ImportDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          connectionId={connectionId}
          tableName={tableName}
          onImportComplete={onImportComplete}
        />
      )}
    </>
  );
}
