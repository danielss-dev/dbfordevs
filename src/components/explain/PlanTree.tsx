import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  Database,
  Hash,
  Search,
  GitMerge,
  ListTree,
  ArrowRightLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui";
import type { PlanNode } from "@/types";

interface PlanTreeProps {
  node: PlanNode;
  depth?: number;
  maxCost?: number;
}

const getNodeIcon = (nodeType: string) => {
  const type = nodeType.toLowerCase();
  if (type.includes("seq scan") || type.includes("table scan") || type.includes("full table scan")) {
    return <Database className="h-4 w-4 text-amber-500" />;
  }
  if (type.includes("index")) {
    return <Search className="h-4 w-4 text-green-500" />;
  }
  if (type.includes("hash")) {
    return <Hash className="h-4 w-4 text-blue-500" />;
  }
  if (type.includes("join") || type.includes("merge") || type.includes("nested loop")) {
    return <GitMerge className="h-4 w-4 text-purple-500" />;
  }
  if (type.includes("sort")) {
    return <ListTree className="h-4 w-4 text-orange-500" />;
  }
  if (type.includes("aggregate") || type.includes("group")) {
    return <ArrowRightLeft className="h-4 w-4 text-cyan-500" />;
  }
  return <Database className="h-4 w-4 text-muted-foreground" />;
};

const getCostColor = (cost: number, maxCost: number) => {
  if (maxCost === 0) return "text-muted-foreground";
  const ratio = cost / maxCost;
  if (ratio > 0.7) return "text-red-500";
  if (ratio > 0.4) return "text-amber-500";
  return "text-green-500";
};

const getCostBarColor = (cost: number, maxCost: number) => {
  if (maxCost === 0) return "bg-muted";
  const ratio = cost / maxCost;
  if (ratio > 0.7) return "bg-red-500";
  if (ratio > 0.4) return "bg-amber-500";
  return "bg-green-500";
};

export function PlanTreeNode({ node, depth = 0, maxCost = 1 }: PlanTreeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const cost = node.totalCost || 0;
  const costRatio = maxCost > 0 ? cost / maxCost : 0;

  const isSequentialScan =
    node.nodeType.toLowerCase().includes("seq scan") ||
    node.nodeType.toLowerCase().includes("table scan") ||
    node.nodeType.toLowerCase().includes("full table scan");
  const hasWarnings = node.warnings.length > 0 || isSequentialScan;

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-start gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
          "hover:bg-muted/50",
          hasWarnings && "bg-amber-500/5"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {/* Expand/Collapse */}
        <span className="w-4 h-4 flex items-center justify-center shrink-0 mt-0.5">
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : null}
        </span>

        {/* Node icon */}
        <span className="shrink-0 mt-0.5">{getNodeIcon(node.nodeType)}</span>

        {/* Node content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{node.nodeType}</span>
            {node.relationName && (
              <Badge variant="secondary" className="text-[10px] h-5">
                {node.relationName}
              </Badge>
            )}
            {node.indexName && (
              <Badge
                variant="outline"
                className="text-[10px] h-5 text-green-600 border-green-500/30"
              >
                {node.indexName}
              </Badge>
            )}
            {hasWarnings && (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
            {typeof node.totalCost === 'number' && (
              <span className={getCostColor(node.totalCost, maxCost)}>
                Cost: {node.totalCost.toFixed(2)}
              </span>
            )}
            {typeof node.planRows === 'number' && (
              <span>Rows: {node.planRows.toLocaleString()}</span>
            )}
            {typeof node.actualRows === 'number' && (
              <span className="text-blue-500">
                Actual: {node.actualRows.toLocaleString()}
              </span>
            )}
            {typeof node.actualTotalTime === 'number' && (
              <span>Time: {node.actualTotalTime.toFixed(3)}ms</span>
            )}
          </div>

          {/* Filter/conditions */}
          {(node.filter || node.indexCond) && (
            <div className="text-[10px] text-muted-foreground mt-1 font-mono bg-muted/50 px-2 py-1 rounded">
              {node.filter && <div>Filter: {node.filter}</div>}
              {node.indexCond && <div>Index Cond: {node.indexCond}</div>}
            </div>
          )}
        </div>

        {/* Cost bar indicator */}
        {maxCost > 0 && (
          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden shrink-0 mt-2">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                getCostBarColor(cost, maxCost)
              )}
              style={{ width: `${Math.max(costRatio * 100, 2)}%` }}
            />
          </div>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map((child, idx) => (
            <PlanTreeNode
              key={idx}
              node={child}
              depth={depth + 1}
              maxCost={maxCost}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PlanTree({
  node,
  maxCost,
}: {
  node: PlanNode;
  maxCost?: number;
}) {
  const computedMaxCost = maxCost ?? node.totalCost ?? 1;
  return <PlanTreeNode node={node} maxCost={computedMaxCost} />;
}
