import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { RotateCcw, Search } from "lucide-react";
import { getAllCommands, getCommand } from "@/lib/commands/registry";
import { formatKeybinding, eventToKeybindingString, normalizeKeybinding } from "@/lib/commands/keys";
import { useKeybindingsStore } from "@/stores/keybindings";
import type { CommandCategory, CommandDefinition } from "@/lib/commands/types";

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

export function KeybindingEditor() {
  const [filter, setFilter] = useState("");
  const [recordingCommandId, setRecordingCommandId] = useState<string | null>(null);
  const [conflictInfo, setConflictInfo] = useState<{ commandId: string; conflictWith: string; binding: string } | null>(null);
  const recordingRef = useRef<HTMLDivElement>(null);

  const { customBindings, setBinding, resetBinding, resetAllBindings, getEffectiveBinding, hasConflict } = useKeybindingsStore();

  const commands = useMemo(() => getAllCommands(), [customBindings]);

  const filteredCommands = useMemo(() => {
    if (!filter) return commands;
    const lower = filter.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lower) ||
        cmd.id.toLowerCase().includes(lower) ||
        (cmd.description?.toLowerCase().includes(lower) ?? false)
    );
  }, [commands, filter]);

  const groupedCommands = useMemo(() => {
    const groups = new Map<CommandCategory, CommandDefinition[]>();
    for (const cmd of filteredCommands) {
      const existing = groups.get(cmd.category) || [];
      existing.push(cmd);
      groups.set(cmd.category, existing);
    }
    return groups;
  }, [filteredCommands]);

  // Handle recording mode
  const handleKeyDownForRecording = useCallback(
    (e: KeyboardEvent) => {
      if (!recordingCommandId) return;

      e.preventDefault();
      e.stopPropagation();

      const binding = eventToKeybindingString(e);
      if (!binding) return; // Modifier-only press

      const normalized = normalizeKeybinding(binding);
      const conflict = hasConflict(recordingCommandId, normalized);

      if (conflict) {
        setConflictInfo({ commandId: recordingCommandId, conflictWith: conflict, binding: normalized });
      } else {
        setBinding(recordingCommandId, normalized);
        setRecordingCommandId(null);
      }
    },
    [recordingCommandId, hasConflict, setBinding]
  );

  useEffect(() => {
    if (!recordingCommandId) return;
    window.addEventListener("keydown", handleKeyDownForRecording, true);
    return () => window.removeEventListener("keydown", handleKeyDownForRecording, true);
  }, [recordingCommandId, handleKeyDownForRecording]);

  // Cancel recording on outside click
  useEffect(() => {
    if (!recordingCommandId) return;
    const handleClick = (e: MouseEvent) => {
      if (recordingRef.current && !recordingRef.current.contains(e.target as Node)) {
        setRecordingCommandId(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [recordingCommandId]);

  const handleForceSet = () => {
    if (!conflictInfo) return;
    setBinding(conflictInfo.commandId, conflictInfo.binding);
    setRecordingCommandId(null);
    setConflictInfo(null);
  };

  const handleCancelConflict = () => {
    setConflictInfo(null);
    setRecordingCommandId(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-1">Keyboard Shortcuts</h2>
          <p className="text-sm text-muted-foreground">
            Click a shortcut to rebind it. Press the new key combination to assign.
          </p>
        </div>
        <button
          onClick={resetAllBindings}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Reset All
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search commands..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none transition-all duration-150 ease-swift focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_var(--accent-glow)]"
        />
      </div>

      {/* Conflict dialog */}
      {conflictInfo && (
        <div className="rounded-lg border border-warning bg-warning/10 p-3">
          <p className="text-sm font-medium">Keybinding Conflict</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This shortcut is already assigned to{" "}
            <strong>{getCommand(conflictInfo.conflictWith)?.label ?? conflictInfo.conflictWith}</strong>.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleForceSet}
              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Override
            </button>
            <button
              onClick={handleCancelConflict}
              className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Command list */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        {CATEGORY_ORDER.map((category) => {
          const cmds = groupedCommands.get(category);
          if (!cmds || cmds.length === 0) return null;
          return (
            <div key={category}>
              <div className="bg-muted/50 px-4 py-2">
                <span className="micro-label">
                  {CATEGORY_LABELS[category]}
                </span>
              </div>
              <div className="divide-y divide-border">
                {cmds.map((cmd) => {
                  const binding = getEffectiveBinding(cmd.id);
                  const isCustom = customBindings[cmd.id] !== undefined;
                  const isRecording = recordingCommandId === cmd.id;
                  const keys = binding ? formatKeybinding(binding) : null;

                  return (
                    <div
                      key={cmd.id}
                      ref={isRecording ? recordingRef : undefined}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {cmd.icon && <cmd.icon className="h-4 w-4 text-muted-foreground" />}
                        <span className="text-sm">{cmd.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isRecording ? (
                          <span className="flex items-center gap-1 rounded-md border border-primary bg-primary/10 px-3 py-1 text-xs font-medium text-primary animate-pulse">
                            Press keys...
                          </span>
                        ) : keys ? (
                          <button
                            onClick={() => setRecordingCommandId(cmd.id)}
                            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-muted transition-colors"
                            title="Click to rebind"
                          >
                            {keys.map((key, i) => (
                              <kbd
                                key={i}
                                className={isCustom ? "bg-primary/10 text-primary" : undefined}
                              >
                                {key}
                              </kbd>
                            ))}
                          </button>
                        ) : (
                          <button
                            onClick={() => setRecordingCommandId(cmd.id)}
                            className="rounded-md border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
                          >
                            Bind
                          </button>
                        )}
                        {isCustom && (
                          <button
                            onClick={() => resetBinding(cmd.id)}
                            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="Reset to default"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
