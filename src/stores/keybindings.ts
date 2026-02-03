import { create } from "zustand";
import { persist } from "zustand/middleware";
import { normalizeKeybinding } from "@/lib/commands/keys";
import { getAllCommands } from "@/lib/commands/registry";

interface KeybindingsState {
  /** User-overridden keybindings: commandId -> binding string */
  customBindings: Record<string, string>;
  /** Recently executed command IDs for the palette */
  recentCommands: string[];
  /** Favorite command IDs pinned to top of palette */
  favoriteCommands: string[];

  // Actions
  setBinding: (commandId: string, binding: string) => void;
  resetBinding: (commandId: string) => void;
  resetAllBindings: () => void;
  getEffectiveBinding: (commandId: string) => string | undefined;
  getCommandForKeys: (normalizedBinding: string) => string | undefined;
  hasConflict: (commandId: string, binding: string) => string | undefined;
  addRecentCommand: (commandId: string) => void;
  toggleFavoriteCommand: (commandId: string) => void;
}

const MAX_RECENT = 10;

export const useKeybindingsStore = create<KeybindingsState>()(
  persist(
    (set, get) => ({
      customBindings: {},
      recentCommands: [],
      favoriteCommands: [],

      setBinding: (commandId, binding) =>
        set((state) => ({
          customBindings: {
            ...state.customBindings,
            [commandId]: normalizeKeybinding(binding),
          },
        })),

      resetBinding: (commandId) =>
        set((state) => {
          const { [commandId]: _, ...rest } = state.customBindings;
          return { customBindings: rest };
        }),

      resetAllBindings: () => set({ customBindings: {} }),

      getEffectiveBinding: (commandId) => {
        const { customBindings } = get();
        if (customBindings[commandId] !== undefined) {
          return customBindings[commandId];
        }
        const command = getAllCommands().find((c) => c.id === commandId);
        return command?.defaultKeybinding
          ? normalizeKeybinding(command.defaultKeybinding)
          : undefined;
      },

      getCommandForKeys: (normalizedBinding) => {
        const { customBindings } = get();

        // Check custom bindings first
        for (const [cmdId, binding] of Object.entries(customBindings)) {
          if (binding === normalizedBinding) return cmdId;
        }

        // Check default bindings (skip commands with custom overrides)
        for (const cmd of getAllCommands()) {
          if (customBindings[cmd.id] !== undefined) continue;
          if (cmd.defaultKeybinding && normalizeKeybinding(cmd.defaultKeybinding) === normalizedBinding) {
            return cmd.id;
          }
        }

        return undefined;
      },

      hasConflict: (commandId, binding) => {
        const normalized = normalizeKeybinding(binding);
        const { customBindings } = get();

        // Check custom bindings
        for (const [cmdId, b] of Object.entries(customBindings)) {
          if (cmdId !== commandId && b === normalized) return cmdId;
        }

        // Check defaults (skip commands with custom overrides)
        for (const cmd of getAllCommands()) {
          if (cmd.id === commandId) continue;
          if (customBindings[cmd.id] !== undefined) continue;
          if (cmd.defaultKeybinding && normalizeKeybinding(cmd.defaultKeybinding) === normalized) {
            return cmd.id;
          }
        }

        return undefined;
      },

      addRecentCommand: (commandId) =>
        set((state) => {
          const filtered = state.recentCommands.filter((id) => id !== commandId);
          return { recentCommands: [commandId, ...filtered].slice(0, MAX_RECENT) };
        }),

      toggleFavoriteCommand: (commandId) =>
        set((state) => {
          const isFav = state.favoriteCommands.includes(commandId);
          return {
            favoriteCommands: isFav
              ? state.favoriteCommands.filter((id) => id !== commandId)
              : [...state.favoriteCommands, commandId],
          };
        }),
    }),
    {
      name: "dbfordevs-keybindings",
      partialize: (state) => ({
        customBindings: state.customBindings,
        recentCommands: state.recentCommands,
        favoriteCommands: state.favoriteCommands,
      }),
    }
  )
);
