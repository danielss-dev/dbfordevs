import { useState, useEffect, useRef, useCallback } from "react";
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

const TABLE_WIDTH = 240;
const ROW_HEIGHT = 26;
const HEADER_HEIGHT = 42;
const PADDING = 16;
const MAX_COLUMNS_DISPLAY = 10;

function calculateTableHeight(columns: ExtendedColumnInfo[]): number {
  const displayCols = Math.min(columns.length, MAX_COLUMNS_DISPLAY);
  const hasMore = columns.length > MAX_COLUMNS_DISPLAY;
  return HEADER_HEIGHT + displayCols * ROW_HEIGHT + (hasMore ? 24 : 0) + PADDING;
}

export function TableDiagramTab({ tab }: TableDiagramTabProps) {
  const { getTableRelationships, getTableProperties, getTables, generateTableDdl } = useDatabase();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [relationships, setRelationships] = useState<TableRelationship[]>([]);
  const [tableBoxes, setTableBoxes] = useState<TableBox[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Check if this is a schema diagram (no tableName means show all tables in schema)
  const isSchemaMode = tab.type === "diagram" && !tab.tableName;
  const schemaName = isSchemaMode ? tab.content : null;

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

    try {
      let allTables: TableProperties[] = [];
      let allRelationships: TableRelationship[] = [];

      if (isSchemaMode && schemaName) {
        // Load all tables in the schema
        const tables = await getTables(tab.connectionId);
        const schemaTables = tables.filter(t => t.schema === schemaName || (!t.schema && schemaName === "default"));

        for (const tableInfo of schemaTables) {
          const props = await getTableProperties(tab.connectionId, tableInfo.name);
          if (props) {
            allTables.push(props);
            const rels = await getTableRelationships(tab.connectionId, tableInfo.name);
            // Add relationships that aren't already in the list
            for (const rel of rels) {
              if (!allRelationships.some(r =>
                r.sourceTable === rel.sourceTable &&
                r.sourceColumn === rel.sourceColumn &&
                r.targetTable === rel.targetTable &&
                r.targetColumn === rel.targetColumn
              )) {
                allRelationships.push(rel);
              }
            }
          }
        }
      } else if (tab.tableName) {
        // Single table mode - load main table and related tables
        const props = await getTableProperties(tab.connectionId, tab.tableName);
        if (props) {
          allTables.push(props);

          const rels = await getTableRelationships(tab.connectionId, tab.tableName);
          allRelationships = rels;

          // Load related table properties
          const relatedTableNames = new Set<string>();
          rels.forEach((rel) => {
            if (rel.sourceTable !== tab.tableName) relatedTableNames.add(rel.sourceTable);
            if (rel.targetTable !== tab.tableName) relatedTableNames.add(rel.targetTable);
          });

          for (const tableName of relatedTableNames) {
            const tableProps = await getTableProperties(tab.connectionId, tableName);
            if (tableProps) {
              allTables.push(tableProps);
            }
          }
        }
      }

      setRelationships(allRelationships);

      // Calculate positions for all tables
      const boxes = layoutTables(allTables, tab.tableName);
      setTableBoxes(boxes);

      // Auto-center the view
      if (boxes.length > 0 && containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;
        const bounds = calculateBounds(boxes);
        const contentWidth = bounds.maxX - bounds.minX;
        const contentHeight = bounds.maxY - bounds.minY;

        setPan({
          x: (containerWidth - contentWidth * zoom) / 2 - bounds.minX * zoom,
          y: (containerHeight - contentHeight * zoom) / 2 - bounds.minY * zoom + 20,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load diagram");
    } finally {
      setIsLoading(false);
    }
  }, [tab.connectionId, tab.tableName, isSchemaMode, schemaName, getTableProperties, getTableRelationships, getTables, zoom]);

  useEffect(() => {
    loadDiagram();
  }, [loadDiagram]);

  // Mouse handlers for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (panMode || e.button === 1) { // Middle mouse button or pan mode
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
      setZoom(Math.max(0.25, Math.min(3, zoom + delta)));
    } else {
      // Pan with scroll
      setPan({
        x: pan.x - e.deltaX,
        y: pan.y - e.deltaY,
      });
    }
  };

  const fitToScreen = () => {
    if (!containerRef.current || tableBoxes.length === 0) return;

    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    const bounds = calculateBounds(tableBoxes);
    const contentWidth = bounds.maxX - bounds.minX + 100;
    const contentHeight = bounds.maxY - bounds.minY + 100;

    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    const newZoom = Math.min(scaleX, scaleY, 1.5);

    setZoom(newZoom);
    setPan({
      x: (containerWidth - contentWidth * newZoom) / 2 - bounds.minX * newZoom + 50,
      y: (containerHeight - contentHeight * newZoom) / 2 - bounds.minY * newZoom + 50,
    });
  };

  const displayName = tab.tableName?.includes(".")
    ? tab.tableName.split(".").pop()
    : tab.tableName;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading diagram...</span>
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
              <Button variant="ghost" size="sm" onClick={() => setZoom(Math.max(0.25, zoom - 0.1))}>
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
          "flex-1 overflow-hidden bg-[radial-gradient(circle_at_1px_1px,hsl(var(--muted))_1px,transparent_0)] [background-size:24px_24px]",
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
            {/* Arrow markers */}
            <marker
              id="arrowhead"
              markerWidth="12"
              markerHeight="8"
              refX="10"
              refY="4"
              orient="auto"
            >
              <path
                d="M0,0 L12,4 L0,8 L3,4 Z"
                className="fill-primary/60"
              />
            </marker>
            <marker
              id="arrowhead-muted"
              markerWidth="12"
              markerHeight="8"
              refX="10"
              refY="4"
              orient="auto"
            >
              <path
                d="M0,0 L12,4 L0,8 L3,4 Z"
                className="fill-muted-foreground/40"
              />
            </marker>
            {/* Drop shadow filter */}
            <filter id="table-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.15" />
            </filter>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Relationship Lines */}
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
                />
              );
            })}

            {/* Table Boxes */}
            {tableBoxes.map((box) => (
              <TableBoxComponent key={box.name} box={box} />
            ))}
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
}

