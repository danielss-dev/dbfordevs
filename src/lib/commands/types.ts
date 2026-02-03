import type { LucideIcon } from "lucide-react";

export type CommandCategory =
  | "connections"
  | "queries"
  | "navigation"
  | "editor"
  | "grid"
  | "panels"
  | "settings"
  | "database"
  | "ai"
  | "tabs"
  | "general";

export type WhenCondition =
  | "always"
  | "connected"
  | "hasActiveTab"
  | "editorFocused"
  | "gridFocused"
  | "hasSelectedRows"
  | "hasPendingChanges"
  | "aiEnabled";

export interface CommandDefinition {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  category: CommandCategory;
  defaultKeybinding?: string;
  when?: WhenCondition;
  execute: () => void;
}

export interface ParsedKeybinding {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  key: string;
}
