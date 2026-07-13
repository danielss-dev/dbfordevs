import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Columns,
  KeyRound,
  Link,
  ListOrdered,
  Plus,
  Minus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  SchemaDiffResult,
  ColumnDiff,
  IndexDiff,
  ConstraintDiff,
  ForeignKeyDiff,
  DiffChangeType,
} from "@/types";

interface DiffVisualizationStepProps {
  result: SchemaDiffResult;
}

const changeTypeStyles: Record<DiffChangeType, { bg: string; text: string; icon: React.ElementType }> = {
  added: {
    bg: "bg-success/10",
    text: "text-success",
    icon: Plus,
  },
  removed: {
    bg: "bg-destructive/10",
    text: "text-destructive",
    icon: Minus,
  },
  modified: {
    bg: "bg-warning/20",
    text: "text-warning",
    icon: RefreshCw,
  },
};

function ChangeTypeBadge({ type }: { type: DiffChangeType }) {
  const style = changeTypeStyles[type];
  const Icon = style.icon;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 capitalize", style.bg, style.text, "border-transparent")}
    >
      <Icon className="h-3 w-3" />
      {type}
    </Badge>
  );
}

function ColumnDiffItem({ diff }: { diff: ColumnDiff }) {
  const style = changeTypeStyles[diff.changeType];
  const column = diff.sourceColumn || diff.targetColumn;

  return (
    <div className={cn("p-3 rounded-md", style.bg)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={cn("font-mono font-medium", style.text)}>{diff.name}</span>
          {column && (
            <span className="text-xs text-muted-foreground font-mono">
              {column.dataType}
            </span>
          )}
        </div>
        <ChangeTypeBadge type={diff.changeType} />
      </div>
      {diff.changes.length > 0 && (
        <ul className="text-sm space-y-1">
          {diff.changes.map((change, i) => (
            <li key={i} className="text-muted-foreground">
              {change}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IndexDiffItem({ diff }: { diff: IndexDiff }) {
  const style = changeTypeStyles[diff.changeType];
  const index = diff.sourceIndex || diff.targetIndex;

  return (
    <div className={cn("p-3 rounded-md", style.bg)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={cn("font-mono font-medium", style.text)}>{diff.name}</span>
          {index && (
            <span className="text-xs text-muted-foreground">
              ({index.columns.join(", ")})
              {index.isUnique && " UNIQUE"}
            </span>
          )}
        </div>
        <ChangeTypeBadge type={diff.changeType} />
      </div>
      {diff.changes.length > 0 && (
        <ul className="text-sm space-y-1">
          {diff.changes.map((change, i) => (
            <li key={i} className="text-muted-foreground">
              {change}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConstraintDiffItem({ diff }: { diff: ConstraintDiff }) {
  const style = changeTypeStyles[diff.changeType];
  const constraint = diff.sourceConstraint || diff.targetConstraint;

  return (
    <div className={cn("p-3 rounded-md", style.bg)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={cn("font-mono font-medium", style.text)}>{diff.name}</span>
          {constraint && (
            <span className="text-xs text-muted-foreground">
              {constraint.constraintType}
            </span>
          )}
        </div>
        <ChangeTypeBadge type={diff.changeType} />
      </div>
      {diff.changes.length > 0 && (
        <ul className="text-sm space-y-1">
          {diff.changes.map((change, i) => (
            <li key={i} className="text-muted-foreground">
              {change}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ForeignKeyDiffItem({ diff }: { diff: ForeignKeyDiff }) {
  const style = changeTypeStyles[diff.changeType];
  const fk = diff.sourceFk || diff.targetFk;

  return (
    <div className={cn("p-3 rounded-md", style.bg)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {fk && (
            <span className={cn("font-mono font-medium", style.text)}>
              {fk.column} → {fk.referencesTable}.{fk.referencesColumn}
            </span>
          )}
        </div>
        <ChangeTypeBadge type={diff.changeType} />
      </div>
      {diff.changes.length > 0 && (
        <ul className="text-sm space-y-1">
          {diff.changes.map((change, i) => (
            <li key={i} className="text-muted-foreground">
              {change}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DiffVisualizationStep({ result }: DiffVisualizationStepProps) {
  const totalChanges =
    result.columnDiffs.length +
    result.indexDiffs.length +
    result.constraintDiffs.length +
    result.foreignKeyDiffs.length;

  if (result.isIdentical) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <CheckCircle2 className="h-12 w-12 text-success mb-4" />
        <h3 className="text-lg font-medium mb-2">Schemas are identical</h3>
        <p className="text-muted-foreground">
          No differences found between{" "}
          <span className="font-mono">{result.sourceTable}</span> and{" "}
          <span className="font-mono">{result.targetTable}</span>
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(85vh-220px)]">
      <div className="p-4 space-y-4">
        {/* Summary */}
        <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
          <div className="flex-1">
            <h3 className="font-medium">
              Comparing{" "}
              <span className="font-mono text-info">
                {result.sourceTable}
              </span>{" "}
              →{" "}
              <span className="font-mono text-success">
                {result.targetTable}
              </span>
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {totalChanges} {totalChanges === 1 ? "change" : "changes"} detected
            </p>
          </div>
          {result.requiresTableRecreation && (
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm font-medium">Requires table recreation</span>
            </div>
          )}
        </div>

        {/* Warnings */}
        {result.warnings.length > 0 && (
          <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg">
            <h4 className="font-medium text-warning mb-2">
              Warnings
            </h4>
            <ul className="text-sm space-y-1 text-warning">
              {result.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Diff sections */}
        <Accordion
          type="multiple"
          defaultValue={["columns", "indexes", "constraints", "foreign-keys"]}
          className="space-y-2"
        >
          {/* Columns */}
          {result.columnDiffs.length > 0 && (
            <AccordionItem value="columns" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Columns className="h-4 w-4" />
                  <span>Columns</span>
                  <Badge variant="secondary" className="ml-2">
                    {result.columnDiffs.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pb-2">
                  {result.columnDiffs.map((diff, i) => (
                    <ColumnDiffItem key={i} diff={diff} />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Indexes */}
          {result.indexDiffs.length > 0 && (
            <AccordionItem value="indexes" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <ListOrdered className="h-4 w-4" />
                  <span>Indexes</span>
                  <Badge variant="secondary" className="ml-2">
                    {result.indexDiffs.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pb-2">
                  {result.indexDiffs.map((diff, i) => (
                    <IndexDiffItem key={i} diff={diff} />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Constraints */}
          {result.constraintDiffs.length > 0 && (
            <AccordionItem value="constraints" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  <span>Constraints</span>
                  <Badge variant="secondary" className="ml-2">
                    {result.constraintDiffs.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pb-2">
                  {result.constraintDiffs.map((diff, i) => (
                    <ConstraintDiffItem key={i} diff={diff} />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Foreign Keys */}
          {result.foreignKeyDiffs.length > 0 && (
            <AccordionItem value="foreign-keys" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  <span>Foreign Keys</span>
                  <Badge variant="secondary" className="ml-2">
                    {result.foreignKeyDiffs.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pb-2">
                  {result.foreignKeyDiffs.map((diff, i) => (
                    <ForeignKeyDiffItem key={i} diff={diff} />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </div>
    </ScrollArea>
  );
}
