import { useEffect, useMemo, useCallback } from "react";
import { Command } from "cmdk";
import { useUIStore } from "@/stores";
import { getAllCommands } from "@/lib/commands/registry";
import { evaluateCondition } from "@/lib/commands/conditions";
import { useKeybindingsStore } from "@/stores/keybindings";
import { CommandItem } from "./CommandItem";
import type { CommandDefinition, CommandCategory } from "@/lib/commands/types";

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  general: "General",
  connections: "Connections",
  queries: "Queries",
  navigation: "Navigation",
  editor: "Editor",
  grid: "Data Grid",
  panels: "Panels",
  settings: "Settings",
  database: "Database",
  ai: "AI",
  tabs: "Tabs",
};

const CATEGORY_ORDER: CommandCategory[] = [
  "general",
  "connections",
  "queries",
  "tabs",
  "navigation",
  "editor",
  "grid",
  "panels",
  "database",
  "ai",
  "settings",
];

export function CommandPalette() {
  const show = useUIStore((s) => s.showCommandPalette);
  const setShow = useUIStore((s) => s.setShowCommandPalette);
  const recentCommands = useKeybindingsStore((s) => s.recentCommands);
  const addRecentCommand = useKeybindingsStore((s) => s.addRecentCommand);

  // Close on Escape (also handled by cmdk dialog)
  useEffect(() => {
    if (!show) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setShow(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [show, setShow]);

  const allCommands = useMemo(() => {
    if (!show) return [];
    return getAllCommands().filter((cmd) => {
      if (cmd.when && !evaluateCondition(cmd.when)) return false;
      // Hide the palette command itself
      if (cmd.id === "command.palette") return false;
      return true;
    });
  }, [show]);

  const recentCommandDefs = useMemo(() => {
    if (!show) return [];
    const cmdMap = new Map(allCommands.map((c) => [c.id, c]));
    return recentCommands
      .map((id) => cmdMap.get(id))
      .filter((c): c is CommandDefinition => !!c)
      .slice(0, 5);
  }, [show, allCommands, recentCommands]);

  const groupedCommands = useMemo(() => {
    const groups = new Map<CommandCategory, CommandDefinition[]>();
    for (const cmd of allCommands) {
      const existing = groups.get(cmd.category) || [];
      existing.push(cmd);
      groups.set(cmd.category, existing);
    }
    return groups;
  }, [allCommands]);

  const handleSelect = useCallback(
    (command: CommandDefinition) => {
      setShow(false);
      addRecentCommand(command.id);
      // Delay execution slightly to let the dialog close
      requestAnimationFrame(() => {
        command.execute();
      });
    },
    [setShow, addRecentCommand]
  );

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-in fade-in-0 duration-100"
        onClick={() => setShow(false)}
      />

      {/* Dialog */}
      <div className="flex items-start justify-center pt-24">
        <div className="relative w-full max-w-[640px] rounded-xl border border-border/70 bg-popover shadow-pop overflow-hidden animate-pop-in">
          <Command
            className="flex flex-col"
            loop
          >
            {/* Search input */}
            <div className="flex items-center border-b border-border px-3">
              <svg
                className="mr-2 h-4 w-4 shrink-0 text-muted-foreground"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <Command.Input
                placeholder="Type a command or search..."
                className="flex h-12 w-full bg-transparent py-3 text-[15px] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                autoFocus
              />
            </div>

            {/* Command list */}
            <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto overscroll-contain p-2">
              <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                No commands found.
              </Command.Empty>

              {/* Recent commands */}
              {recentCommandDefs.length > 0 && (
                <Command.Group
                  heading="Recent"
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-muted-foreground"
                >
                  {recentCommandDefs.map((cmd) => (
                    <CommandItem key={`recent-${cmd.id}`} command={cmd} onSelect={handleSelect} valuePrefix="recent" />
                  ))}
                </Command.Group>
              )}

              {/* Grouped commands */}
              {CATEGORY_ORDER.map((category) => {
                const cmds = groupedCommands.get(category);
                if (!cmds || cmds.length === 0) return null;
                return (
                  <Command.Group
                    key={category}
                    heading={CATEGORY_LABELS[category]}
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-muted-foreground"
                  >
                    {cmds.map((cmd) => (
                      <CommandItem key={cmd.id} command={cmd} onSelect={handleSelect} />
                    ))}
                  </Command.Group>
                );
              })}
            </Command.List>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border bg-muted/30 px-3 py-1.5">
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <kbd>&uarr;</kbd>
                  <kbd>&darr;</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd>&crarr;</kbd>
                  Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd>Esc</kbd>
                  Close
                </span>
              </div>
            </div>
          </Command>
        </div>
      </div>
    </div>
  );
}
