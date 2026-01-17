import { cn } from "@/lib/utils";
import type { CustomTheme, ThemeColors, SyntaxTokenColors } from "@/types/theme";
import { Database, Check, AlertTriangle, ChevronRight, Table, Key } from "lucide-react";

interface ThemePreviewProps {
  theme: CustomTheme;
  className?: string;
}

/**
 * Convert theme colors to inline CSS style
 */
function getPreviewStyle(colors: ThemeColors): React.CSSProperties {
  return {
    "--preview-bg": `hsl(${colors.background})`,
    "--preview-fg": `hsl(${colors.foreground})`,
    "--preview-card": `hsl(${colors.card})`,
    "--preview-card-fg": `hsl(${colors.cardForeground})`,
    "--preview-primary": `hsl(${colors.primary})`,
    "--preview-primary-fg": `hsl(${colors.primaryForeground})`,
    "--preview-secondary": `hsl(${colors.secondary})`,
    "--preview-secondary-fg": `hsl(${colors.secondaryForeground})`,
    "--preview-muted": `hsl(${colors.muted})`,
    "--preview-muted-fg": `hsl(${colors.mutedForeground})`,
    "--preview-accent": `hsl(${colors.accent})`,
    "--preview-accent-fg": `hsl(${colors.accentForeground})`,
    "--preview-destructive": `hsl(${colors.destructive})`,
    "--preview-border": `hsl(${colors.border})`,
    "--preview-success": `hsl(${colors.success})`,
    "--preview-warning": `hsl(${colors.warning})`,
    "--preview-info": `hsl(${colors.info})`,
    "--preview-sidebar-bg": `hsl(${colors.sidebarBackground})`,
    "--preview-sidebar-fg": `hsl(${colors.sidebarForeground})`,
    "--preview-sidebar-accent": `hsl(${colors.sidebarAccent})`,
    "--preview-table-header": `hsl(${colors.tableHeaderBg})`,
    "--preview-table-row-odd": `hsl(${colors.tableRowOdd})`,
    "--preview-table-row-even": `hsl(${colors.tableRowEven})`,
    "--preview-text-primary": `hsl(${colors.textPrimary})`,
    "--preview-text-secondary": `hsl(${colors.textSecondary})`,
    "--preview-text-dim": `hsl(${colors.textDim})`,
  } as React.CSSProperties;
}

/**
 * Code preview with syntax highlighting
 */
function CodePreview({ syntaxColors }: { syntaxColors: SyntaxTokenColors }) {
  return (
    <div className="font-mono text-[10px] leading-relaxed">
      <span style={{ color: syntaxColors.keyword, fontWeight: "bold" }}>SELECT</span>
      <span style={{ color: syntaxColors.operator }}> * </span>
      <span style={{ color: syntaxColors.keyword, fontWeight: "bold" }}>FROM</span>
      <span style={{ color: syntaxColors.identifier }}> users </span>
      <span style={{ color: syntaxColors.keyword, fontWeight: "bold" }}>WHERE</span>
      <span style={{ color: syntaxColors.identifier }}> status </span>
      <span style={{ color: syntaxColors.operator }}>= </span>
      <span style={{ color: syntaxColors.string }}>'active'</span>
      <br />
      <span style={{ color: syntaxColors.keyword, fontWeight: "bold" }}>AND</span>
      <span style={{ color: syntaxColors.identifier }}> age </span>
      <span style={{ color: syntaxColors.operator }}>&gt; </span>
      <span style={{ color: syntaxColors.number }}>18</span>
      <span style={{ color: syntaxColors.operator }}>;</span>
      <br />
      <span style={{ color: syntaxColors.comment, fontStyle: "italic" }}>-- Filter active users</span>
    </div>
  );
}

