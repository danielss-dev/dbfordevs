import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Plus,
  Code,
  Info,
  Network,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Table,
  Terminal,
} from "lucide-react";
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
import { useQueryStore, useConnectionsStore, selectActiveConnection } from "@/stores";
import { TablePropertiesTab, TableDiagramTab } from "@/components/table";
import { QueryEditorTab } from "./tabs/QueryEditorTab";
import { TableViewerTab } from "./tabs/TableViewerTab";
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
        return <Code className="h-3.5 w-3.5" />;
      case "table":
        return <Table className="h-3.5 w-3.5" />;
      case "properties":
        return <Info className="h-3.5 w-3.5" />;
      case "diagram":
        return <Network className="h-3.5 w-3.5" />;
      default:
        return <Code className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group relative flex items-center gap-2 px-4 py-2.5 text-sm transition-all duration-200 border-r border-border/50 cursor-pointer outline-none focus-visible:bg-muted/50",
        isActive
          ? "bg-background text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/80 rounded-full blur-[0.5px]" />
      )}
      <span className={cn(
        "transition-colors",
        isActive ? "text-primary/90" : "text-muted-foreground group-hover:text-foreground"
      )}>
        {getIcon()}
      </span>
      <span className="max-w-[120px] truncate font-medium">{tab.title}</span>
      <button
        className={cn(
          "ml-1 rounded-md p-0.5 transition-all duration-200",
          "opacity-0 group-hover:opacity-100",
          "hover:bg-muted-foreground/20"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function EmptyState() {
  const { addTab } = useQueryStore();
  const activeConnection = useConnectionsStore(selectActiveConnection);

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

  return (
    <div className="flex h-full flex-col items-center justify-center text-muted-foreground animate-fade-in">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl" />
        <div className="relative bg-muted/50 p-6 rounded-2xl border border-border">
          <Terminal className="h-12 w-12 text-muted-foreground/50" />
        </div>
      </div>
      <h2 className="mb-2 text-xl font-semibold text-foreground">No tabs open</h2>
      <p className="mb-6 text-sm max-w-sm text-center">
        {activeConnection
          ? "Start by opening a new query or selecting a table from the sidebar"
          : "Select a connection from the sidebar to get started"}
      </p>
      {activeConnection && (
        <Button onClick={handleNewQuery} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          New Query
        </Button>
      )}
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

    addTab({
      id: crypto.randomUUID(),
      title: `Query ${tabs.length + 1}`,
      type: "query",
      connectionId: activeConnection.id,
      content: "",
    });
  };

  return (
    <main className="flex h-full flex-1 flex-col bg-background overflow-hidden">
      {/* Tab Bar */}
      <div className="flex h-11 items-center border-b border-border bg-card/50 relative group/tabbar">
        <div className="flex-1 h-full relative overflow-hidden flex items-center">
          {showLeftArrow && (
            <div className="absolute left-0 z-20 flex h-full items-center bg-gradient-to-r from-background via-background to-transparent pr-8 pl-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-muted"
                onClick={() => scroll("left")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          <ScrollArea ref={scrollRef} className="flex-1 h-full" scrollHideDelay={100}>
            <div className="flex h-full items-center">
              {tabs.map((tab) => (
                <TabItem
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  onClick={() => setActiveTab(tab.id)}
                  onClose={() => removeTab(tab.id)}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="h-1.5" />
          </ScrollArea>

          {showRightArrow && (
            <div className="absolute right-0 z-20 flex h-full items-center bg-gradient-to-l from-background via-background to-transparent pl-8 pr-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-muted"
                onClick={() => scroll("right")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center px-1 border-l border-border bg-background/50 backdrop-blur-sm z-30">
          {tabs.length > 0 && (
            <Select value={activeTabId || ""} onValueChange={setActiveTab}>
              <SelectTrigger className="h-8 w-8 p-0 border-none bg-transparent hover:bg-muted shadow-none ring-0 focus:ring-0 [&>svg]:hidden">
                <SelectValue placeholder={<ChevronDown className="h-4 w-4" />}>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end" className="w-[200px]">
                {tabs.map((tab) => (
                  <SelectItem key={tab.id} value={tab.id}>
                    <div className="flex items-center gap-2">
                      {tab.type === "query" && <Code className="h-3.5 w-3.5" />}
                      {tab.type === "table" && <Table className="h-3.5 w-3.5" />}
                      {tab.type === "properties" && <Info className="h-3.5 w-3.5" />}
                      {tab.type === "diagram" && <Network className="h-3.5 w-3.5" />}
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
                  className="h-8 w-8"
                  onClick={handleNewTab}
                >
                  <Plus className="h-4 w-4" />
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