function RelationshipLine({ rel, sourceBox, targetBox, mainTableName }: RelationshipLineProps) {
  // Calculate connection points on the edges of boxes
  const sourceCenterX = sourceBox.x + sourceBox.width / 2;
  const sourceCenterY = sourceBox.y + sourceBox.height / 2;
  const targetCenterX = targetBox.x + targetBox.width / 2;
  const targetCenterY = targetBox.y + targetBox.height / 2;

  // Determine which sides to connect
  const dx = targetCenterX - sourceCenterX;
  const dy = targetCenterY - sourceCenterY;

  let sourceX: number, sourceY: number, targetX: number, targetY: number;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Connect horizontally
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
    // Connect vertically
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

  // Create a curved path
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  const isMainRelationship = rel.sourceTable === mainTableName || rel.targetTable === mainTableName;

  // Use bezier curve for smoother lines
  const path = Math.abs(dx) > Math.abs(dy)
    ? `M${sourceX},${sourceY} C${midX},${sourceY} ${midX},${targetY} ${targetX},${targetY}`
    : `M${sourceX},${sourceY} C${sourceX},${midY} ${targetX},${midY} ${targetX},${targetY}`;

  return (
    <g>
      <path
        d={path}
        fill="none"
        strokeWidth={isMainRelationship ? 2 : 1.5}
        className={isMainRelationship ? "stroke-primary/50" : "stroke-muted-foreground/30"}
        markerEnd={isMainRelationship ? "url(#arrowhead)" : "url(#arrowhead-muted)"}
      />
      {/* Relationship label */}
      <text
        x={midX}
        y={midY - 8}
        textAnchor="middle"
        className="fill-muted-foreground/70"
        style={{ fontSize: "10px", fontFamily: "ui-monospace, monospace" }}
      >
        {rel.sourceColumn} → {rel.targetColumn}
      </text>
    </g>
  );
}

interface TableBoxComponentProps {
  box: TableBox;
}