export function ThemePreview({ theme, className }: ThemePreviewProps) {
  const { colors, syntaxColors, databaseIcons } = theme;
  const style = getPreviewStyle(colors);

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden text-[11px]",
        className
      )}
      style={{
        ...style,
        backgroundColor: "var(--preview-bg)",
        color: "var(--preview-fg)",
        borderColor: "var(--preview-border)",
      }}
    >
      {/* Mini app layout */}
      <div className="flex h-[280px]">
        {/* Sidebar */}
        <div
          className="w-[100px] border-r flex flex-col"
          style={{
            backgroundColor: "var(--preview-sidebar-bg)",
            borderColor: "var(--preview-border)",
          }}
        >
          <div
            className="px-2 py-1.5 text-[10px] font-medium"
            style={{ color: "var(--preview-sidebar-fg)" }}
          >
            Connections
          </div>
          <div className="flex-1 px-1 space-y-0.5 overflow-hidden">
            {/* Connection items */}
            <div
              className="flex items-center gap-1 px-1.5 py-1 rounded text-[9px]"
              style={{ backgroundColor: "var(--preview-sidebar-accent)" }}
            >
              <Database className="w-3 h-3" style={{ color: databaseIcons.postgresql }} />
              <span style={{ color: "var(--preview-sidebar-fg)" }}>Production</span>
            </div>
            <div className="flex items-center gap-1 px-1.5 py-1 rounded text-[9px]">
              <Database className="w-3 h-3" style={{ color: databaseIcons.mysql }} />
              <span style={{ color: "var(--preview-text-secondary)" }}>Staging</span>
            </div>
            <div className="flex items-center gap-1 px-1.5 py-1 rounded text-[9px]">
              <Database className="w-3 h-3" style={{ color: databaseIcons.sqlite }} />
              <span style={{ color: "var(--preview-text-secondary)" }}>Local</span>
            </div>

            {/* Table tree */}
            <div className="mt-2 pt-2 border-t" style={{ borderColor: "var(--preview-border)" }}>
              <div className="flex items-center gap-0.5 px-1 py-0.5 text-[9px]">
                <ChevronRight className="w-2.5 h-2.5" style={{ color: "var(--preview-text-dim)" }} />
                <Table className="w-2.5 h-2.5" style={{ color: "var(--preview-primary)" }} />
                <span style={{ color: "var(--preview-text-secondary)" }}>users</span>
              </div>
              <div className="flex items-center gap-0.5 px-1 py-0.5 text-[9px] pl-4">
                <Key className="w-2.5 h-2.5" style={{ color: "var(--preview-warning)" }} />
                <span style={{ color: "var(--preview-text-dim)" }}>id</span>
              </div>
              <div className="flex items-center gap-0.5 px-1 py-0.5 text-[9px] pl-4">
                <span className="w-2.5" />
                <span style={{ color: "var(--preview-text-dim)" }}>name</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col">
          {/* Tab bar */}
          <div
            className="flex items-center gap-1 px-2 py-1 border-b"
            style={{
              backgroundColor: "var(--preview-muted)",
              borderColor: "var(--preview-border)",
            }}
          >
            <div
              className="px-2 py-0.5 rounded text-[9px] font-medium"
              style={{
                backgroundColor: "var(--preview-card)",
                color: "var(--preview-fg)",
              }}
            >
              Query 1
            </div>
            <div
              className="px-2 py-0.5 rounded text-[9px]"
              style={{ color: "var(--preview-muted-fg)" }}
            >
              Query 2
            </div>
          </div>

          {/* Editor area */}
          <div
            className="flex-1 p-2"
            style={{ backgroundColor: "var(--preview-card)" }}
          >
            <CodePreview syntaxColors={syntaxColors} />
          </div>

          {/* Results area */}
          <div
            className="border-t"
            style={{ borderColor: "var(--preview-border)" }}
          >
            {/* Table header */}
            <div
              className="flex items-center text-[9px] font-medium"
              style={{ backgroundColor: "var(--preview-table-header)" }}
            >
              <div className="w-10 px-1.5 py-1 border-r" style={{ borderColor: "var(--preview-border)" }}>id</div>
              <div className="w-16 px-1.5 py-1 border-r" style={{ borderColor: "var(--preview-border)" }}>name</div>
              <div className="flex-1 px-1.5 py-1">status</div>
            </div>
            {/* Table rows */}
            <div
              className="flex items-center text-[9px]"
              style={{ backgroundColor: "var(--preview-table-row-odd)" }}
            >
              <div className="w-10 px-1.5 py-1 border-r" style={{ borderColor: "var(--preview-border)", color: "var(--preview-text-dim)" }}>1</div>
              <div className="w-16 px-1.5 py-1 border-r" style={{ borderColor: "var(--preview-border)", color: "var(--preview-text-primary)" }}>John</div>
              <div className="flex-1 px-1.5 py-1">
                <span
                  className="inline-flex items-center px-1 rounded text-[8px]"
                  style={{ backgroundColor: `hsl(${colors.success} / 0.2)`, color: `hsl(${colors.success})` }}
                >
                  <Check className="w-2 h-2 mr-0.5" />
                  active
                </span>
              </div>
            </div>
            <div
              className="flex items-center text-[9px]"
              style={{ backgroundColor: "var(--preview-table-row-even)" }}
            >
              <div className="w-10 px-1.5 py-1 border-r" style={{ borderColor: "var(--preview-border)", color: "var(--preview-text-dim)" }}>2</div>
              <div className="w-16 px-1.5 py-1 border-r" style={{ borderColor: "var(--preview-border)", color: "var(--preview-text-primary)" }}>Jane</div>
              <div className="flex-1 px-1.5 py-1">
                <span
                  className="inline-flex items-center px-1 rounded text-[8px]"
                  style={{ backgroundColor: `hsl(${colors.warning} / 0.2)`, color: `hsl(${colors.warning})` }}
                >
                  <AlertTriangle className="w-2 h-2 mr-0.5" />
                  pending
                </span>
              </div>
            </div>
          </div>

          {/* Status bar */}
          <div
            className="flex items-center justify-between px-2 py-0.5 text-[8px] border-t"
            style={{
              backgroundColor: "var(--preview-muted)",
              borderColor: "var(--preview-border)",
              color: "var(--preview-muted-fg)",
            }}
          >
            <span>2 rows returned</span>
            <span>12ms</span>
          </div>
        </div>
      </div>

      {/* Preview buttons row */}
      <div
        className="flex items-center justify-center gap-2 px-3 py-2 border-t"
        style={{
          backgroundColor: "var(--preview-card)",
          borderColor: "var(--preview-border)",
        }}
      >
        <button
          className="px-2 py-1 rounded text-[9px] font-medium"
          style={{
            backgroundColor: "var(--preview-primary)",
            color: "var(--preview-primary-fg)",
          }}
        >
          Primary
        </button>
        <button
          className="px-2 py-1 rounded text-[9px] font-medium"
          style={{
            backgroundColor: "var(--preview-secondary)",
            color: "var(--preview-secondary-fg)",
          }}
        >
          Secondary
        </button>
        <button
          className="px-2 py-1 rounded text-[9px] font-medium"
          style={{
            backgroundColor: "var(--preview-destructive)",
            color: "white",
          }}
        >
          Danger
        </button>
      </div>
    </div>
  );
}
