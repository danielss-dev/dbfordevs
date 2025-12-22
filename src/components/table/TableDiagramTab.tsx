import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Loader2,
  Table as TableIcon,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Move,
  MousePointer,
  Copy,
  LayoutGrid,
  List,
  Search,
  X,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { useDatabase, useToast } from "@/hooks";
import type { Tab, TableRelationship, TableProperties, ExtendedColumnInfo } from "@/types";
import { cn, copyToClipboard } from "@/lib/utils";

interface TableDiagramTabProps {
  tab: Tab;
}

interface TableBox {
  name: string;
  displayName: string;
  columns: ExtendedColumnInfo[];
  x: number;
  y: number;
  width: number;
  height: number;
  isMain?: boolean;
}

type ViewMode = "detailed" | "compact";

// Constants for layout
const TABLE_WIDTH = 220;
const TABLE_WIDTH_COMPACT = 160;
const ROW_HEIGHT = 22;
const HEADER_HEIGHT = 36;
const HEADER_HEIGHT_COMPACT = 32;
const PADDING = 12;
const MAX_COLUMNS_DISPLAY = 8;
const GRID_GAP_X = 40;
const GRID_GAP_Y = 30;

// Threshold for switching to compact mode automatically
const COMPACT_MODE_THRESHOLD = 15;

function calculateTableHeight(columns: ExtendedColumnInfo[], viewMode: ViewMode): number {
  if (viewMode === "compact") {
    return HEADER_HEIGHT_COMPACT;
  }
  const displayCols = Math.min(columns.length, MAX_COLUMNS_DISPLAY);
  const hasMore = columns.length > MAX_COLUMNS_DISPLAY;
  return HEADER_HEIGHT + displayCols * ROW_HEIGHT + (hasMore ? 20 : 0) + PADDING;
}

