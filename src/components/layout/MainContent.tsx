import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Plus,
  Code,
  Info,
  TreeStructure,
  CaretLeft,
  CaretRight,
  CaretDown,
  Table,
  TerminalWindow,
  PushPin,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  Button,
  ScrollArea,
  ScrollBar,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui";
import { useQueryStore, useConnectionsStore, useUIStore, selectActiveConnection } from "@/stores";
import { BrandIcon } from "@/components/ui";
import { TablePropertiesTab, TableDiagramTab } from "@/components/table";
import { QueryEditorTab } from "./tabs/QueryEditorTab";
import { TableViewerTab } from "./tabs/TableViewerTab";
import { TabContextMenu } from "./TabContextMenu";
import { RedisValueViewer, RedisCLI, RedisServerInfo, RedisBrowser } from "@/components/redis";
import { MongoBrowser, MongoDocumentViewer, MongoShell, MongoServerInfo } from "@/components/mongodb";
import { CassandraBrowser, CassandraShell, CassandraServerInfo } from "@/components/cassandra";
import type { Tab } from "@/types";
import { useAnime } from "@/hooks/useAnime";

function TabItem({ tab, isActive, onClose, onClick }: {
  tab: Tab;
  isActive: boolean;
  onClose: () => void;
  onClick: () => void;
}) {
  const getIcon = () => {
    switch (tab.type) {
      case "query":
        return <Code weight="regular" className="h-3.5 w-3.5" />;
      case "table":
        return <Table weight="regular" className="h-3.5 w-3.5" />;
      case "properties":
        return <Info weight="regular" className="h-3.5 w-3.5" />;
      case "diagram":
        return <TreeStructure weight="regular" className="h-3.5 w-3.5" />;
      case "redis-key":
        return <Table weight="regular" className="h-3.5 w-3.5" />;
      case "redis-cli":
        return <TerminalWindow weight="regular" className="h-3.5 w-3.5" />;
      case "redis-info":
        return <Info weight="regular" className="h-3.5 w-3.5" />;
      case "redis-browser":
        return <Table weight="regular" className="h-3.5 w-3.5" />;
      case "mongodb-browser":
        return <Table weight="regular" className="h-3.5 w-3.5" />;
      case "mongodb-document":
        return <Code weight="regular" className="h-3.5 w-3.5" />;
      case "mongodb-shell":
        return <TerminalWindow weight="regular" className="h-3.5 w-3.5" />;
      case "mongodb-info":
        return <Info weight="regular" className="h-3.5 w-3.5" />;
      case "mongodb-aggregation":
        return <TreeStructure weight="regular" className="h-3.5 w-3.5" />;
      case "cassandra-browser":
        return <Table weight="regular" className="h-3.5 w-3.5" />;
      case "cassandra-shell":
        return <TerminalWindow weight="regular" className="h-3.5 w-3.5" />;
      case "cassandra-info":
        return <Info weight="regular" className="h-3.5 w-3.5" />;
      default:
        return <Code weight="regular" className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group relative flex h-8 items-center gap-1.5 text-xs cursor-pointer outline-none",
        "focus-visible:ring-1 focus-visible:ring-ring",
        tab.isPinned ? "px-2.5" : "px-3",
        isActive
          ? "bg-background text-foreground"
          : "text-muted-foreground hover:text-foreground/80 hover:bg-muted/40"
      )}
      onClick={onClick}
      onMouseDown={(e) => {
        if (e.button === 1 && !tab.isPinned) {
          e.preventDefault();
          onClose();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Accent reserved for selected tab underline */}
      <div
        className={cn(
          "absolute bottom-0 left-2 right-2 h-[2px] bg-primary transition-transform duration-150",
          isActive ? "scale-x-100" : "scale-x-0"
        )}
      />
      {tab.isPinned && (
        <PushPin weight="regular" className="h-3 w-3 shrink-0 text-muted-foreground/70" />
      )}
      <span className={cn(
        "shrink-0",
        isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground/70"
      )}>
        {getIcon()}
      </span>
      <span className={cn(
        "truncate",
        tab.isPinned ? "max-w-[80px]" : "max-w-[120px]",
        isActive ? "font-medium" : "font-normal"
      )}>
        {tab.title}
      </span>
      {!tab.isPinned && (
        <button
          className={cn(
            "ml-0.5 rounded-sm p-0.5 shrink-0",
            "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            "hover:bg-destructive/10 hover:text-destructive",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <X weight="regular" className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function EmptyState() {
  const { addTab, tabs, setActiveTab } = useQueryStore();
  const activeConnection = useConnectionsStore(selectActiveConnection);
  const connections = useConnectionsStore((state) => state.connections);
  const setActiveConnection = useConnectionsStore((state) => state.setActiveConnection);
  const openConnectionModal = useUIStore((state) => state.openConnectionModal);
  const isRedis = activeConnection?.databaseType === "redis";
  const isMongoDB = activeConnection?.databaseType === "mongodb";
  const isCassandra = activeConnection?.databaseType === "cassandra";

  const handleNewQuery = () => {
    if (!activeConnection) return;

    addTab({
      id: crypto.randomUUID(),
      title: "New Query",
      type: "query",
      connectionId: activeConnection.id,
      content: "-- Write your SQL query here\nSELECT * FROM ",
    });
  };

  const handleOpenCli = () => {
    if (!activeConnection) return;

    const tabId = `redis-cli-${activeConnection.id}`;
    const existingTab = tabs.find((t) => t.id === tabId);
    if (existingTab) {
      setActiveTab(tabId);
    } else {
      addTab({
        id: tabId,
        title: "CLI",
        type: "redis-cli",
        connectionId: activeConnection.id,
      } as Tab);
    }
  };

  const handleOpenMongoShell = () => {
    if (!activeConnection) return;

    const tabId = `mongodb-shell-${activeConnection.id}`;
    const existingTab = tabs.find((t) => t.id === tabId);
    if (existingTab) {
      setActiveTab(tabId);
    } else {
      addTab({
        id: tabId,
        title: "Shell",
        type: "mongodb-shell",
        connectionId: activeConnection.id,
      } as Tab);
    }
  };

  const handleOpenCassandraShell = () => {
    if (!activeConnection) return;

    const tabId = `cassandra-shell-${activeConnection.id}`;
    const existingTab = tabs.find((t) => t.id === tabId);
    if (existingTab) {
      setActiveTab(tabId);
    } else {
      addTab({
        id: tabId,
        title: "CQL Shell",
        type: "cassandra-shell",
        connectionId: activeConnection.id,
      } as Tab);
    }
  };

  const hasConnections = connections.length > 0;

  return (
    <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
      <Table weight="regular" className="mb-4 h-8 w-8 text-muted-foreground/40" />
      <h2 className="mb-1.5 text-base font-medium text-foreground">
        {activeConnection ? "No tabs open" : hasConnections ? "Pick a connection" : "Welcome to dbfordevs"}
      </h2>
      <p className="mb-5 text-xs max-w-sm text-center text-muted-foreground">
        {activeConnection
          ? isRedis
            ? "Open the CLI or select a key from the sidebar"
            : isMongoDB
            ? "Open the Shell or select a collection from the sidebar"
            : isCassandra
            ? "Open the CQL Shell or select a table from the sidebar"
            : "Select a table from the sidebar to browse data"
          : hasConnections
          ? "Choose a connection to get started"
          : "Add your first database connection to get started"}
      </p>

      {/* No connections yet: primary CTA to create one */}
      {!activeConnection && !hasConnections && (
        <Button onClick={() => openConnectionModal()} size="sm" className="h-8">
          <Plus weight="regular" className="mr-1.5 h-3.5 w-3.5" />
          Add Connection
        </Button>
      )}

      {/* Connections exist but none selected: pick from a list */}
      {!activeConnection && hasConnections && (
        <div className="w-full max-w-sm space-y-1">
          {connections.slice(0, 6).map((connection) => (
            <button
              key={connection.id}
              onClick={() => setActiveConnection(connection.id)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5 text-left transition-all duration-150 ease-swift",
                "hover:border-border hover:bg-accent hover:text-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:shadow-[0_0_0_3px_var(--accent-glow)]"
              )}
            >
              <BrandIcon name={connection.databaseType} className="h-4 w-4 shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">
                  {connection.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {connection.host ? `${connection.host} · ${connection.database}` : connection.database}
                </span>
              </span>
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  connection.connected ? "bg-success" : "bg-muted-foreground/30"
                )}
              />
            </button>
          ))}
          {connections.length > 6 && (
            <p className="pt-1 text-center text-xs text-muted-foreground/70">
              {connections.length - 6} more in the sidebar
            </p>
          )}
        </div>
      )}

      {activeConnection && !isRedis && !isMongoDB && !isCassandra && (
        <p className="text-[11px] text-muted-foreground/60">
          Or open a{" "}
          <button
            type="button"
            onClick={handleNewQuery}
            className="text-primary hover:underline"
          >
            SQL query
          </button>
        </p>
      )}
      {activeConnection && isRedis && (
        <Button onClick={handleOpenCli} size="sm" className="h-8">
          <TerminalWindow weight="regular" className="mr-1.5 h-3.5 w-3.5" />
          Open CLI
        </Button>
      )}
      {activeConnection && isMongoDB && (
        <Button onClick={handleOpenMongoShell} size="sm" className="h-8">
          <TerminalWindow weight="regular" className="mr-1.5 h-3.5 w-3.5" />
          Open Shell
        </Button>
      )}
      {activeConnection && isCassandra && (
        <Button onClick={handleOpenCassandraShell} size="sm" className="h-8">
          <TerminalWindow weight="regular" className="mr-1.5 h-3.5 w-3.5" />
          Open CQL Shell
        </Button>
      )}

      <div className="mt-8 flex items-center gap-3 text-[11px] text-muted-foreground/60">
        <span className="flex items-center gap-1">
          <kbd>Ctrl</kbd>
          <kbd>K</kbd>
          Commands
        </span>
        {activeConnection && (
          <span className="flex items-center gap-1">
            <kbd>Ctrl</kbd>
            <kbd>Shift</kbd>
            <kbd>F</kbd>
            Schema search
          </span>
        )}
      </div>
    </div>
  );
}

// Tab components extracted to separate files (see ./tabs/)

export function MainContent() {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab } = useQueryStore();
  const activeConnection = useConnectionsStore(selectActiveConnection);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousTabIdRef = useRef<string | null>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const { animate } = useAnime();

  const checkScroll = useCallback(() => {
    const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      const { scrollLeft, scrollWidth, clientWidth } = viewport as HTMLElement;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
    }
  }, []);

  // Animate content when tab changes
  useEffect(() => {
    // Only animate if the tab actually changed (not on initial render or same tab)
    if (contentRef.current && activeTabId && previousTabIdRef.current !== activeTabId) {
      animate({
        targets: contentRef.current,
        opacity: [0.5, 1],
        translateX: [20, 0],
        duration: 300,
        easing: "easeOutQuad",
      });
    }
    // Update the previous tab ID
    previousTabIdRef.current = activeTabId;
  }, [activeTabId, animate]);

  useEffect(() => {
    checkScroll();
    const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.addEventListener("scroll", checkScroll);
      return () => viewport.removeEventListener("scroll", checkScroll);
    }
  }, [tabs, checkScroll]);

  useEffect(() => {
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [checkScroll]);

  const scroll = (direction: "left" | "right") => {
    const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      const scrollAmount = 300;
      viewport.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const handleNewTab = () => {
    if (!activeConnection) return;

    // For Redis connections, open a CLI tab instead of a Query tab
    if (activeConnection.databaseType === "redis") {
      const tabId = `redis-cli-${activeConnection.id}`;
      const existingTab = tabs.find((t) => t.id === tabId);
      if (existingTab) {
        setActiveTab(tabId);
      } else {
        addTab({
          id: tabId,
          title: "CLI",
          type: "redis-cli",
          connectionId: activeConnection.id,
        } as Tab);
      }
      return;
    }

    // For MongoDB connections, open a Shell tab instead of a Query tab
    if (activeConnection.databaseType === "mongodb") {
      const tabId = `mongodb-shell-${activeConnection.id}`;
      const existingTab = tabs.find((t) => t.id === tabId);
      if (existingTab) {
        setActiveTab(tabId);
      } else {
        addTab({
          id: tabId,
          title: "Shell",
          type: "mongodb-shell",
          connectionId: activeConnection.id,
        } as Tab);
      }
      return;
    }

    // For Cassandra connections, open a CQL Shell tab instead of a Query tab
    if (activeConnection.databaseType === "cassandra") {
      const tabId = `cassandra-shell-${activeConnection.id}`;
      const existingTab = tabs.find((t) => t.id === tabId);
      if (existingTab) {
        setActiveTab(tabId);
      } else {
        addTab({
          id: tabId,
          title: "CQL Shell",
          type: "cassandra-shell",
          connectionId: activeConnection.id,
        } as Tab);
      }
      return;
    }

    addTab({
      id: crypto.randomUUID(),
      title: `Query ${tabs.length + 1}`,
      type: "query",
      connectionId: activeConnection.id,
      content: "",
    });
  };

  return (
    <main data-focus-zone="editor" className="flex h-full flex-1 flex-col bg-background overflow-hidden">
      {/* Tab Bar ~32px */}
      <div className="flex h-8 items-center border-b border-border bg-[hsl(var(--sidebar-background))] relative group/tabbar">
        <div className="flex-1 h-full relative overflow-hidden flex items-center">
          {showLeftArrow && (
            <div className="absolute left-0 z-20 flex h-full items-center bg-gradient-to-r from-background via-background to-transparent pr-6 pl-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-muted"
                onClick={() => scroll("left")}
              >
                <CaretLeft weight="regular" className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          
          <ScrollArea ref={scrollRef} className="flex-1 h-full" scrollHideDelay={100}>
            <div className="flex h-full items-center">
              {tabs.map((tab) => (
                <TabContextMenu key={tab.id} tab={tab}>
                  <TabItem
                    tab={tab}
                    isActive={tab.id === activeTabId}
                    onClick={() => setActiveTab(tab.id)}
                    onClose={() => removeTab(tab.id)}
                  />
                </TabContextMenu>
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="h-1" />
          </ScrollArea>

          {showRightArrow && (
            <div className="absolute right-0 z-20 flex h-full items-center bg-gradient-to-l from-background via-background to-transparent pl-6 pr-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-muted"
                onClick={() => scroll("right")}
              >
                <CaretRight weight="regular" className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center px-0.5 border-l border-border z-30">
          {tabs.length > 0 && (
            <Select value={activeTabId || ""} onValueChange={setActiveTab}>
              <SelectTrigger className="h-6 w-6 p-0 border-none bg-transparent hover:bg-muted shadow-none ring-0 focus:ring-0 [&>svg]:hidden">
                <SelectValue placeholder={<CaretDown weight="regular" className="h-3.5 w-3.5" />}>
                  <CaretDown weight="regular" className="h-3.5 w-3.5 text-muted-foreground" />
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end" className="w-[200px]">
                {tabs.map((tab) => (
                  <SelectItem key={tab.id} value={tab.id}>
                    <div className="flex items-center gap-2">
                      {tab.type === "query" && <Code weight="regular" className="h-3.5 w-3.5" />}
                      {tab.type === "table" && <Table weight="regular" className="h-3.5 w-3.5" />}
                      {tab.type === "properties" && <Info weight="regular" className="h-3.5 w-3.5" />}
                      {tab.type === "diagram" && <TreeStructure weight="regular" className="h-3.5 w-3.5" />}
                      <span className="truncate">{tab.title}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {activeConnection && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleNewTab}
                >
                  <Plus weight="regular" className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New Tab</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div ref={contentRef} className="flex-1 overflow-hidden">
        {activeTab ? (
          activeTab.type === "query" ? (
            <QueryEditorTab tab={activeTab} />
          ) : activeTab.type === "table" ? (
            <TableViewerTab tab={activeTab} />
          ) : activeTab.type === "properties" ? (
            <TablePropertiesTab tab={activeTab} />
          ) : activeTab.type === "diagram" ? (
            <TableDiagramTab tab={activeTab} />
          ) : activeTab.type === "redis-key" && activeTab.redisKey ? (
            <RedisValueViewer connectionId={activeTab.connectionId} keyName={activeTab.redisKey} />
          ) : activeTab.type === "redis-cli" ? (
            <RedisCLI connectionId={activeTab.connectionId} />
          ) : activeTab.type === "redis-info" ? (
            <RedisServerInfo connectionId={activeTab.connectionId} />
          ) : activeTab.type === "redis-browser" ? (
            <RedisBrowser connectionId={activeTab.connectionId} />
          ) : activeTab.type === "mongodb-browser" && activeTab.mongoDatabase && activeTab.mongoCollection ? (
            <MongoBrowser
              connectionId={activeTab.connectionId}
              database={activeTab.mongoDatabase}
              collection={activeTab.mongoCollection}
            />
          ) : activeTab.type === "mongodb-document" && activeTab.mongoDatabase && activeTab.mongoCollection && activeTab.mongoDocumentId ? (
            <MongoDocumentViewer
              document={(() => { try { return JSON.parse(activeTab.mongoDocumentId); } catch { return null; } })()}
              connectionId={activeTab.connectionId}
              database={activeTab.mongoDatabase}
              collection={activeTab.mongoCollection}
            />
          ) : activeTab.type === "mongodb-shell" ? (
            <MongoShell connectionId={activeTab.connectionId} />
          ) : activeTab.type === "mongodb-info" ? (
            <MongoServerInfo connectionId={activeTab.connectionId} />
          ) : activeTab.type === "cassandra-browser" && activeTab.cassandraKeyspace && activeTab.cassandraTable ? (
            <CassandraBrowser
              connectionId={activeTab.connectionId}
              keyspace={activeTab.cassandraKeyspace}
              table={activeTab.cassandraTable}
            />
          ) : activeTab.type === "cassandra-shell" ? (
            <CassandraShell connectionId={activeTab.connectionId} />
          ) : activeTab.type === "cassandra-info" ? (
            <CassandraServerInfo connectionId={activeTab.connectionId} />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Table className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Schema view coming soon</p>
              </div>
            </div>
          )
        ) : (
          <EmptyState />
        )}
      </div>
    </main>
  );
}
