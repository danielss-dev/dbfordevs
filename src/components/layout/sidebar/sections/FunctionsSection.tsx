import { useState } from "react";
import { CircleNotch, Trash, ArrowsClockwise, Copy, Function } from "@phosphor-icons/react";
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
import { useFunctionsStore } from "@/stores";
import { useDatabase, useToast } from "@/hooks";
import type { ConnectionInfo } from "@/types";
import { copyToClipboard } from "@/lib/utils";
import { showErrorToast, showInfoToast } from "@/lib/toast-helpers";
import { TreeItem } from "../TreeItem";

export function FunctionsSection({ connection }: { connection: ConnectionInfo }) {
  const functionsByConnection = useFunctionsStore(state => state.functionsByConnection);
  const setFunctions = useFunctionsStore(state => state.setFunctions);
  const {
    getFunctions,
    getFunctionDdl,
    dropFunction,
  } = useDatabase();
  const { toast } = useToast();

  // Functions section state
  const [isLoadingFunctions, setIsLoadingFunctions] = useState(false);
  const [functionToDrop, setFunctionToDrop] = useState<string | null>(null);

  // Functions section handlers
  const handleFunctionsClick = async () => {
    if (connection.connected && !functionsByConnection[connection.id] && !isLoadingFunctions) {
      setIsLoadingFunctions(true);
      try {
        const functions = await getFunctions(connection.id);
        setFunctions(connection.id, functions);
      } catch (error) {
        console.error("Failed to load functions:", error);
        showErrorToast("Failed to load functions", error instanceof Error ? error.message : String(error));
      } finally {
        setIsLoadingFunctions(false);
      }
    }
  };

  const loadConnectionFunctions = async () => {
    setIsLoadingFunctions(true);
    try {
      const functions = await getFunctions(connection.id);
      setFunctions(connection.id, functions);
    } catch (error) {
      console.error("Failed to load functions:", error);
      showErrorToast("Failed to load functions", error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingFunctions(false);
    }
  };

  const handleCopyFunctionDdl = async (functionName: string) => {
    try {
      const ddl = await getFunctionDdl(connection.id, functionName);
      if (ddl) {
        const success = await copyToClipboard(ddl);
        if (success) {
          showInfoToast("DDL Copied", "Function definition copied to clipboard.");
        } else {
          throw new Error("Failed to copy to clipboard");
        }
      } else {
        showErrorToast("Copy Failed", "Could not get DDL for this function.");
      }
    } catch (error) {
      showErrorToast("Copy Failed", error instanceof Error ? error.message : String(error));
    }
  };

  const confirmFunctionDrop = async () => {
    if (!functionToDrop) return;
    try {
      const result = await dropFunction(connection.id, functionToDrop);
      if (result) {
        await loadConnectionFunctions();
        toast({
          title: "Function dropped",
          description: `Function "${functionToDrop}" has been dropped successfully.`,
          variant: "success",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to drop function",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setFunctionToDrop(null);
    }
  };

  // Get functions for this connection
  const connectionFunctions = functionsByConnection[connection.id] || [];

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <TreeItem
              label="Functions"
              icon={<Function weight="regular" className="h-3.5 w-3.5 text-muted-foreground" />}
              level={1}
              onClick={handleFunctionsClick}
              defaultOpen={false}
            >
              {isLoadingFunctions ? (
                <div className="flex items-center gap-2 py-1.5 text-xs text-muted-foreground" style={{ paddingLeft: `${2 * 14 + 6}px` }}>
                  <CircleNotch weight="regular" className="h-3 w-3 animate-spin" />
                  <span>Loading functions...</span>
                </div>
              ) : connectionFunctions.length > 0 ? (
                connectionFunctions.map((func) => (
                  <ContextMenu key={func.name}>
                    <ContextMenuTrigger asChild>
                      <div>
                        <TreeItem
                          label={func.name}
                          icon={<Function weight="regular" className="h-3.5 w-3.5 text-muted-foreground" />}
                          level={2}
                        />
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48">
                      <ContextMenuItem onSelect={() => handleCopyFunctionDdl(func.name)} className="gap-2">
                        <Copy weight="regular" className="h-4 w-4" />
                        Copy DDL
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onSelect={() => setFunctionToDrop(func.name)}
                        className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash weight="regular" className="h-4 w-4" />
                        Drop Function
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))
              ) : functionsByConnection[connection.id] ? (
                <div className="py-1.5 text-xs text-muted-foreground" style={{ paddingLeft: `${2 * 14 + 6}px` }}>No functions found</div>
              ) : (
                <div className="flex items-center gap-2 py-1.5 text-xs text-muted-foreground" style={{ paddingLeft: `${2 * 14 + 6}px` }}>
                  <CircleNotch weight="regular" className="h-3 w-3 animate-spin" />
                  <span>Loading functions...</span>
                </div>
              )}
            </TreeItem>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={loadConnectionFunctions} className="gap-2">
            <ArrowsClockwise weight="regular" className={cn("h-4 w-4", isLoadingFunctions && "animate-spin")} />
            Refresh
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Drop Function Confirmation Dialog */}
      <AlertDialog open={!!functionToDrop} onOpenChange={(open) => !open && setFunctionToDrop(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop Function</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to drop the function "{functionToDrop}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmFunctionDrop}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Drop Function
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
