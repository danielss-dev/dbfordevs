import type { ParsedKeybinding } from "./types";

const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

/**
 * Normalize a keybinding string to a canonical form.
 * Converts `mod` to `ctrl` or `meta` based on platform.
 * Lowercases the key portion and sorts modifiers.
 */
export function normalizeKeybinding(binding: string): string {
  const parts = binding.toLowerCase().split("+").map((p) => p.trim());
  const modifiers = new Set<string>();
  let key = "";

  for (const part of parts) {
    if (part === "mod") {
      modifiers.add(isMac ? "meta" : "ctrl");
    } else if (part === "ctrl" || part === "control") {
      modifiers.add("ctrl");
    } else if (part === "shift") {
      modifiers.add("shift");
    } else if (part === "alt" || part === "option") {
      modifiers.add("alt");
    } else if (part === "meta" || part === "cmd" || part === "command") {
      modifiers.add("meta");
    } else {
      key = part;
    }
  }

  const sorted = ["ctrl", "shift", "alt", "meta"].filter((m) => modifiers.has(m));
  return [...sorted, key].join("+");
}

/**
 * Parse a keybinding string into modifier flags + key.
 */
export function parseKeybinding(binding: string): ParsedKeybinding {
  const normalized = normalizeKeybinding(binding);
  const parts = normalized.split("+");
  const key = parts[parts.length - 1];
  const modifiers = new Set(parts.slice(0, -1));

  return {
    ctrl: modifiers.has("ctrl"),
    shift: modifiers.has("shift"),
    alt: modifiers.has("alt"),
    meta: modifiers.has("meta"),
    key,
  };
}

/**
 * Test if a KeyboardEvent matches a parsed keybinding.
 */
export function matchesEvent(event: KeyboardEvent, parsed: ParsedKeybinding): boolean {
  const eventKey = event.key.toLowerCase();
  // Handle function keys
  if (parsed.key.startsWith("f") && /^f\d+$/.test(parsed.key)) {
    if (eventKey !== parsed.key) return false;
  } else if (parsed.key === "tab") {
    if (eventKey !== "tab") return false;
  } else if (parsed.key === "enter") {
    if (eventKey !== "enter") return false;
  } else if (parsed.key === "escape") {
    if (eventKey !== "escape") return false;
  } else if (parsed.key === ",") {
    if (eventKey !== ",") return false;
  } else if (parsed.key === "arrowup") {
    if (eventKey !== "arrowup") return false;
  } else if (parsed.key === "arrowdown") {
    if (eventKey !== "arrowdown") return false;
  } else {
    if (eventKey !== parsed.key) return false;
  }

  return (
    event.ctrlKey === parsed.ctrl &&
    event.shiftKey === parsed.shift &&
    event.altKey === parsed.alt &&
    event.metaKey === parsed.meta
  );
}

/**
 * Convert a parsed keybinding to a display-friendly array of key names.
 * Platform-aware: shows Cmd/Option on Mac, Ctrl/Alt on other platforms.
 */
export function formatKeybinding(binding: string): string[] {
  const parsed = parseKeybinding(binding);
  const parts: string[] = [];

  if (parsed.ctrl) parts.push(isMac ? "\u2303" : "Ctrl");
  if (parsed.shift) parts.push(isMac ? "\u21E7" : "Shift");
  if (parsed.alt) parts.push(isMac ? "\u2325" : "Alt");
  if (parsed.meta) parts.push(isMac ? "\u2318" : "Meta");

  // Format the key nicely
  const key = parsed.key;
  if (key.startsWith("f") && /^f\d+$/.test(key)) {
    parts.push(key.toUpperCase());
  } else if (key === "tab") {
    parts.push(isMac ? "\u21E5" : "Tab");
  } else if (key === "enter") {
    parts.push(isMac ? "\u21A9" : "Enter");
  } else if (key === "escape") {
    parts.push("Esc");
  } else if (key === "arrowup") {
    parts.push("\u2191");
  } else if (key === "arrowdown") {
    parts.push("\u2193");
  } else if (key === "arrowleft") {
    parts.push("\u2190");
  } else if (key === "arrowright") {
    parts.push("\u2192");
  } else if (key === ",") {
    parts.push(",");
  } else {
    parts.push(key.toUpperCase());
  }

  return parts;
}

/**
 * Convert a KeyboardEvent into a canonical keybinding string.
 * Used for recording keybindings in the rebind UI.
 */
export function eventToKeybindingString(event: KeyboardEvent): string | null {
  const key = event.key.toLowerCase();

  // Ignore standalone modifier presses
  if (["control", "shift", "alt", "meta"].includes(key)) {
    return null;
  }

  const parts: string[] = [];
  if (event.ctrlKey) parts.push("ctrl");
  if (event.shiftKey) parts.push("shift");
  if (event.altKey) parts.push("alt");
  if (event.metaKey) parts.push("meta");
  parts.push(key);

  return parts.join("+");
}