function TableBoxComponent({ box }: TableBoxComponentProps) {
  const displayColumns = box.columns.slice(0, MAX_COLUMNS_DISPLAY);
  const hasMore = box.columns.length > MAX_COLUMNS_DISPLAY;

  return (
    <g transform={`translate(${box.x}, ${box.y})`} filter="url(#table-shadow)">
      {/* Background */}
      <rect
        x="0"
        y="0"
        width={box.width}
        height={box.height}
        rx="8"
        className={cn(
          "fill-background",
          box.isMain ? "stroke-primary stroke-2" : "stroke-border"
        )}
      />

      {/* Header background */}
      <rect
        x="0"
        y="0"
        width={box.width}
        height={HEADER_HEIGHT}
        rx="8"
        className={box.isMain ? "fill-primary/10" : "fill-muted/80"}
      />
      {/* Header bottom square corners */}
      <rect
        x="0"
        y={HEADER_HEIGHT - 8}
        width={box.width}
        height="8"
        className={box.isMain ? "fill-primary/10" : "fill-muted/80"}
      />
      {/* Header border */}
      <line
        x1="0"
        y1={HEADER_HEIGHT}
        x2={box.width}
        y2={HEADER_HEIGHT}
        className="stroke-border"
        strokeWidth="1"
      />

      {/* Table Icon (SVG grid) */}
      <g transform="translate(14, 13)">
        <rect x="0" y="0" width="6" height="6" rx="1" className={box.isMain ? "fill-primary/70" : "fill-muted-foreground/60"} />
        <rect x="8" y="0" width="6" height="6" rx="1" className={box.isMain ? "fill-primary/70" : "fill-muted-foreground/60"} />
        <rect x="0" y="8" width="6" height="6" rx="1" className={box.isMain ? "fill-primary/70" : "fill-muted-foreground/60"} />
        <rect x="8" y="8" width="6" height="6" rx="1" className={box.isMain ? "fill-primary/70" : "fill-muted-foreground/60"} />
      </g>

      {/* Table Name */}
      <text
        x="40"
        y="27"
        className={box.isMain ? "fill-primary" : "fill-foreground"}
        style={{ fontSize: "14px", fontWeight: 600 }}
      >
        {box.displayName}
      </text>

      {/* Columns */}
      {displayColumns.map((col, idx) => {
        const y = HEADER_HEIGHT + idx * ROW_HEIGHT;
        const isPK = col.isPrimaryKey;

        return (
          <g key={col.name}>
            {/* Row hover area */}
            <rect
              x="1"
              y={y + 1}
              width={box.width - 2}
              height={ROW_HEIGHT - 1}
              className="fill-transparent hover:fill-muted/50"
              rx="2"
            />
            {/* PK/FK indicator */}
            {isPK && (
              <text
                x="12"
                y={y + 18}
                className="fill-amber-500"
                style={{ fontSize: "10px", fontWeight: 600, fontFamily: "ui-monospace, monospace" }}
              >
                PK
              </text>
            )}
            {/* Column name */}
            <text
              x={isPK ? 32 : 12}
              y={y + 18}
              className="fill-foreground"
              style={{ fontSize: "12px", fontFamily: "ui-monospace, monospace" }}
            >
              {col.name.length > 20 ? col.name.slice(0, 18) + "…" : col.name}
            </text>
            {/* Data type */}
            <text
              x={box.width - 12}
              y={y + 18}
              textAnchor="end"
              className="fill-muted-foreground"
              style={{ fontSize: "10px", fontFamily: "ui-monospace, monospace" }}
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
          y={HEADER_HEIGHT + displayColumns.length * ROW_HEIGHT + 16}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: "11px" }}
        >
          +{box.columns.length - MAX_COLUMNS_DISPLAY} more columns
        </text>
      )}
    </g>
  );
}

// Helper function to format data types more concisely
function formatDataType(dataType: string): string {
  const type = dataType.toLowerCase();
  if (type.includes("character varying")) return "varchar";
  if (type.includes("timestamp without time zone")) return "timestamp";
  if (type.includes("timestamp with time zone")) return "timestamptz";
  if (type.includes("double precision")) return "double";
  if (type.length > 15) return type.slice(0, 13) + "…";
  return type;
}

// Layout algorithm for positioning tables
function layoutTables(tables: TableProperties[], mainTableName?: string): TableBox[] {
  if (tables.length === 0) return [];

  const boxes: TableBox[] = [];

  // Find the main table if specified
  const mainTable = mainTableName
    ? tables.find(t => t.tableName === mainTableName)
    : tables[0];

  const otherTables = tables.filter(t => t !== mainTable);

  // Position main table
  if (mainTable) {
    const height = calculateTableHeight(mainTable.columns);
    boxes.push({
      name: mainTable.tableName,
      displayName: mainTable.tableName.includes(".")
        ? mainTable.tableName.split(".").pop()!
        : mainTable.tableName,
      columns: mainTable.columns,
      x: 0,
      y: 0,
      width: TABLE_WIDTH,
      height,
      isMain: true,
    });
  }

  // Position other tables in a circle/grid around the main table
  if (otherTables.length > 0) {
    const numTables = otherTables.length;

    if (numTables <= 6) {
      // Circle layout for small number of tables
      const radius = Math.max(350, 150 + numTables * 40);
      const angleStep = (2 * Math.PI) / numTables;

      otherTables.forEach((table, idx) => {
        const angle = angleStep * idx - Math.PI / 2;
        const height = calculateTableHeight(table.columns);
        boxes.push({
          name: table.tableName,
          displayName: table.tableName.includes(".")
            ? table.tableName.split(".").pop()!
            : table.tableName,
          columns: table.columns,
          x: Math.cos(angle) * radius - TABLE_WIDTH / 2,
          y: Math.sin(angle) * radius - height / 2,
          width: TABLE_WIDTH,
          height,
        });
      });
    } else {
      // Grid layout for more tables
      const cols = Math.ceil(Math.sqrt(numTables + 1));
      const spacing = { x: TABLE_WIDTH + 80, y: 300 };

      otherTables.forEach((table, idx) => {
        const gridIdx = idx + 1; // Skip center position for main table
        const row = Math.floor(gridIdx / cols);
        const col = gridIdx % cols;
        const height = calculateTableHeight(table.columns);

        boxes.push({
          name: table.tableName,
          displayName: table.tableName.includes(".")
            ? table.tableName.split(".").pop()!
            : table.tableName,
          columns: table.columns,
          x: (col - Math.floor(cols / 2)) * spacing.x,
          y: (row - Math.floor(cols / 2)) * spacing.y,
          width: TABLE_WIDTH,
          height,
        });
      });
    }
  }

  return boxes;
}

// Calculate bounding box of all tables
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
