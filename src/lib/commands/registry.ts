import type { CommandDefinition, CommandCategory } from "./types";

const commands = new Map<string, CommandDefinition>();

export function registerCommand(command: CommandDefinition): void {
  commands.set(command.id, command);
}

export function unregisterCommand(id: string): void {
  commands.delete(id);
}

export function getCommand(id: string): CommandDefinition | undefined {
  return commands.get(id);
}

export function getAllCommands(): CommandDefinition[] {
  return Array.from(commands.values());
}

export function getCommandsByCategory(category: CommandCategory): CommandDefinition[] {
  return Array.from(commands.values()).filter((cmd) => cmd.category === category);
}

export function executeCommand(id: string): boolean {
  const command = commands.get(id);
  if (!command) return false;
  command.execute();
  return true;
}
