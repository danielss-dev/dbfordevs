import { Command } from "cmdk";
import type { CommandDefinition } from "@/lib/commands/types";
import { formatKeybinding } from "@/lib/commands/keys";
import { useKeybindingsStore } from "@/stores/keybindings";

interface CommandItemProps {
  command: CommandDefinition;
  onSelect: (command: CommandDefinition) => void;
  /** Optional prefix to make the value unique when the same command appears in multiple groups */
  valuePrefix?: string;
}

export function CommandItem({ command, onSelect, valuePrefix }: CommandItemProps) {
  const binding = useKeybindingsStore.getState().getEffectiveBinding(command.id);
  const Icon = command.icon;
  const keys = binding ? formatKeybinding(binding) : null;
  const prefix = valuePrefix ? `${valuePrefix}:` : "";

  return (
    <Command.Item
      value={`${prefix}${command.label} ${command.description ?? ""} ${command.id}`}
      onSelect={() => onSelect(command)}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer select-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
    >
      {Icon && (
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <span className="flex-1 truncate">{command.label}</span>
      {keys && (
        <span className="ml-auto flex items-center gap-1">
          {keys.map((key, i) => (
            <kbd
              key={i}
              className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground"
            >
              {key}
            </kbd>
          ))}
        </span>
      )}
    </Command.Item>
  );
}
