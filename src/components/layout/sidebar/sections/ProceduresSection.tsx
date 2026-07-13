import { useState } from "react";
import {
  Loader2,
  Trash2,
  RefreshCw,
  Copy,
  Code2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui";
import { useProceduresStore } from "@/stores";
import { useDatabase, useToast } from "@/hooks";
import type { ConnectionInfo } from "@/types";
import { copyToClipboard } from "@/lib/utils";
import { showErrorToast, showInfoToast } from "@/lib/toast-helpers";
import { TreeItem } from "../TreeItem";

export function ProceduresSection({ connection }: { connection: ConnectionInfo }) {
  const proceduresByConnection = useProceduresStore(state => state.proceduresByConnection);
  const setProcedures = useProceduresStore(state => state.setProcedures);
  const {
    getProcedures,
    getProcedureDdl,
    dropProcedure,
  } = useDatabase();
  const { toast } = useToast();

  // Procedures section state
  const [isLoadingProcedures, setIsLoadingProcedures] = useState(false);
  const [procedureToDrop, setProcedureToDrop] = useState<string | null>(null);

  // Procedures section handlers
  const handleProceduresClick = async () => {
    if (connection.connected && !proceduresByConnection[connection.id] && !isLoadingProcedures) {
      setIsLoadingProcedures(true);
      try {
        const procedures = await getProcedures(connection.id);
        setProcedures(connection.id, procedures);
      } catch (error) {
        console.error("Failed to load procedures:", error);
        showErrorToast("Failed to load procedures", error instanceof Error ? error.message : String(error));
      } finally {
        setIsLoadingProcedures(false);
      }
    }
  };

  const loadConnectionProcedures = async () => {
    setIsLoadingProcedures(true);
    try {
      const procedures = await getProcedures(connection.id);
      setProcedures(connection.id, procedures);
    } catch (error) {
      console.error("Failed to load procedures:", error);
      showErrorToast("Failed to load procedures", error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingProcedures(false);
    }
  };

  const handleCopyProcedureDdl = async (procedureName: string) => {
    try {
      const ddl = await getProcedureDdl(connection.id, procedureName);
      if (ddl) {
        const success = await copyToClipboard(ddl);
        if (success) {
          showInfoToast("DDL Copied", "Procedure definition copied to clipboard.");
        } else {
          throw new Error("Failed to copy to clipboard");
        }
      } else {
        showErrorToast("Copy Failed", "Could not get DDL for this procedure.");
      }
    } catch (error) {
      showErrorToast("Copy Failed", error instanceof Error ? error.message : String(error));
    }
  };

  const confirmProcedureDrop = async () => {
    if (!procedureToDrop) return;
    try {
      const result = await dropProcedure(connection.id, procedureToDrop);
      if (result) {
        await loadConnectionProcedures();
        toast({
          title: "Procedure dropped",
          description: `Procedure "${procedureToDrop}" has been dropped successfully.`,
          variant: "success",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to drop procedure",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setProcedureToDrop(null);
    }
  };

  // Get procedures for this connection
  const connectionProcedures = proceduresByConnection[connection.id] || [];

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <TreeItem
              label="Stored Procedures"
              icon={<Code2 className="h-3.5 w-3.5 text-muted-foreground" />}
              onClick={handleProceduresClick}
              defaultOpen={false}
            >
              {isLoadingProcedures ? (
                <div className="ml-6 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading procedures...</span>
                </div>
              ) : connectionProcedures.length > 0 ? (
                connectionProcedures.map((proc) => (
                  <ContextMenu key={proc.name}>
                    <ContextMenuTrigger asChild>
                      <div>
                        <TreeItem
                          label={proc.name}
                          icon={<Code2 className="h-3.5 w-3.5 text-muted-foreground" />}
                          level={1}
                        />
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48">
                      <ContextMenuItem onSelect={() => handleCopyProcedureDdl(proc.name)} className="gap-2">
                        <Copy className="h-4 w-4" />
                        Copy DDL
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onSelect={() => setProcedureToDrop(proc.name)}
                        className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                        Drop Procedure
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))
              ) : proceduresByConnection[connection.id] ? (
                <div className="ml-6 py-2 text-xs text-muted-foreground">No procedures found</div>
              ) : (
                <div className="ml-6 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading procedures...</span>
                </div>
              )}
            </TreeItem>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={loadConnectionProcedures} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", isLoadingProcedures && "animate-spin")} />
            Refresh
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Drop Procedure Confirmation Dialog */}
      <AlertDialog open={!!procedureToDrop} onOpenChange={(open) => !open && setProcedureToDrop(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop Procedure</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to drop the procedure "{procedureToDrop}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmProcedureDrop}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Drop Procedure
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
