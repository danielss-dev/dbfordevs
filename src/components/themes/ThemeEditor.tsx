import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Input, Label, HSLColorPicker, Separator } from "@/components/ui";
import type { CustomTheme, ThemeColors, DatabaseIconColors, EditorThemeColors, SyntaxTokenColors } from "@/types/theme";
import { ChevronDown, ChevronRight, Palette, Database, Code2, Type, Layout, Table, Sidebar, CheckCircle } from "lucide-react";

interface ThemeEditorProps {
  theme: CustomTheme;
  onChange: (theme: CustomTheme) => void;
  className?: string;
}

interface ColorSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function ColorSection({ title, icon, children, defaultOpen = true }: ColorSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        className="flex items-center justify-between w-full px-3 py-2 bg-muted/50 hover:bg-muted/80 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="px-3 py-3 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

interface ColorRowProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  format?: "hsl" | "hex";
  description?: string;
}

function ColorRow({ label, value, onChange, format = "hsl", description }: ColorRowProps) {
  return (
    <div className="grid grid-cols-2 gap-3 items-center">
      <div>
        <span className="text-xs font-medium">{label}</span>
        {description && (
          <p className="text-[10px] text-muted-foreground">{description}</p>
        )}
      </div>
      <HSLColorPicker value={value} onChange={onChange} format={format} />
    </div>
  );
}

