import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface ResizeHandleProps {
  direction?: "left" | "right";
  currentWidth: number;
  onResize: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
}

export function ResizeHandle({
  direction = "left",
  currentWidth,
  onResize,
  minWidth = 200,
  maxWidth = 600,
  className,
}: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = currentWidth;
  }, [currentWidth]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // For left-edge handle: dragging left increases width, dragging right decreases
      // For right-edge handle: dragging right increases width, dragging left decreases
      const delta = direction === "left"
        ? startXRef.current - e.clientX
        : e.clientX - startXRef.current;

      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + delta));
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // Add cursor style to body during drag for better UX
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, direction, minWidth, maxWidth, onResize]);

  return (
    <div
      className={cn(
        "absolute top-0 bottom-0 w-1 cursor-col-resize transition-colors z-10",
        "hover:bg-primary/40",
        isDragging && "bg-primary/60",
        direction === "left" ? "left-0" : "right-0",
        className
      )}
      onMouseDown={handleMouseDown}
    >
      {/* Wider invisible hit area for easier grabbing */}
      <div
        className={cn(
          "absolute top-0 bottom-0 w-3 -translate-x-1/2",
          direction === "left" ? "left-0" : "right-0"
        )}
      />
    </div>
  );
}
