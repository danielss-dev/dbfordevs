import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const PRESET_COLORS = [
  "#EF4444", "#F59E0B", "#22C55E", "#06B6D4",
  "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280",
  "#DC2626", "#D97706", "#16A34A", "#0891B2",
  "#2563EB", "#7C3AED", "#DB2777", "#4B5563",
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  return (
    <div className={cn("grid grid-cols-8 gap-1.5", className)}>
      {PRESET_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={cn(
            "w-6 h-6 rounded-md border-2 transition-all hover:scale-110 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:shadow-[0_0_0_3px_var(--accent-glow)]",
            value.toLowerCase() === color.toLowerCase()
              ? "border-foreground scale-110"
              : "border-transparent"
          )}
          style={{ backgroundColor: color }}
          onClick={() => onChange(color)}
        >
          {value.toLowerCase() === color.toLowerCase() && (
            <Check className="h-4 w-4 mx-auto text-white drop-shadow-md" />
          )}
        </button>
      ))}
    </div>
  );
}

export { PRESET_COLORS };
