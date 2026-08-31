import { useState, useEffect } from "react";
import { UploadSimple } from "@phosphor-icons/react";
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

  // Icon rail / global import action
  useEffect(() => {
    const handler = () => {
      if (tableName) setShowDialog(true);
    };
    window.addEventListener("dbfordevs:open-import", handler);
    return () => window.removeEventListener("dbfordevs:open-import", handler);
  }, [tableName]);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={() => setShowDialog(true)}
            aria-label="Import"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <UploadSimple weight="regular" className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Import</TooltipContent>
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
