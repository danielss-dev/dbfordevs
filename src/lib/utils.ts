import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { invoke } from "@tauri-apps/api/core";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Copies text to the clipboard.
 * Uses a native Tauri command for maximum reliability, especially after async calls.
 * Falls back to browser APIs if native command fails.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Try native Tauri command first - most reliable after async database calls
    await invoke("copy_to_clipboard", { text });
    return true;
  } catch (err) {
    console.error("Native clipboard copy failed:", err);
  }

  try {
    // Try modern API as fallback
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.error("Modern clipboard API failed:", err);
  }

  // Final fallback to execCommand('copy')
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Ensure the textarea is not visible but part of the DOM
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    textArea.style.opacity = "0";
    textArea.style.pointerEvents = "none";
    document.body.appendChild(textArea);
    
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    
    return successful;
  } catch (err) {
    console.error("Fallback clipboard copy failed:", err);
    return false;
  }
}

/**
 * Reads text from the clipboard.
 * Uses a native Tauri command for maximum reliability.
 */
export async function readFromClipboard(): Promise<string | null> {
  try {
    // Try native Tauri command first
    const text = await invoke<string>("read_from_clipboard");
    return text;
  } catch (err) {
    console.error("Native clipboard read failed:", err);
  }

  try {
    // Try modern API as fallback
    if (navigator.clipboard && window.isSecureContext) {
      const text = await navigator.clipboard.readText();
      return text;
    }
  } catch (err) {
    console.error("Modern clipboard read failed:", err);
  }

  return null;
}
