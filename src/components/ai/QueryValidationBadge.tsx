import { useMemo } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Shield,
  Gauge,
  Code,
  Zap,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button,
  Badge,
} from "@/components/ui";
import { useAIStore } from "@/lib/ai/store";
import { validateQuery, countIssuesBySeverity } from "@/lib/ai/validation";
import type { ValidationResult, ValidationIssue, ValidationCategory } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

interface QueryValidationBadgeProps {
  sql: string;
  onRunAnyway?: () => void;
}

const CATEGORY_ICONS: Record<ValidationCategory, typeof AlertCircle> = {
  syntax: Code,
  semantic: Zap,
  performance: Gauge,
  security: Shield,
};

const CATEGORY_LABELS: Record<ValidationCategory, string> = {
  syntax: "Syntax",
  semantic: "Semantic",
  performance: "Performance",
  security: "Security",
};

function IssueItem({ issue }: { issue: ValidationIssue }) {
  const Icon = CATEGORY_ICONS[issue.category];

  return (
    <div
      className={cn(
        "flex gap-2 p-2 rounded text-xs",
        issue.severity === "error" && "bg-red-500/10 text-red-400",
        issue.severity === "warning" && "bg-yellow-500/10 text-yellow-400",
        issue.severity === "info" && "bg-blue-500/10 text-blue-400"
      )}
    >
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="font-medium">{issue.message}</p>
        {issue.suggestion && (
          <p className="text-muted-foreground">{issue.suggestion}</p>
        )}
        <Badge variant="outline" className="text-[8px] h-4">
          {CATEGORY_LABELS[issue.category]}
        </Badge>
      </div>
    </div>
  );
}

export function QueryValidationBadge({ sql, onRunAnyway }: QueryValidationBadgeProps) {
  const { context, validationConfig } = useAIStore();

  const validationResult = useMemo<ValidationResult>(() => {
    if (!sql.trim()) {
      return { isValid: true, issues: [] };
    }
    return validateQuery(sql, context.tables, validationConfig);
  }, [sql, context.tables, validationConfig]);

  const counts = useMemo(
    () => countIssuesBySeverity(validationResult),
    [validationResult]
  );

  // Don't show badge if no issues
  if (validationResult.issues.length === 0) {
    return (
      <div className="flex items-center gap-1 text-[10px] text-green-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>Valid</span>
      </div>
    );
  }

  // Determine badge color based on most severe issue
  const badgeColor = counts.error > 0
    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
    : counts.warning > 0
    ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
    : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30";

  const BadgeIcon = counts.error > 0
    ? AlertCircle
    : counts.warning > 0
    ? AlertTriangle
    : Info;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
            badgeColor
          )}
        >
          <BadgeIcon className="h-3.5 w-3.5" />
          <span>
            {counts.error > 0 && `${counts.error} error${counts.error > 1 ? "s" : ""}`}
            {counts.error > 0 && counts.warning > 0 && ", "}
            {counts.warning > 0 && `${counts.warning} warning${counts.warning > 1 ? "s" : ""}`}
            {counts.error === 0 && counts.warning === 0 && counts.info > 0 &&
              `${counts.info} info`}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="start"
        side="top"
      >
        <div className="border-b border-border px-3 py-2">
          <h4 className="font-medium text-sm">Query Validation</h4>
          <p className="text-xs text-muted-foreground">
            {validationResult.issues.length} issue
            {validationResult.issues.length !== 1 ? "s" : ""} found
          </p>
        </div>

        <div className="max-h-64 overflow-y-auto p-2 space-y-2">
          {validationResult.issues.map((issue) => (
            <IssueItem key={issue.id} issue={issue} />
          ))}
        </div>

        {counts.error > 0 && onRunAnyway && (
          <div className="border-t border-border p-2">
            <Button
              variant="destructive"
              size="sm"
              className="w-full text-xs"
              onClick={onRunAnyway}
            >
              <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
              Run Anyway
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Inline validation indicator for use in SQL blocks
 */
export function ValidationIndicator({ sql }: { sql: string }) {
  const { context, validationConfig } = useAIStore();

  const validationResult = useMemo<ValidationResult>(() => {
    if (!sql.trim()) {
      return { isValid: true, issues: [] };
    }
    return validateQuery(sql, context.tables, validationConfig);
  }, [sql, context.tables, validationConfig]);

  const counts = countIssuesBySeverity(validationResult);

  if (validationResult.issues.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {counts.error > 0 && (
        <span className="flex items-center gap-1 text-[10px] text-red-400">
          <AlertCircle className="h-3 w-3" />
          {counts.error}
        </span>
      )}
      {counts.warning > 0 && (
        <span className="flex items-center gap-1 text-[10px] text-yellow-400">
          <AlertTriangle className="h-3 w-3" />
          {counts.warning}
        </span>
      )}
      {counts.info > 0 && (
        <span className="flex items-center gap-1 text-[10px] text-blue-400">
          <Info className="h-3 w-3" />
          {counts.info}
        </span>
      )}
    </div>
  );
}
