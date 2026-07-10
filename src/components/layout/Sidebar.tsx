import { useEffect } from "react";
import {
  Database,
  FolderTree,
  Plus,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Button,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  ResizeHandle,
} from "@/components/ui";
import { ConnectionFilterBar } from "@/components/connections/ConnectionFilterBar";
import { GroupManagerDialog } from "@/components/connections/GroupManagerDialog";
import { AssignGroupDialog } from "@/components/connections/AssignGroupDialog";
import { ConnectionGroupItem } from "./ConnectionGroupItem";
import { useConnectionsStore, useUIStore } from "@/stores";
import { useDatabase } from "@/hooks";
import { DbForDevsIcon } from "@/components/icons";
import { ConnectionItem } from "./sidebar/ConnectionItem";

export function Sidebar() {
  const sidebarOpen = useUIStore(state => state.sidebarOpen);
  const sidebarWidth = useUIStore(state => state.sidebarWidth);
  const setSidebarWidth = useUIStore(state => state.setSidebarWidth);
  const setShowConnectionModal = useUIStore(state => state.setShowConnectionModal);
  const openSettingsWithTab = useUIStore(state => state.openSettingsWithTab);
  const setShowGroupManagerDialog = useUIStore(state => state.setShowGroupManagerDialog);
  const connections = useConnectionsStore(state => state.connections);
  const groups = useConnectionsStore(state => state.groups);
  const getFilteredConnections = useConnectionsStore(state => state.getFilteredConnections);
  const toggleGroupCollapse = useConnectionsStore(state => state.toggleGroupCollapse);
  const { loadConnections } = useDatabase();

  const filteredConnections = getFilteredConnections();

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  if (!sidebarOpen) {
    return null;
  }

  return (
    <aside
      data-sidebar
      data-focus-zone="sidebar"
      className="relative flex h-full flex-col border-r border-sidebar-border bg-sidebar"
      style={{ width: sidebarWidth }}
    >
      {/* Resize Handle */}
      <ResizeHandle
        direction="right"
        currentWidth={sidebarWidth}
        onResize={setSidebarWidth}
        minWidth={260}
        maxWidth={450}
      />

      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <DbForDevsIcon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="font-semibold text-sm">dbfordevs</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowGroupManagerDialog(true)}
              >
                <FolderTree className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Manage Groups</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowConnectionModal(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">New Connection</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Filter Bar */}
      <ConnectionFilterBar />

      {/* Connections List */}
      <ScrollArea className="flex-1 px-2 py-3">
        <div className="space-y-2">
          {connections.length === 0 ? (
            <div className="py-12 text-center animate-fade-in">
              <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
                <Database className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">No connections</p>
              <p className="text-xs text-muted-foreground mb-4">Add your first database connection</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConnectionModal(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Connection
              </Button>
            </div>
          ) : groups.length === 0 ? (
            // No groups - show flat list
            filteredConnections.map((conn, index) => (
              <div key={conn.id} className={cn(
                index > 0 && "mt-1 pt-1 border-t border-sidebar-border/50"
              )}>
                <ConnectionItem connection={conn} />
              </div>
            ))
          ) : (
            // Grouped rendering
            <>
              {/* Render each group */}
              {groups
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((group) => {
                  const groupConnections = filteredConnections.filter(
                    (c) => c.groupId === group.id
                  );
                  // Hide empty groups when filtering
                  if (groupConnections.length === 0) return null;
                  return (
                    <ConnectionGroupItem
                      key={group.id}
                      group={group}
                      count={groupConnections.length}
                      isCollapsed={group.isCollapsed}
                      onToggleCollapse={() => toggleGroupCollapse(group.id)}
                    >
                      {groupConnections.map((conn) => (
                        <ConnectionItem key={conn.id} connection={conn} />
                      ))}
                    </ConnectionGroupItem>
                  );
                })}

              {/* Ungrouped connections */}
              {(() => {
                const ungroupedConnections = filteredConnections.filter(
                  (c) => !c.groupId
                );
                if (ungroupedConnections.length === 0) return null;
                return (
                  <div className="space-y-0.5">
                    {groups.length > 0 && (
                      <div className="mx-2 my-1.5 border-t border-border" />
                    )}
                    {ungroupedConnections.map((conn) => (
                      <ConnectionItem key={conn.id} connection={conn} />
                    ))}
                  </div>
                );
              })()}

              {/* Show message if no results after filtering */}
              {filteredConnections.length === 0 && connections.length > 0 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">No connections match your filters</p>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2">
        <div className="flex items-center gap-1">
          <div className="flex-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => openSettingsWithTab("general")}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Group Management Dialogs */}
      <GroupManagerDialog />
      <AssignGroupDialog />
    </aside>
  );
}
