import * as React from "react";
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Button,
  Input,
  Checkbox,
} from "@/components/ui";
import { useGridStore } from "@/stores/grid";
import { ConditionalFormatDialog } from "@/components/data-grid/ConditionalFormatDialog";
import type {
  RowHeightMode,
  DateFormat,
  TimeFormat,
  NumberFormat,
  NullDisplayStyle,
  JsonDisplayMode,
} from "@/types/grid";

interface SettingRowProps {
  label: string;
  description: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
      <div className="space-y-0.5">
        <Label className="text-[13px] font-medium">{label}</Label>
        <p className="text-[11px] text-muted-foreground max-w-[280px]">
          {description}
        </p>
      </div>
      {children}
    </div>
  );
}

export function GridSettingsTab() {
  const {
    defaultRowHeight,
    dateTimeFormat,
    numberFormat,
    nullDisplay,
    jsonDisplay,
    binaryPreview,
    conditionalRules,
    setDefaultRowHeight,
    updateDateTimeFormat,
    updateNumberFormat,
    updateNullDisplay,
    setJsonDisplay,
    updateBinaryPreview,
  } = useGridStore();

  const [showConditionalDialog, setShowConditionalDialog] =
    React.useState(false);

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h2 className="text-sm font-medium mb-0.5">Data Grid</h2>
        <p className="text-xs text-muted-foreground">
          Customize how data is displayed in the grid.
        </p>
      </div>

      <h3 className="micro-label">Display</h3>

      <div className="rounded-md border border-border">
        <SettingRow
          label="Row Height"
          description="Default height for rows in the data grid."
        >
          <Select
            value={defaultRowHeight.mode}
            onValueChange={(value: RowHeightMode) =>
              setDefaultRowHeight({ mode: value })
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="compact">Compact (28px)</SelectItem>
              <SelectItem value="default">Default (36px)</SelectItem>
              <SelectItem value="comfortable">Comfortable (44px)</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </div>

      <h3 className="micro-label">Date & Time Formatting</h3>

      <div className="rounded-md border border-border">
        <SettingRow
          label="Date Format"
          description="How dates are displayed in cells."
        >
          <Select
            value={dateTimeFormat.dateFormat}
            onValueChange={(value: DateFormat) =>
              updateDateTimeFormat({ dateFormat: value })
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="iso">ISO (2024-01-15)</SelectItem>
              <SelectItem value="locale">Local format</SelectItem>
              <SelectItem value="relative">Relative (2 days ago)</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <Separator />
        <SettingRow
          label="Time Format"
          description="12-hour or 24-hour time display."
        >
          <Select
            value={dateTimeFormat.timeFormat}
            onValueChange={(value: TimeFormat) =>
              updateDateTimeFormat({ timeFormat: value })
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24-hour (14:30)</SelectItem>
              <SelectItem value="12h">12-hour (2:30 PM)</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <Separator />
        <SettingRow
          label="Show Timezone"
          description="Display timezone information for timestamps."
        >
          <Checkbox
            checked={dateTimeFormat.showTimezone}
            onCheckedChange={(checked: boolean) =>
              updateDateTimeFormat({ showTimezone: checked })
            }
          />
        </SettingRow>
      </div>

      <h3 className="micro-label">Number Formatting</h3>

      <div className="rounded-md border border-border">
        <SettingRow
          label="Number Format"
          description="How numeric values are displayed."
        >
          <Select
            value={numberFormat.format}
            onValueChange={(value: NumberFormat) =>
              updateNumberFormat({ format: value })
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="compact">Compact (1.2K)</SelectItem>
              <SelectItem value="scientific">Scientific (1.2e3)</SelectItem>
              <SelectItem value="percentage">Percentage</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <Separator />
        <SettingRow
          label="Decimal Places"
          description="Number of digits after the decimal point."
        >
          <Input
            type="number"
            min={0}
            max={10}
            value={numberFormat.decimalPlaces}
            onChange={(e) =>
              updateNumberFormat({ decimalPlaces: parseInt(e.target.value) || 2 })
            }
            className="w-20"
          />
        </SettingRow>
        <Separator />
        <SettingRow
          label="Thousands Separator"
          description="Add commas to separate thousands (1,000,000)."
        >
          <Checkbox
            checked={numberFormat.thousandsSeparator}
            onCheckedChange={(checked: boolean) =>
              updateNumberFormat({ thousandsSeparator: checked })
            }
          />
        </SettingRow>
        <Separator />
        <SettingRow
          label="Highlight Negative"
          description="Show negative numbers in red."
        >
          <Checkbox
            checked={numberFormat.negativeColor}
            onCheckedChange={(checked: boolean) =>
              updateNumberFormat({ negativeColor: checked })
            }
          />
        </SettingRow>
      </div>

      <h3 className="micro-label">NULL Value Display</h3>

      <div className="rounded-md border border-border">
        <SettingRow
          label="NULL Text"
          description="Text displayed for NULL values."
        >
          <Input
            value={nullDisplay.text}
            onChange={(e) => updateNullDisplay({ text: e.target.value })}
            className="w-24"
            placeholder="NULL"
          />
        </SettingRow>
        <Separator />
        <SettingRow
          label="NULL Style"
          description="Visual style for NULL values."
        >
          <Select
            value={nullDisplay.style}
            onValueChange={(value: NullDisplayStyle) =>
              updateNullDisplay({ style: value })
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="badge">Badge</SelectItem>
              <SelectItem value="italic">Italic text</SelectItem>
              <SelectItem value="dimmed">Dimmed text</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <div className="px-4 py-3 bg-muted/30">
          <p className="text-xs text-muted-foreground">
            Preview:{" "}
            {nullDisplay.style === "badge" ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-border/50 bg-muted text-muted-foreground/60">
                {nullDisplay.text}
              </span>
            ) : nullDisplay.style === "italic" ? (
              <span className="italic text-muted-foreground/60">
                {nullDisplay.text}
              </span>
            ) : (
              <span className="text-muted-foreground/40">
                {nullDisplay.text}
              </span>
            )}
          </p>
        </div>
      </div>

      <h3 className="micro-label">JSON Display</h3>

      <div className="rounded-md border border-border">
        <SettingRow
          label="JSON Display Mode"
          description="How JSON objects are shown in cells."
        >
          <Select
            value={jsonDisplay}
            onValueChange={(value: JsonDisplayMode) => setJsonDisplay(value)}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="collapsed">Collapsed</SelectItem>
              <SelectItem value="inline">Inline</SelectItem>
              <SelectItem value="pretty">Pretty printed</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </div>

      <h3 className="micro-label">Binary Data</h3>

      <div className="rounded-md border border-border">
        <SettingRow
          label="Auto-detect Images"
          description="Automatically detect and show images in binary data."
        >
          <Checkbox
            checked={binaryPreview.autoDetectImages}
            onCheckedChange={(checked: boolean) =>
              updateBinaryPreview({ autoDetectImages: checked })
            }
          />
        </SettingRow>
        <Separator />
        <SettingRow
          label="Hex Bytes Per Row"
          description="Number of bytes shown per row in hex view."
        >
          <Select
            value={String(binaryPreview.hexBytesPerRow)}
            onValueChange={(value) =>
              updateBinaryPreview({
                hexBytesPerRow: parseInt(value) as 16 | 32,
              })
            }
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="16">16 bytes</SelectItem>
              <SelectItem value="32">32 bytes</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </div>

      <h3 className="micro-label">Conditional Formatting</h3>

      <div className="rounded-md border border-border">
        <SettingRow
          label="Formatting Rules"
          description={`${conditionalRules.length} rule${conditionalRules.length !== 1 ? "s" : ""} configured.`}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConditionalDialog(true)}
          >
            Manage Rules
          </Button>
        </SettingRow>
      </div>

      <ConditionalFormatDialog
        open={showConditionalDialog}
        onOpenChange={setShowConditionalDialog}
        columns={[]} // Will be populated when used in context of a table
      />
    </div>
  );
}
