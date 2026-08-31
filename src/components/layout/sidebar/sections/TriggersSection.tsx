import { useState } from "react";
import { CircleNotch, Trash, ArrowsClockwise, Copy, Lightning } from "@phosphor-icons/react";
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
import { useTriggersStore } from "@/stores";
import { useDatabase, useToast } from "@/hooks";
import type { ConnectionInfo } from "@/types";
import { copyToClipboard } from "@/lib/utils";
import { showErrorToast, showInfoToast } from "@/lib/toast-helpers";
import { TreeItem } from "../TreeItem";

export function TriggersSection({ connection }: { connection: ConnectionInfo }) {
  const triggersByConnection = useTriggersStore(state => state.triggersByConnection);
  const setTriggers = useTriggersStore(state => state.setTriggers);
  const {
    getTriggers,
    getTriggerDdl,
    dropTrigger,
  } = useDatabase();
  const { toast } = useToast();

  // Triggers section state
  const [isLoadingTriggers, setIsLoadingTriggers] = useState(false);
  const [triggerToDrop, setTriggerToDrop] = useState<string | null>(null);

  // Triggers section handlers
  const handleTriggersClick = async () => {
    if (connection.connected && !triggersByConnection[connection.id] && !isLoadingTriggers) {
      setIsLoadingTriggers(true);
      try {
        const triggers = await getTriggers(connection.id);
        setTriggers(connection.id, triggers);
      } catch (error) {
        console.error("Failed to load triggers:", error);
        showErrorToast("Failed to load triggers", error instanceof Error ? error.message : String(error));
      } finally {
        setIsLoadingTriggers(false);
      }
    }
  };

  const loadConnectionTriggers = async () => {
    setIsLoadingTriggers(true);
    try {
      const triggers = await getTriggers(connection.id);
      setTriggers(connection.id, triggers);
    } catch (error) {
      console.error("Failed to load triggers:", error);
      showErrorToast("Failed to load triggers", error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingTriggers(false);
    }
  };

  const handleCopyTriggerDdl = async (triggerName: string) => {
    try {
      const ddl = await getTriggerDdl(connection.id, triggerName);
      if (ddl) {
        const success = await copyToClipboard(ddl);
        if (success) {
          showInfoToast("DDL Copied", "Trigger definition copied to clipboard.");
        } else {
          throw new Error("Failed to copy to clipboard");
        }
      } else {
        showErrorToast("Copy Failed", "Could not get DDL for this trigger.");
      }
    } catch (error) {
      showErrorToast("Copy Failed", error instanceof Error ? error.message : String(error));
    }
  };

  const confirmTriggerDrop = async () => {
    if (!triggerToDrop) return;
    try {
      const result = await dropTrigger(connection.id, triggerToDrop);
      if (result) {
        await loadConnectionTriggers();
        toast({
          title: "Trigger dropped",
          description: `Trigger "${triggerToDrop}" has been dropped successfully.`,
          variant: "success",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to drop trigger",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setTriggerToDrop(null);
    }
  };

  // Get triggers for this connection
  const connectionTriggers = triggersByConnection[connection.id] || [];

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <TreeItem
              label="Triggers"
              icon={<Lightning weight="regular" className="h-3.5 w-3.5 text-muted-foreground" />}
              level={1}
              onClick={handleTriggersClick}
              defaultOpen={false}
            >
              {isLoadingTriggers ? (
                <div className="flex items-center gap-2 py-1.5 text-xs text-muted-foreground" style={{ paddingLeft: `${2 * 14 + 6}px` }}>
                  <CircleNotch weight="regular" className="h-3 w-3 animate-spin" />
                  <span>Loading triggers...</span>
                </div>
              ) : connectionTriggers.length > 0 ? (
                connectionTriggers.map((trigger) => (
                  <ContextMenu key={trigger.name}>
                    <ContextMenuTrigger asChild>
                      <div>
                        <TreeItem
                          label={trigger.name}
                          icon={<Lightning weight="regular" className="h-3.5 w-3.5 text-muted-foreground" />}
                          level={2}
                        />
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48">
                      <ContextMenuItem onSelect={() => handleCopyTriggerDdl(trigger.name)} className="gap-2">
                        <Copy weight="regular" className="h-4 w-4" />
                        Copy DDL
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onSelect={() => setTriggerToDrop(trigger.name)}
                        className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash weight="regular" className="h-4 w-4" />
                        Drop Trigger
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))
              ) : triggersByConnection[connection.id] ? (
                <div className="py-1.5 text-xs text-muted-foreground" style={{ paddingLeft: `${2 * 14 + 6}px` }}>No triggers found</div>
              ) : (
                <div className="flex items-center gap-2 py-1.5 text-xs text-muted-foreground" style={{ paddingLeft: `${2 * 14 + 6}px` }}>
                  <CircleNotch weight="regular" className="h-3 w-3 animate-spin" />
                  <span>Loading triggers...</span>
                </div>
              )}
            </TreeItem>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={loadConnectionTriggers} className="gap-2">
            <ArrowsClockwise weight="regular" className={cn("h-4 w-4", isLoadingTriggers && "animate-spin")} />
            Refresh
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Drop Trigger Confirmation Dialog */}
      <AlertDialog open={!!triggerToDrop} onOpenChange={(open) => !open && setTriggerToDrop(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop Trigger</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to drop the trigger "{triggerToDrop}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmTriggerDrop}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Drop Trigger
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