export function TableDiagramTab({ tab }: TableDiagramTabProps) {
  const { getTableRelationships, getTableProperties, getTables, generateTableDdl } = useDatabase();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });
  const [relationships, setRelationships] = useState<TableRelationship[]>([]);
  const [allTables, setAllTables] = useState<TableProperties[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panMode, setPanMode] = useState(true); // Default to pan mode for large diagrams
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("detailed");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check if this is a schema diagram (no tableName means show all tables in schema)
  const isSchemaMode = tab.type === "diagram" && !tab.tableName;
  const schemaName = isSchemaMode ? tab.content : null;

  // Calculate table boxes based on view mode
  const tableBoxes = useMemo(() => {
    return layoutTables(allTables, tab.tableName, viewMode);
  }, [allTables, tab.tableName, viewMode]);

  // Search matches
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return tableBoxes.filter(box =>
      box.displayName.toLowerCase().includes(query) ||
      box.name.toLowerCase().includes(query)
    );
  }, [tableBoxes, searchQuery]);

  // Pan to a specific table
  const panToTable = useCallback((box: TableBox) => {
    if (!containerRef.current) return;

    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    // Center the table in the viewport
    const targetX = containerWidth / 2 - (box.x + box.width / 2) * zoom;
    const targetY = containerHeight / 2 - (box.y + box.height / 2) * zoom;

    setPan({ x: targetX, y: targetY });
  }, [zoom]);

  // Navigate to next/previous search result
  const goToMatch = useCallback((index: number) => {
    if (searchMatches.length === 0) return;
    const wrappedIndex = ((index % searchMatches.length) + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(wrappedIndex);
    panToTable(searchMatches[wrappedIndex]);
  }, [searchMatches, panToTable]);

  // Handle search input change
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setCurrentMatchIndex(0);
  }, []);

  // Pan to first match when search results change
  useEffect(() => {
    if (searchMatches.length > 0 && searchQuery) {
      panToTable(searchMatches[0]);
      setCurrentMatchIndex(0);
    }
  }, [searchMatches, searchQuery, panToTable]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + F to open search
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      // Escape to close search
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        setSearchQuery("");
      }
      // Enter to go to next match, Shift+Enter for previous
      if (e.key === "Enter" && searchOpen && searchMatches.length > 0) {
        e.preventDefault();
        if (e.shiftKey) {
          goToMatch(currentMatchIndex - 1);
        } else {
          goToMatch(currentMatchIndex + 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen, searchMatches, currentMatchIndex, goToMatch]);

  // Auto-switch to compact mode for large diagrams
  useEffect(() => {
    if (allTables.length > COMPACT_MODE_THRESHOLD && viewMode === "detailed") {
      setViewMode("compact");
    }
  }, [allTables.length]);

  const handleCopyDdl = async () => {
    if (!tab.tableName || !tab.connectionId) return;

    try {
      const ddl = await generateTableDdl(tab.connectionId, tab.tableName);
      if (ddl) {
        const success = await copyToClipboard(ddl);
        if (success) {
          toast({
            title: "DDL Copied",
            description: "CREATE TABLE statement copied to clipboard.",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: error instanceof Error ? error.message : "Could not copy DDL",
        variant: "destructive",
      });
    }
  };

  const loadDiagram = useCallback(async () => {
    if (!tab.connectionId) return;

    setIsLoading(true);
    setError(null);
    setLoadingProgress({ current: 0, total: 0 });

    try {
      let tableNames: string[] = [];
      let loadedTables: TableProperties[] = [];
      let allRelationships: TableRelationship[] = [];

      if (isSchemaMode && schemaName) {
        // Get list of tables in schema first
        const tables = await getTables(tab.connectionId);
        const schemaTables = tables.filter(t => t.schema === schemaName || (!t.schema && schemaName === "default"));
        tableNames = schemaTables.map(t => t.name);
      } else if (tab.tableName) {
        // Single table mode - start with main table
        tableNames = [tab.tableName];
      }

      setLoadingProgress({ current: 0, total: tableNames.length });

      // Load table properties in parallel batches (batch size 5 for better UX)
      const BATCH_SIZE = 5;
      for (let i = 0; i < tableNames.length; i += BATCH_SIZE) {
        const batch = tableNames.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (tableName) => {
            const props = await getTableProperties(tab.connectionId, tableName);
            return props;
          })
        );

        loadedTables = [...loadedTables, ...batchResults.filter((p): p is TableProperties => p !== null)];
        setLoadingProgress({ current: Math.min(i + BATCH_SIZE, tableNames.length), total: tableNames.length });
      }

      // For single table mode, also load related tables
      if (!isSchemaMode && tab.tableName && loadedTables.length > 0) {
        const rels = await getTableRelationships(tab.connectionId, tab.tableName);
        allRelationships = rels;

        const relatedTableNames = new Set<string>();
        rels.forEach((rel) => {
          if (rel.sourceTable !== tab.tableName) relatedTableNames.add(rel.sourceTable);
          if (rel.targetTable !== tab.tableName) relatedTableNames.add(rel.targetTable);
        });

        // Load related tables in parallel
        const relatedResults = await Promise.all(
          Array.from(relatedTableNames).map(tableName =>
            getTableProperties(tab.connectionId, tableName)
          )
        );
        loadedTables = [...loadedTables, ...relatedResults.filter((p): p is TableProperties => p !== null)];
      }

      // For schema mode, load relationships in parallel batches
      if (isSchemaMode) {
        const relBatches = [];
        for (let i = 0; i < loadedTables.length; i += BATCH_SIZE) {
          const batch = loadedTables.slice(i, i + BATCH_SIZE);
          const batchRels = await Promise.all(
            batch.map(table => getTableRelationships(tab.connectionId, table.tableName))
          );
          relBatches.push(...batchRels.flat());
        }

        // Deduplicate relationships
        const seen = new Set<string>();
        allRelationships = relBatches.filter(rel => {
          const key = `${rel.sourceTable}:${rel.sourceColumn}:${rel.targetTable}:${rel.targetColumn}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }

      setAllTables(loadedTables);
      setRelationships(allRelationships);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load diagram");
    } finally {
      setIsLoading(false);
    }
  }, [tab.connectionId, tab.tableName, isSchemaMode, schemaName, getTableProperties, getTableRelationships, getTables]);

  // Auto-fit when tables are loaded
  useEffect(() => {
    if (!isLoading && tableBoxes.length > 0 && containerRef.current) {
      // Small delay to ensure container is rendered
      setTimeout(() => fitToScreen(), 100);
    }
  }, [isLoading, tableBoxes.length]);

  useEffect(() => {
    loadDiagram();
  }, [loadDiagram]);

  // Mouse handlers for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (panMode || e.button === 1) {
      setIsPanning(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && dragStart) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDragStart(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(Math.max(0.1, Math.min(3, zoom + delta)));
    } else {
      setPan({
        x: pan.x - e.deltaX,
        y: pan.y - e.deltaY,
      });
    }
  };

  const fitToScreen = useCallback(() => {
    if (!containerRef.current || tableBoxes.length === 0) return;

    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    const bounds = calculateBounds(tableBoxes);
    const contentWidth = bounds.maxX - bounds.minX + 80;
    const contentHeight = bounds.maxY - bounds.minY + 80;

    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    const newZoom = Math.min(scaleX, scaleY, 1.2);

    setZoom(newZoom);
    setPan({
      x: (containerWidth - contentWidth * newZoom) / 2 - bounds.minX * newZoom + 40,
      y: (containerHeight - contentHeight * newZoom) / 2 - bounds.minY * newZoom + 40,
    });
  }, [tableBoxes]);

  const displayName = tab.tableName?.includes(".")
    ? tab.tableName.split(".").pop()
    : tab.tableName;

  if (isLoading) {
    const progressPercent = loadingProgress.total > 0
      ? Math.round((loadingProgress.current / loadingProgress.total) * 100)
      : 0;

    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading diagram...</span>
          {loadingProgress.total > 0 && (
            <div className="flex flex-col items-center gap-1">
              <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {loadingProgress.current} / {loadingProgress.total} tables
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error || tableBoxes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <TableIcon className="h-12 w-12 opacity-30 mb-4" />
        <p className="text-lg font-medium">{error || "Unable to load diagram"}</p>
        <Button variant="outline" className="mt-4" onClick={loadDiagram}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const title = isSchemaMode
    ? `${schemaName} - Schema Diagram`
    : `${displayName} - ER Diagram`;

  // Determine if we should use simplified rendering (no shadows, simpler paths)
  const useSimplifiedRendering = tableBoxes.length > 10;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-muted/30">
        <div className="flex items-center gap-2">
          <TableIcon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{title}</span>
          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
            {tableBoxes.length} table{tableBoxes.length !== 1 ? "s" : ""} · {relationships.length} relationship{relationships.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Search */}
          {searchOpen ? (
            <div className="flex items-center gap-1 mr-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search tables..."
                  className="h-8 w-48 pl-7 pr-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
              </div>
              {searchQuery && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {searchMatches.length > 0 ? (
                    <>{currentMatchIndex + 1} / {searchMatches.length}</>
                  ) : (
                    "No results"
                  )}
                </span>
              )}
              {searchMatches.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => goToMatch(currentMatchIndex - 1)}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => goToMatch(currentMatchIndex + 1)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => {
                  setSearchOpen(false);
                  setSearchQuery("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchOpen(true);
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Search tables (Ctrl+F)</TooltipContent>
            </Tooltip>
          )}
          <div className="w-px h-5 bg-border mx-1" />
          {/* View mode toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={viewMode === "compact" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode(viewMode === "compact" ? "detailed" : "compact")}
              >
                {viewMode === "compact" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{viewMode === "compact" ? "Compact view" : "Detailed view"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={panMode ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setPanMode(!panMode)}
              >
                {panMode ? <Move className="h-4 w-4" /> : <MousePointer className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{panMode ? "Pan mode (drag to move)" : "Select mode"}</TooltipContent>
          </Tooltip>
          <div className="w-px h-5 bg-border mx-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}>
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom out</TooltipContent>
          </Tooltip>
          <span className="text-xs text-muted-foreground w-14 text-center font-mono">
            {Math.round(zoom * 100)}%
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={() => setZoom(Math.min(3, zoom + 0.1))}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom in</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={fitToScreen}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit to screen</TooltipContent>
          </Tooltip>
          <div className="w-px h-5 bg-border mx-1" />
          {!isSchemaMode && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={handleCopyDdl}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy CREATE TABLE DDL</TooltipContent>
              </Tooltip>
              <div className="w-px h-5 bg-border mx-1" />
            </>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={loadDiagram}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh diagram</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Diagram Canvas */}
      <div
        ref={containerRef}
        className={cn(
          "flex-1 overflow-hidden",
          useSimplifiedRendering
            ? "bg-muted/10"
            : "bg-[radial-gradient(circle_at_1px_1px,hsl(var(--muted))_1px,transparent_0)] [background-size:24px_24px]",
          panMode ? "cursor-grab" : "cursor-default",
          isPanning && "cursor-grabbing"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="select-none"
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <path d="M0,0 L10,3.5 L0,7 L2,3.5 Z" className="fill-primary/60" />
            </marker>
            <marker
              id="arrowhead-muted"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <path d="M0,0 L10,3.5 L0,7 L2,3.5 Z" className="fill-muted-foreground/40" />
            </marker>
            {!useSimplifiedRendering && (
              <filter id="table-shadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.1" />
              </filter>
            )}
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Relationship Lines - render first so they're behind tables */}
            {relationships.map((rel, idx) => {
              const sourceBox = tableBoxes.find((b) => b.name === rel.sourceTable);
              const targetBox = tableBoxes.find((b) => b.name === rel.targetTable);
              if (!sourceBox || !targetBox) return null;

              return (
                <RelationshipLine
                  key={idx}
                  rel={rel}
                  sourceBox={sourceBox}
                  targetBox={targetBox}
                  mainTableName={tab.tableName}
                  simplified={useSimplifiedRendering}
                />
              );
            })}

            {/* Table Boxes */}
            {tableBoxes.map((box) => {
              const matchIndex = searchMatches.findIndex(m => m.name === box.name);
              const isMatch = matchIndex !== -1;
              const isCurrentMatch = isMatch && matchIndex === currentMatchIndex;

              return (
                <TableBoxComponent
                  key={box.name}
                  box={box}
                  viewMode={viewMode}
                  simplified={useSimplifiedRendering}
                  isMatch={isMatch}
                  isCurrentMatch={isCurrentMatch}
                  dimmed={searchQuery.length > 0 && !isMatch}
                />
              );
            })}
          </g>
        </svg>
      </div>

      {/* Footer hint */}
      <div className="flex items-center justify-center gap-4 border-t border-border px-4 py-1.5 bg-muted/20 text-[10px] text-muted-foreground">
        <span>Scroll to pan</span>
        <span>·</span>
        <span>Ctrl+Scroll to zoom</span>
        <span>·</span>
        <span>Click pan mode to drag</span>
      </div>
    </div>
  );
}

interface RelationshipLineProps {
  rel: TableRelationship;
  sourceBox: TableBox;
  targetBox: TableBox;
  mainTableName?: string;
  simplified?: boolean;
}

function RelationshipLine({ rel, sourceBox, targetBox, mainTableName, simplified }: RelationshipLineProps) {
  const sourceCenterX = sourceBox.x + sourceBox.width / 2;
  const sourceCenterY = sourceBox.y + sourceBox.height / 2;
  const targetCenterX = targetBox.x + targetBox.width / 2;
  const targetCenterY = targetBox.y + targetBox.height / 2;

  const dx = targetCenterX - sourceCenterX;
  const dy = targetCenterY - sourceCenterY;

  let sourceX: number, sourceY: number, targetX: number, targetY: number;

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) {
      sourceX = sourceBox.x + sourceBox.width;
      targetX = targetBox.x;
    } else {
      sourceX = sourceBox.x;
      targetX = targetBox.x + targetBox.width;
    }
    sourceY = sourceCenterY;
    targetY = targetCenterY;
  } else {
    if (dy > 0) {
      sourceY = sourceBox.y + sourceBox.height;
      targetY = targetBox.y;
    } else {
      sourceY = sourceBox.y;
      targetY = targetBox.y + targetBox.height;
    }
    sourceX = sourceCenterX;
    targetX = targetCenterX;
  }

  const isMainRelationship = rel.sourceTable === mainTableName || rel.targetTable === mainTableName;

  // Simple straight line for simplified mode, curved for detailed
  let path: string;
  if (simplified) {
    path = `M${sourceX},${sourceY} L${targetX},${targetY}`;
  } else {
    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2;
    path = Math.abs(dx) > Math.abs(dy)
      ? `M${sourceX},${sourceY} C${midX},${sourceY} ${midX},${targetY} ${targetX},${targetY}`
      : `M${sourceX},${sourceY} C${sourceX},${midY} ${targetX},${midY} ${targetX},${targetY}`;
  }

  return (
    <path
      d={path}
      fill="none"
      strokeWidth={isMainRelationship ? 1.5 : 1}
      className={isMainRelationship ? "stroke-primary/50" : "stroke-muted-foreground/25"}
      markerEnd={isMainRelationship ? "url(#arrowhead)" : "url(#arrowhead-muted)"}
    />
  );
}

interface TableBoxComponentProps {
  box: TableBox;
  viewMode: ViewMode;
  simplified?: boolean;
  isMatch?: boolean;
  isCurrentMatch?: boolean;
  dimmed?: boolean;
}

function TableBoxComponent({ box, viewMode, simplified, isMatch, isCurrentMatch, dimmed }: TableBoxComponentProps) {
  const isCompact = viewMode === "compact";
  const headerHeight = isCompact ? HEADER_HEIGHT_COMPACT : HEADER_HEIGHT;
  const displayColumns = isCompact ? [] : box.columns.slice(0, MAX_COLUMNS_DISPLAY);
  const hasMore = !isCompact && box.columns.length > MAX_COLUMNS_DISPLAY;

  return (
    <g
      transform={`translate(${box.x}, ${box.y})`}
      filter={simplified ? undefined : "url(#table-shadow)"}
      opacity={dimmed ? 0.3 : 1}
    >
      {/* Highlight ring for current match */}
      {isCurrentMatch && (
        <rect
          x="-4"
          y="-4"
          width={box.width + 8}
          height={box.height + 8}
          rx="10"
          className="fill-none stroke-primary stroke-2"
          strokeDasharray="4 2"
        />
      )}
      {/* Background */}
      <rect
        x="0"
        y="0"
        width={box.width}
        height={box.height}
        rx="6"
        className={cn(
          "fill-background",
          isCurrentMatch ? "stroke-primary stroke-2" :
          isMatch ? "stroke-amber-500 stroke-[1.5]" :
          box.isMain ? "stroke-primary stroke-[1.5]" : "stroke-border"
        )}
      />

      {/* Header background */}
      <rect
        x="0"
        y="0"
        width={box.width}
        height={headerHeight}
        rx="6"
        className={box.isMain ? "fill-primary/10" : "fill-muted/70"}
      />
      {!isCompact && (
        <rect
          x="0"
          y={headerHeight - 6}
          width={box.width}
          height="6"
          className={box.isMain ? "fill-primary/10" : "fill-muted/70"}
        />
      )}
      {!isCompact && (
        <line
          x1="0"
          y1={headerHeight}
          x2={box.width}
          y2={headerHeight}
          className="stroke-border"
          strokeWidth="1"
        />
      )}

      {/* Table Icon (simplified for compact) */}
      <g transform={`translate(10, ${isCompact ? 9 : 10})`}>
        <rect x="0" y="0" width="5" height="5" rx="1" className={box.isMain ? "fill-primary/70" : "fill-muted-foreground/50"} />
        <rect x="6" y="0" width="5" height="5" rx="1" className={box.isMain ? "fill-primary/70" : "fill-muted-foreground/50"} />
        <rect x="0" y="6" width="5" height="5" rx="1" className={box.isMain ? "fill-primary/70" : "fill-muted-foreground/50"} />
        <rect x="6" y="6" width="5" height="5" rx="1" className={box.isMain ? "fill-primary/70" : "fill-muted-foreground/50"} />
      </g>

      {/* Table Name */}
      <text
        x="28"
        y={isCompact ? 21 : 24}
        className={box.isMain ? "fill-primary" : "fill-foreground"}
        style={{ fontSize: isCompact ? "11px" : "12px", fontWeight: 600 }}
      >
        {truncateText(box.displayName, isCompact ? 14 : 18)}
      </text>

      {/* Column count badge for compact mode */}
      {isCompact && (
        <text
          x={box.width - 8}
          y="21"
          textAnchor="end"
          className="fill-muted-foreground"
          style={{ fontSize: "9px" }}
        >
          {box.columns.length}
        </text>
      )}

      {/* Columns (detailed mode only) */}
      {displayColumns.map((col, idx) => {
        const y = headerHeight + idx * ROW_HEIGHT;
        const isPK = col.isPrimaryKey;

        return (
          <g key={col.name}>
            {isPK && (
              <text
                x="8"
                y={y + 15}
                className="fill-amber-500"
                style={{ fontSize: "9px", fontWeight: 600, fontFamily: "ui-monospace, monospace" }}
              >
                PK
              </text>
            )}
            <text
              x={isPK ? 24 : 8}
              y={y + 15}
              className="fill-foreground"
              style={{ fontSize: "11px", fontFamily: "ui-monospace, monospace" }}
            >
              {truncateText(col.name, isPK ? 14 : 16)}
            </text>
            <text
              x={box.width - 8}
              y={y + 15}
              textAnchor="end"
              className="fill-muted-foreground"
              style={{ fontSize: "9px", fontFamily: "ui-monospace, monospace" }}
            >
              {formatDataType(col.dataType)}
            </text>
          </g>
        );
      })}

      {/* More columns indicator */}
      {hasMore && (
        <text
          x={box.width / 2}
          y={headerHeight + displayColumns.length * ROW_HEIGHT + 14}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: "10px" }}
        >
          +{box.columns.length - MAX_COLUMNS_DISPLAY} more
        </text>
      )}
    </g>
  );
}

function truncateText(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + "…" : text;
}

function formatDataType(dataType: string): string {
  const type = dataType.toLowerCase();
  if (type.includes("character varying")) return "varchar";
  if (type.includes("timestamp without time zone")) return "timestamp";
  if (type.includes("timestamp with time zone")) return "timestamptz";
  if (type.includes("double precision")) return "double";
  if (type.length > 12) return type.slice(0, 10) + "…";
  return type;
}

// Improved layout algorithm with proper grid spacing
function layoutTables(tables: TableProperties[], mainTableName?: string, viewMode: ViewMode = "detailed"): TableBox[] {
  if (tables.length === 0) return [];

  const tableWidth = viewMode === "compact" ? TABLE_WIDTH_COMPACT : TABLE_WIDTH;
  const boxes: TableBox[] = [];

  // Calculate all heights first
  const tableHeights = new Map<string, number>();
  tables.forEach(table => {
    tableHeights.set(table.tableName, calculateTableHeight(table.columns, viewMode));
  });

  // Find the main table if specified
  const mainTable = mainTableName
    ? tables.find(t => t.tableName === mainTableName)
    : null;

  const otherTables = mainTable ? tables.filter(t => t !== mainTable) : tables;

  // For small number of tables, use circle layout
  if (tables.length <= 6 && mainTable) {
    const mainHeight = tableHeights.get(mainTable.tableName) || 100;
    boxes.push({
      name: mainTable.tableName,
      displayName: getDisplayName(mainTable.tableName),
      columns: mainTable.columns,
      x: 0,
      y: 0,
      width: tableWidth,
      height: mainHeight,
      isMain: true,
    });

    const radius = Math.max(300, 150 + otherTables.length * 50);
    const angleStep = (2 * Math.PI) / otherTables.length;

    otherTables.forEach((table, idx) => {
      const angle = angleStep * idx - Math.PI / 2;
      const height = tableHeights.get(table.tableName) || 100;
      boxes.push({
        name: table.tableName,
        displayName: getDisplayName(table.tableName),
        columns: table.columns,
        x: Math.cos(angle) * radius - tableWidth / 2,
        y: Math.sin(angle) * radius - height / 2,
        width: tableWidth,
        height,
      });
    });
  } else {
    // Grid layout for larger number of tables
    const allTables = mainTable ? [mainTable, ...otherTables] : otherTables;
    const cols = Math.ceil(Math.sqrt(allTables.length));

    // Calculate row heights (max height in each row)
    const rowHeights: number[] = [];
    for (let i = 0; i < allTables.length; i += cols) {
      const rowTables = allTables.slice(i, i + cols);
      const maxHeight = Math.max(...rowTables.map(t => tableHeights.get(t.tableName) || 100));
      rowHeights.push(maxHeight);
    }

    let currentY = 0;
    allTables.forEach((table, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const height = tableHeights.get(table.tableName) || 100;

      // Calculate Y position based on accumulated row heights
      if (col === 0 && row > 0) {
        currentY = rowHeights.slice(0, row).reduce((sum, h) => sum + h + GRID_GAP_Y, 0);
      }

      boxes.push({
        name: table.tableName,
        displayName: getDisplayName(table.tableName),
        columns: table.columns,
        x: col * (tableWidth + GRID_GAP_X),
        y: row === 0 ? 0 : currentY,
        width: tableWidth,
        height,
        isMain: table === mainTable,
      });
    });
  }

  return boxes;
}

function getDisplayName(tableName: string): string {
  return tableName.includes(".") ? tableName.split(".").pop()! : tableName;
}

function calculateBounds(boxes: TableBox[]): { minX: number; minY: number; maxX: number; maxY: number } {
  if (boxes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const box of boxes) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }

  return { minX, minY, maxX, maxY };
}
