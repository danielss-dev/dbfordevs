import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface TagBadgeProps {
  name: string;
  color: string;
  onRemove?: () => void;
  onClick?: () => void;
  className?: string;
  size?: "sm" | "default";
}

export function TagBadge({
  name,
  color,
  onRemove,
  onClick,
  className,
  size = "default",
}: TagBadgeProps) {
  // Calculate if the color is light or dark to determine text color
  const isLightColor = (hex: string) => {
    const c = hex.substring(1);
    const rgb = parseInt(c, 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance > 186;
  };

  const textColor = isLightColor(color) ? "#000000" : "#FFFFFF";
  const bgOpacity = 0.85;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium transition-all",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        onClick && "cursor-pointer hover:opacity-80",
        className
      )}
      style={{
        backgroundColor: `${color}${Math.round(bgOpacity * 255).toString(16).padStart(2, "0")}`,
        color: textColor,
      }}
      onClick={onClick}
    >
      {name}
      {onRemove && (
        <button
          type="button"
          className="rounded-full hover:bg-black/20 p-0.5 -mr-0.5"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
        </button>
      )}
    </span>
  );
}