export function ThemeEditor({ theme, onChange, className }: ThemeEditorProps) {
  const updateColors = useCallback(
    (key: keyof ThemeColors, value: string) => {
      onChange({
        ...theme,
        colors: { ...theme.colors, [key]: value },
        updatedAt: Date.now(),
      });
    },
    [theme, onChange]
  );

  const updateDatabaseIcon = useCallback(
    (key: keyof DatabaseIconColors, value: string) => {
      onChange({
        ...theme,
        databaseIcons: { ...theme.databaseIcons, [key]: value },
        updatedAt: Date.now(),
      });
    },
    [theme, onChange]
  );

  const updateEditorColor = useCallback(
    (key: keyof EditorThemeColors, value: string) => {
      onChange({
        ...theme,
        editorColors: { ...theme.editorColors, [key]: value },
        updatedAt: Date.now(),
      });
    },
    [theme, onChange]
  );

  const updateSyntaxColor = useCallback(
    (key: keyof SyntaxTokenColors, value: string) => {
      onChange({
        ...theme,
        syntaxColors: { ...theme.syntaxColors, [key]: value },
        updatedAt: Date.now(),
      });
    },
    [theme, onChange]
  );

  return (
    <div className={cn("w-full", className)}>
      <div className="p-4 space-y-4 pb-6">
        {/* Theme Info */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Theme Name</Label>
            <Input
              value={theme.name}
              onChange={(e) =>
                onChange({ ...theme, name: e.target.value, updatedAt: Date.now() })
              }
              placeholder="My Custom Theme"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description (optional)</Label>
            <Input
              value={theme.description || ""}
              onChange={(e) =>
                onChange({ ...theme, description: e.target.value || undefined, updatedAt: Date.now() })
              }
              placeholder="A brief description of your theme"
              className="h-8 text-sm"
            />
          </div>
        </div>

        <Separator />

        {/* UI Colors */}
        <ColorSection title="UI Colors" icon={<Layout className="h-4 w-4 text-primary" />}>
          <ColorRow
            label="Background"
            description="Main app background"
            value={theme.colors.background}
            onChange={(v) => updateColors("background", v)}
          />
          <ColorRow
            label="Foreground"
            description="Primary text color"
            value={theme.colors.foreground}
            onChange={(v) => updateColors("foreground", v)}
          />
          <ColorRow
            label="Card"
            description="Card/panel backgrounds"
            value={theme.colors.card}
            onChange={(v) => updateColors("card", v)}
          />
          <ColorRow
            label="Primary"
            description="Primary brand color"
            value={theme.colors.primary}
            onChange={(v) => updateColors("primary", v)}
          />
          <ColorRow
            label="Primary Foreground"
            value={theme.colors.primaryForeground}
            onChange={(v) => updateColors("primaryForeground", v)}
          />
          <ColorRow
            label="Secondary"
            value={theme.colors.secondary}
            onChange={(v) => updateColors("secondary", v)}
          />
          <ColorRow
            label="Muted"
            description="Subtle backgrounds"
            value={theme.colors.muted}
            onChange={(v) => updateColors("muted", v)}
          />
          <ColorRow
            label="Muted Foreground"
            value={theme.colors.mutedForeground}
            onChange={(v) => updateColors("mutedForeground", v)}
          />
          <ColorRow
            label="Accent"
            value={theme.colors.accent}
            onChange={(v) => updateColors("accent", v)}
          />
          <ColorRow
            label="Border"
            value={theme.colors.border}
            onChange={(v) => updateColors("border", v)}
          />
          <ColorRow
            label="Ring"
            description="Focus ring color"
            value={theme.colors.ring}
            onChange={(v) => updateColors("ring", v)}
          />
        </ColorSection>

        {/* Status Colors */}
        <ColorSection title="Status Colors" icon={<CheckCircle className="h-4 w-4 text-green-500" />} defaultOpen={false}>
          <ColorRow
            label="Success"
            value={theme.colors.success}
            onChange={(v) => updateColors("success", v)}
          />
          <ColorRow
            label="Warning"
            value={theme.colors.warning}
            onChange={(v) => updateColors("warning", v)}
          />
          <ColorRow
            label="Info"
            value={theme.colors.info}
            onChange={(v) => updateColors("info", v)}
          />
          <ColorRow
            label="Destructive"
            value={theme.colors.destructive}
            onChange={(v) => updateColors("destructive", v)}
          />
        </ColorSection>

        {/* Sidebar Colors */}
        <ColorSection title="Sidebar Colors" icon={<Sidebar className="h-4 w-4 text-blue-500" />} defaultOpen={false}>
          <ColorRow
            label="Background"
            value={theme.colors.sidebarBackground}
            onChange={(v) => updateColors("sidebarBackground", v)}
          />
          <ColorRow
            label="Foreground"
            value={theme.colors.sidebarForeground}
            onChange={(v) => updateColors("sidebarForeground", v)}
          />
          <ColorRow
            label="Primary"
            value={theme.colors.sidebarPrimary}
            onChange={(v) => updateColors("sidebarPrimary", v)}
          />
          <ColorRow
            label="Accent"
            value={theme.colors.sidebarAccent}
            onChange={(v) => updateColors("sidebarAccent", v)}
          />
          <ColorRow
            label="Border"
            value={theme.colors.sidebarBorder}
            onChange={(v) => updateColors("sidebarBorder", v)}
          />
        </ColorSection>

        {/* Table Colors */}
        <ColorSection title="Table Colors" icon={<Table className="h-4 w-4 text-cyan-500" />} defaultOpen={false}>
          <ColorRow
            label="Header Background"
            value={theme.colors.tableHeaderBg}
            onChange={(v) => updateColors("tableHeaderBg", v)}
          />
          <ColorRow
            label="Row Odd"
            value={theme.colors.tableRowOdd}
            onChange={(v) => updateColors("tableRowOdd", v)}
          />
          <ColorRow
            label="Row Even"
            value={theme.colors.tableRowEven}
            onChange={(v) => updateColors("tableRowEven", v)}
          />
          <ColorRow
            label="Row Hover"
            value={theme.colors.tableRowHover}
            onChange={(v) => updateColors("tableRowHover", v)}
          />
        </ColorSection>

        {/* Text Colors */}
        <ColorSection title="Text Hierarchy" icon={<Type className="h-4 w-4 text-muted-foreground" />} defaultOpen={false}>
          <ColorRow
            label="Primary Text"
            description="High contrast text"
            value={theme.colors.textPrimary}
            onChange={(v) => updateColors("textPrimary", v)}
          />
          <ColorRow
            label="Secondary Text"
            description="Medium contrast"
            value={theme.colors.textSecondary}
            onChange={(v) => updateColors("textSecondary", v)}
          />
          <ColorRow
            label="Dim Text"
            description="Low contrast/metadata"
            value={theme.colors.textDim}
            onChange={(v) => updateColors("textDim", v)}
          />
        </ColorSection>

        {/* Database Icons */}
        <ColorSection title="Database Icons" icon={<Database className="h-4 w-4 text-purple-500" />} defaultOpen={false}>
          <ColorRow
            label="PostgreSQL"
            value={theme.databaseIcons.postgresql}
            onChange={(v) => updateDatabaseIcon("postgresql", v)}
            format="hex"
          />
          <ColorRow
            label="MySQL"
            value={theme.databaseIcons.mysql}
            onChange={(v) => updateDatabaseIcon("mysql", v)}
            format="hex"
          />
          <ColorRow
            label="SQLite"
            value={theme.databaseIcons.sqlite}
            onChange={(v) => updateDatabaseIcon("sqlite", v)}
            format="hex"
          />
          <ColorRow
            label="MSSQL"
            value={theme.databaseIcons.mssql}
            onChange={(v) => updateDatabaseIcon("mssql", v)}
            format="hex"
          />
          <ColorRow
            label="Oracle"
            value={theme.databaseIcons.oracle}
            onChange={(v) => updateDatabaseIcon("oracle", v)}
            format="hex"
          />
          <ColorRow
            label="MongoDB"
            value={theme.databaseIcons.mongodb}
            onChange={(v) => updateDatabaseIcon("mongodb", v)}
            format="hex"
          />
          <ColorRow
            label="Redis"
            value={theme.databaseIcons.redis}
            onChange={(v) => updateDatabaseIcon("redis", v)}
            format="hex"
          />
        </ColorSection>

        {/* Syntax Highlighting */}
        <ColorSection title="Syntax Highlighting" icon={<Code2 className="h-4 w-4 text-orange-500" />} defaultOpen={false}>
          <ColorRow
            label="Keyword"
            description="SELECT, FROM, WHERE"
            value={theme.syntaxColors.keyword}
            onChange={(v) => updateSyntaxColor("keyword", v)}
            format="hex"
          />
          <ColorRow
            label="String"
            description="'text values'"
            value={theme.syntaxColors.string}
            onChange={(v) => updateSyntaxColor("string", v)}
            format="hex"
          />
          <ColorRow
            label="Number"
            description="123, 45.67"
            value={theme.syntaxColors.number}
            onChange={(v) => updateSyntaxColor("number", v)}
            format="hex"
          />
          <ColorRow
            label="Comment"
            description="-- comments"
            value={theme.syntaxColors.comment}
            onChange={(v) => updateSyntaxColor("comment", v)}
            format="hex"
          />
          <ColorRow
            label="Operator"
            description="=, >, <"
            value={theme.syntaxColors.operator}
            onChange={(v) => updateSyntaxColor("operator", v)}
            format="hex"
          />
          <ColorRow
            label="Identifier"
            description="table/column names"
            value={theme.syntaxColors.identifier}
            onChange={(v) => updateSyntaxColor("identifier", v)}
            format="hex"
          />
          <ColorRow
            label="Type"
            description="INT, VARCHAR"
            value={theme.syntaxColors.type}
            onChange={(v) => updateSyntaxColor("type", v)}
            format="hex"
          />
        </ColorSection>

        {/* Editor Colors */}
        <ColorSection title="Editor Colors" icon={<Palette className="h-4 w-4 text-indigo-500" />} defaultOpen={false}>
          <ColorRow
            label="Background"
            value={theme.editorColors.editorBackground}
            onChange={(v) => updateEditorColor("editorBackground", v)}
            format="hex"
          />
          <ColorRow
            label="Foreground"
            value={theme.editorColors.editorForeground}
            onChange={(v) => updateEditorColor("editorForeground", v)}
            format="hex"
          />
          <ColorRow
            label="Line Highlight"
            value={theme.editorColors.lineHighlightBackground}
            onChange={(v) => updateEditorColor("lineHighlightBackground", v)}
            format="hex"
          />
          <ColorRow
            label="Selection"
            value={theme.editorColors.selectionBackground}
            onChange={(v) => updateEditorColor("selectionBackground", v)}
            format="hex"
          />
          <ColorRow
            label="Cursor"
            value={theme.editorColors.cursorForeground}
            onChange={(v) => updateEditorColor("cursorForeground", v)}
            format="hex"
          />
          <ColorRow
            label="Line Numbers"
            value={theme.editorColors.lineNumberForeground}
            onChange={(v) => updateEditorColor("lineNumberForeground", v)}
            format="hex"
          />
        </ColorSection>
      </div>
    </div>
  );
}
