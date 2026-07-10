import { useState } from "react";
import {
  Loader2,
  Trash2,
  RefreshCw,
  Copy,
  Hash,
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
import { useSequencesStore } from "@/stores";
import { useDatabase, useToast } from "@/hooks";
import type { ConnectionInfo } from "@/types";
import { copyToClipboard } from "@/lib/utils";
import { showErrorToast, showInfoToast } from "@/lib/toast-helpers";
import { TreeItem } from "../TreeItem";

export function SequencesSection({ connection }: { connection: ConnectionInfo }) {
  const sequencesByConnection = useSequencesStore(state => state.sequencesByConnection);
  const setSequences = useSequencesStore(state => state.setSequences);
  const {
    getSequences,
    getSequenceDdl,
    dropSequence,
  } = useDatabase();
  const { toast } = useToast();

  // Sequences section state
  const [isLoadingSequences, setIsLoadingSequences] = useState(false);
  const [sequenceToDrop, setSequenceToDrop] = useState<string | null>(null);

  // Sequences section handlers
  const handleSequencesClick = async () => {
    if (connection.connected && !sequencesByConnection[connection.id] && !isLoadingSequences) {
      setIsLoadingSequences(true);
      try {
        const sequences = await getSequences(connection.id);
        setSequences(connection.id, sequences);
      } catch (error) {
        console.error("Failed to load sequences:", error);
        showErrorToast("Failed to load sequences", error instanceof Error ? error.message : String(error));
      } finally {
        setIsLoadingSequences(false);
      }
    }
  };

  const loadConnectionSequences = async () => {
    setIsLoadingSequences(true);
    try {
      const sequences = await getSequences(connection.id);
      setSequences(connection.id, sequences);
    } catch (error) {
      console.error("Failed to load sequences:", error);
      showErrorToast("Failed to load sequences", error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingSequences(false);
    }
  };

  const handleCopySequenceDdl = async (sequenceName: string) => {
    try {
      const ddl = await getSequenceDdl(connection.id, sequenceName);
      if (ddl) {
        const success = await copyToClipboard(ddl);
        if (success) {
          showInfoToast("DDL Copied", "Sequence definition copied to clipboard.");
        } else {
          throw new Error("Failed to copy to clipboard");
        }
      } else {
        showErrorToast("Copy Failed", "Could not get DDL for this sequence.");
      }
    } catch (error) {
      showErrorToast("Copy Failed", error instanceof Error ? error.message : String(error));
    }
  };

  const confirmSequenceDrop = async () => {
    if (!sequenceToDrop) return;
    try {
      const result = await dropSequence(connection.id, sequenceToDrop);
      if (result) {
        await loadConnectionSequences();
        toast({
          title: "Sequence dropped",
          description: `Sequence "${sequenceToDrop}" has been dropped successfully.`,
          variant: "success",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to drop sequence",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setSequenceToDrop(null);
    }
  };

  // Get sequences for this connection
  const connectionSequences = sequencesByConnection[connection.id] || [];

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <TreeItem
              label="Sequences"
              icon={<Hash className="h-3.5 w-3.5 text-muted-foreground" />}
              onClick={handleSequencesClick}
              defaultOpen={false}
            >
              {isLoadingSequences ? (
                <div className="ml-6 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading sequences...</span>
                </div>
              ) : connectionSequences.length > 0 ? (
                connectionSequences.map((seq) => (
                  <ContextMenu key={seq.name}>
                    <ContextMenuTrigger asChild>
                      <div>
                        <TreeItem
                          label={seq.name}
                          icon={<Hash className="h-3.5 w-3.5 text-muted-foreground" />}
                          level={1}
                        />
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48">
                      <ContextMenuItem onSelect={() => handleCopySequenceDdl(seq.name)} className="gap-2">
                        <Copy className="h-4 w-4" />
                        Copy DDL
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onSelect={() => setSequenceToDrop(seq.name)}
                        className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                        Drop Sequence
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))
              ) : sequencesByConnection[connection.id] ? (
                <div className="ml-6 py-2 text-xs text-muted-foreground">No sequences found</div>
              ) : (
                <div className="ml-6 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading sequences...</span>
                </div>
              )}
            </TreeItem>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={loadConnectionSequences} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", isLoadingSequences && "animate-spin")} />
            Refresh
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Drop Sequence Confirmation Dialog */}
      <AlertDialog open={!!sequenceToDrop} onOpenChange={(open) => !open && setSequenceToDrop(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop Sequence</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to drop the sequence "{sequenceToDrop}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSequenceDrop}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Drop Sequence
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
