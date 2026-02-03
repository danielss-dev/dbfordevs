export type { CommandDefinition, CommandCategory, WhenCondition, ParsedKeybinding } from "./types";
export {
  normalizeKeybinding,
  parseKeybinding,
  matchesEvent,
  formatKeybinding,
  eventToKeybindingString,
} from "./keys";
export {
  registerCommand,
  unregisterCommand,
  getCommand,
  getAllCommands,
  getCommandsByCategory,
  executeCommand,
} from "./registry";
export { evaluateCondition } from "./conditions";
export { useCommandRegistration } from "./default-commands";
