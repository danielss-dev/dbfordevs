import { useState, useCallback, useRef, useEffect } from "react";

interface ActiveCell {
  rowIndex: number;
  colIndex: number;
}

interface UseGridKeyboardNavOptions {
  rowCount: number;
  colCount: number;
  pageSize?: number;
  onStartEditing?: (rowIndex: number, colIndex: number) => void;
  onCancelEditing?: () => void;
  isEditing?: boolean;
}

export function useGridKeyboardNav({
  rowCount,
  colCount,
  pageSize = 20,
  onStartEditing,
  onCancelEditing,
  isEditing = false,
}: UseGridKeyboardNavOptions) {
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const clamp = useCallback(
    (row: number, col: number): ActiveCell => ({
      rowIndex: Math.max(0, Math.min(row, rowCount - 1)),
      colIndex: Math.max(0, Math.min(col, colCount - 1)),
    }),
    [rowCount, colCount]
  );

  const scrollToCell = useCallback((rowIndex: number, colIndex: number) => {
    const container = containerRef.current;
    if (!container) return;

    const cell = container.querySelector(
      `[data-row="${rowIndex}"][data-col="${colIndex}"]`
    ) as HTMLElement;
    if (cell) {
      cell.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, []);

  const moveCell = useCallback(
    (dRow: number, dCol: number) => {
      setActiveCell((prev) => {
        const current = prev || { rowIndex: 0, colIndex: 0 };
        let newRow = current.rowIndex + dRow;
        let newCol = current.colIndex + dCol;

        // Wrap columns across rows
        if (newCol < 0 && newRow > 0) {
          newRow -= 1;
          newCol = colCount - 1;
        } else if (newCol >= colCount && newRow < rowCount - 1) {
          newRow += 1;
          newCol = 0;
        }

        const clamped = clamp(newRow, newCol);
        scrollToCell(clamped.rowIndex, clamped.colIndex);
        return clamped;
      });
    },
    [clamp, colCount, rowCount, scrollToCell]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // If we're editing, only handle Escape and Tab
      if (isEditing) {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancelEditing?.();
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          onCancelEditing?.();
          moveCell(0, e.shiftKey ? -1 : 1);
          return;
        }
        return;
      }

      if (rowCount === 0 || colCount === 0) return;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          moveCell(-1, 0);
          break;
        case "ArrowDown":
          e.preventDefault();
          moveCell(1, 0);
          break;
        case "ArrowLeft":
          e.preventDefault();
          moveCell(0, -1);
          break;
        case "ArrowRight":
          e.preventDefault();
          moveCell(0, 1);
          break;
        case "Tab":
          e.preventDefault();
          moveCell(0, e.shiftKey ? -1 : 1);
          break;
        case "Home":
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            const cell = clamp(0, 0);
            setActiveCell(cell);
            scrollToCell(cell.rowIndex, cell.colIndex);
          } else {
            setActiveCell((prev) => {
              const cell = clamp(prev?.rowIndex ?? 0, 0);
              scrollToCell(cell.rowIndex, cell.colIndex);
              return cell;
            });
          }
          break;
        case "End":
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            const cell = clamp(rowCount - 1, colCount - 1);
            setActiveCell(cell);
            scrollToCell(cell.rowIndex, cell.colIndex);
          } else {
            setActiveCell((prev) => {
              const cell = clamp(prev?.rowIndex ?? 0, colCount - 1);
              scrollToCell(cell.rowIndex, cell.colIndex);
              return cell;
            });
          }
          break;
        case "PageUp":
          e.preventDefault();
          moveCell(-pageSize, 0);
          break;
        case "PageDown":
          e.preventDefault();
          moveCell(pageSize, 0);
          break;
        case "Enter":
          e.preventDefault();
          if (activeCell) {
            onStartEditing?.(activeCell.rowIndex, activeCell.colIndex);
          }
          break;
      }
    },
    [isEditing, rowCount, colCount, moveCell, clamp, scrollToCell, activeCell, pageSize, onStartEditing, onCancelEditing]
  );

  // Reset active cell when data changes
  useEffect(() => {
    if (activeCell && (activeCell.rowIndex >= rowCount || activeCell.colIndex >= colCount)) {
      setActiveCell(rowCount > 0 && colCount > 0 ? clamp(activeCell.rowIndex, activeCell.colIndex) : null);
    }
  }, [rowCount, colCount, activeCell, clamp]);

  return {
    activeCell,
    setActiveCell,
    containerRef,
    handleKeyDown,
  };
}
