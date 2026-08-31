import { useEffect } from "react";
import {
  Database,
  TreeStructure,
  Plus,
  Gear,
} from "@phosphor-icons/react";
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
      <ResizeHandle
        direction="right"
        currentWidth={sidebarWidth}
        onResize={setSidebarWidth}
        minWidth={180}
        maxWidth={420}
      />

      {/* Dense header — CONNECTIONS label, not soft brand card */}
      <div className="flex h-8 items-center justify-between border-b border-sidebar-border px-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Connections
        </span>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => setShowGroupManagerDialog(true)}
              >
                <TreeStructure weight="regular" className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Manage Groups</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => setShowConnectionModal(true)}
              >
                <Plus weight="regular" className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">New Connection</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <ConnectionFilterBar />

      <ScrollArea className="flex-1 px-1 py-1.5">
        <div className="space-y-0.5">
          {connections.length === 0 ? (
            <div className="px-2 py-8 text-center">
              <Database weight="regular" className="mx-auto mb-2 h-5 w-5 text-muted-foreground/50" />
              <p className="text-xs font-medium text-foreground mb-0.5">No connections</p>
              <p className="text-[11px] text-muted-foreground mb-3">Add a database connection</p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowConnectionModal(true)}
              >
                <Plus weight="regular" className="h-3 w-3 mr-1" />
                Add Connection
              </Button>
            </div>
          ) : groups.length === 0 ? (
            filteredConnections.map((conn) => (
              <ConnectionItem key={conn.id} connection={conn} />
            ))
          ) : (
            <>
              {groups
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((group) => {
                  const groupConnections = filteredConnections.filter(
                    (c) => c.groupId === group.id
                  );
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

              {filteredConnections.length === 0 && connections.length > 0 && (
                <div className="py-6 text-center">
                  <p className="text-xs text-muted-foreground">No connections match</p>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      <div className="flex items-center gap-1 border-t border-sidebar-border px-2 py-1.5">
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/80">
          <span className="rounded border border-border px-1 py-px">SSH</span>
          <span className="rounded border border-border px-1 py-px">SSL</span>
        </span>
        <div className="flex-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => openSettingsWithTab("general")}
            >
              <Gear weight="regular" className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      </div>

      <GroupManagerDialog />
      <AssignGroupDialog />
    </aside>
  );
}
