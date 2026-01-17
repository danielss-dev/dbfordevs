import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import { Label } from "./label";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { hslToHex, hexToHsl, isValidHex, isValidHsl } from "@/lib/themes/utils";

interface HSLColorPickerProps {
  /**
   * Color value - can be HSL format ("220 14% 96%") or hex format ("#dfe4ed")
   */
  value: string;
  /**
   * Callback when color changes
   * @param value - Returns in the same format as input (HSL or hex)
   */
  onChange: (value: string) => void;
  /**
   * Output format - 'hsl' for "H S% L%" format, 'hex' for "#RRGGBB"
   */
  format?: "hsl" | "hex";
  /**
   * Label to show above the picker
   */
  label?: string;
  /**
   * Additional class for the container
   */
  className?: string;
  /**
   * Whether the picker is disabled
   */
  disabled?: boolean;
}

interface HSLValues {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

/**
 * Parse a color string (HSL or hex) to HSL values
 */
function parseColor(value: string): HSLValues {
  // Try HSL format first
  if (isValidHsl(value)) {
    const parts = value.trim().split(/\s+/);
    return {
      h: parseFloat(parts[0]),
      s: parseFloat(parts[1].replace("%", "")),
      l: parseFloat(parts[2].replace("%", "")),
    };
  }

  // Try hex format
  if (isValidHex(value)) {
    const hsl = hexToHsl(value);
    const parts = hsl.split(/\s+/);
    return {
      h: parseFloat(parts[0]),
      s: parseFloat(parts[1].replace("%", "")),
      l: parseFloat(parts[2].replace("%", "")),
    };
  }

  // Default values
  return { h: 0, s: 0, l: 50 };
}

/**
 * Convert HSL values to HSL string format
 */
function hslValuesToString(hsl: HSLValues): string {
  return `${Math.round(hsl.h)} ${Math.round(hsl.s)}% ${Math.round(hsl.l)}%`;
}

/**
 * Convert HSL values to hex
 */
function hslValuesToHex(hsl: HSLValues): string {
  return hslToHex(hslValuesToString(hsl));
}

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e",
  "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#64748b",
];

export function HSLColorPicker({
  value,
  onChange,
  format = "hsl",
  label,
  className,
  disabled = false,
}: HSLColorPickerProps) {
  const [hsl, setHsl] = useState<HSLValues>(() => parseColor(value));
  const [hexInput, setHexInput] = useState(() => hslValuesToHex(parseColor(value)));
  const [isOpen, setIsOpen] = useState(false);

  // Update local state when value prop changes
  useEffect(() => {
    const parsed = parseColor(value);
    setHsl(parsed);
    setHexInput(hslValuesToHex(parsed));
  }, [value]);

  const emitChange = useCallback(
    (newHsl: HSLValues) => {
      if (format === "hex") {
        onChange(hslValuesToHex(newHsl));
      } else {
        onChange(hslValuesToString(newHsl));
      }
    },
    [format, onChange]
  );

  const handleHueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const h = parseInt(e.target.value, 10);
    const newHsl = { ...hsl, h };
    setHsl(newHsl);
    setHexInput(hslValuesToHex(newHsl));
    emitChange(newHsl);
  };

  const handleSaturationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = parseInt(e.target.value, 10);
    const newHsl = { ...hsl, s };
    setHsl(newHsl);
    setHexInput(hslValuesToHex(newHsl));
    emitChange(newHsl);
  };

  const handleLightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const l = parseInt(e.target.value, 10);
    const newHsl = { ...hsl, l };
    setHsl(newHsl);
    setHexInput(hslValuesToHex(newHsl));
    emitChange(newHsl);
  };

  const handleHexInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let hex = e.target.value;
    setHexInput(hex);

    // Auto-add # prefix
    if (hex && !hex.startsWith("#")) {
      hex = "#" + hex;
    }

    if (isValidHex(hex)) {
      const newHsl = parseColor(hex);
      setHsl(newHsl);
      emitChange(newHsl);
    }
  };

  const handlePresetClick = (color: string) => {
    const newHsl = parseColor(color);
    setHsl(newHsl);
    setHexInput(color);
    emitChange(newHsl);
  };

  const currentHex = hslValuesToHex(hsl);

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
      )}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md border border-input bg-background text-sm",
              "hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "w-full justify-start"
            )}
          >
            <div
              className="w-5 h-5 rounded border border-border shadow-sm"
              style={{ backgroundColor: currentHex }}
            />
            <span className="font-mono text-xs">{currentHex}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          <div className="space-y-4">
            {/* Color preview */}
            <div
              className="w-full h-16 rounded-md border border-border shadow-inner"
              style={{ backgroundColor: currentHex }}
            />

            {/* Hue slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Hue</Label>
                <span className="text-xs text-muted-foreground">{Math.round(hsl.h)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                value={hsl.h}
                onChange={handleHueChange}
                className="w-full h-3 rounded-md cursor-pointer appearance-none"
                style={{
                  background: `linear-gradient(to right,
                    hsl(0, ${hsl.s}%, ${hsl.l}%),
                    hsl(60, ${hsl.s}%, ${hsl.l}%),
                    hsl(120, ${hsl.s}%, ${hsl.l}%),
                    hsl(180, ${hsl.s}%, ${hsl.l}%),
                    hsl(240, ${hsl.s}%, ${hsl.l}%),
                    hsl(300, ${hsl.s}%, ${hsl.l}%),
                    hsl(360, ${hsl.s}%, ${hsl.l}%)
                  )`,
                }}
              />
            </div>

            {/* Saturation slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Saturation</Label>
                <span className="text-xs text-muted-foreground">{Math.round(hsl.s)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={hsl.s}
                onChange={handleSaturationChange}
                className="w-full h-3 rounded-md cursor-pointer appearance-none"
                style={{
                  background: `linear-gradient(to right,
                    hsl(${hsl.h}, 0%, ${hsl.l}%),
                    hsl(${hsl.h}, 100%, ${hsl.l}%)
                  )`,
                }}
              />
            </div>

            {/* Lightness slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Lightness</Label>
                <span className="text-xs text-muted-foreground">{Math.round(hsl.l)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={hsl.l}
                onChange={handleLightnessChange}
                className="w-full h-3 rounded-md cursor-pointer appearance-none"
                style={{
                  background: `linear-gradient(to right,
                    hsl(${hsl.h}, ${hsl.s}%, 0%),
                    hsl(${hsl.h}, ${hsl.s}%, 50%),
                    hsl(${hsl.h}, ${hsl.s}%, 100%)
                  )`,
                }}
              />
            </div>

            {/* Hex input */}
            <div className="space-y-1.5">
              <Label className="text-xs">Hex</Label>
              <Input
                value={hexInput}
                onChange={handleHexInput}
                placeholder="#000000"
                className="font-mono text-xs h-8"
              />
            </div>

            {/* Preset colors */}
            <div className="space-y-1.5">
              <Label className="text-xs">Presets</Label>
              <div className="grid grid-cols-9 gap-1">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      "w-5 h-5 rounded border border-border transition-transform hover:scale-110",
                      currentHex.toLowerCase() === color && "ring-2 ring-ring ring-offset-1"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => handlePresetClick(color)}
                  />
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export { hslToHex, hexToHsl };
