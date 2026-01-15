/**
 * Binary data utilities for data grid
 * Provides hex view, base64 conversion, and image detection
 */

import type { DetectedImageInfo } from "@/types/grid";

// Magic bytes for common image formats
const IMAGE_SIGNATURES: Record<string, { bytes: number[]; type: DetectedImageInfo["type"]; mimeType: string }> = {
  png: {
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    type: "png",
    mimeType: "image/png",
  },
  jpeg: {
    bytes: [0xff, 0xd8, 0xff],
    type: "jpeg",
    mimeType: "image/jpeg",
  },
  gif87a: {
    bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
    type: "gif",
    mimeType: "image/gif",
  },
  gif89a: {
    bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
    type: "gif",
    mimeType: "image/gif",
  },
  webp: {
    bytes: [0x52, 0x49, 0x46, 0x46], // RIFF, but we also check for WEBP at offset 8
    type: "webp",
    mimeType: "image/webp",
  },
  bmp: {
    bytes: [0x42, 0x4d],
    type: "bmp",
    mimeType: "image/bmp",
  },
};

/**
 * Convert a hex string to a Uint8Array
 */
export function hexToBytes(hexString: string): Uint8Array {
  // Remove common prefixes and separators
  const cleaned = hexString
    .replace(/^0x/i, "")
    .replace(/\\x/g, "")
    .replace(/[\s:-]/g, "");

  if (cleaned.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }

  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < cleaned.length; i += 2) {
    const byte = parseInt(cleaned.substring(i, i + 2), 16);
    if (isNaN(byte)) {
      throw new Error(`Invalid hex character at position ${i}`);
    }
    bytes[i / 2] = byte;
  }

  return bytes;
}

/**
 * Convert bytes to a hex string
 */
export function bytesToHex(bytes: Uint8Array, separator = " "): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(separator);
}

/**
 * Convert bytes to base64 string
 */
export function bytesToBase64(bytes: Uint8Array): string {
  // Convert Uint8Array to binary string
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 to bytes
 */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Detect if binary data is an image and return info about it
 */
export function detectImageType(bytes: Uint8Array): DetectedImageInfo | null {
  if (bytes.length < 8) return null;

  // Check PNG
  if (matchesSignature(bytes, IMAGE_SIGNATURES.png.bytes)) {
    const info = extractPngDimensions(bytes);
    return {
      type: "png",
      mimeType: "image/png",
      ...info,
    };
  }

  // Check JPEG
  if (matchesSignature(bytes, IMAGE_SIGNATURES.jpeg.bytes)) {
    return {
      type: "jpeg",
      mimeType: "image/jpeg",
    };
  }

  // Check GIF
  if (
    matchesSignature(bytes, IMAGE_SIGNATURES.gif87a.bytes) ||
    matchesSignature(bytes, IMAGE_SIGNATURES.gif89a.bytes)
  ) {
    const info = extractGifDimensions(bytes);
    return {
      type: "gif",
      mimeType: "image/gif",
      ...info,
    };
  }

  // Check WebP
  if (
    matchesSignature(bytes, IMAGE_SIGNATURES.webp.bytes) &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return {
      type: "webp",
      mimeType: "image/webp",
    };
  }

  // Check BMP
  if (matchesSignature(bytes, IMAGE_SIGNATURES.bmp.bytes)) {
    const info = extractBmpDimensions(bytes);
    return {
      type: "bmp",
      mimeType: "image/bmp",
      ...info,
    };
  }

  return null;
}

/**
 * Check if bytes match a signature
 */
function matchesSignature(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) return false;
  }
  return true;
}

/**
 * Extract dimensions from PNG
 */
function extractPngDimensions(bytes: Uint8Array): { width?: number; height?: number } {
  if (bytes.length < 24) return {};
  // PNG dimensions are at bytes 16-23 (IHDR chunk)
  const width =
    (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  const height =
    (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
  return { width, height };
}

/**
 * Extract dimensions from GIF
 */
function extractGifDimensions(bytes: Uint8Array): { width?: number; height?: number } {
  if (bytes.length < 10) return {};
  // GIF dimensions are at bytes 6-9 (little-endian)
  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  return { width, height };
}

/**
 * Extract dimensions from BMP
 */
function extractBmpDimensions(bytes: Uint8Array): { width?: number; height?: number } {
  if (bytes.length < 26) return {};
  // BMP dimensions are at bytes 18-21 and 22-25 (little-endian, signed)
  const width = bytes[18] | (bytes[19] << 8) | (bytes[20] << 16) | (bytes[21] << 24);
  const height = bytes[22] | (bytes[23] << 8) | (bytes[24] << 16) | (bytes[25] << 24);
  return { width, height: Math.abs(height) }; // Height can be negative
}

/**
 * Generate hex view string for binary data
 */
export function generateHexView(
  bytes: Uint8Array,
  bytesPerRow: 16 | 32 = 16
): string {
  const lines: string[] = [];
  const totalRows = Math.ceil(bytes.length / bytesPerRow);

  for (let row = 0; row < totalRows; row++) {
    const offset = row * bytesPerRow;
    const rowBytes = bytes.slice(offset, offset + bytesPerRow);

    // Offset column (8 hex digits)
    const offsetStr = offset.toString(16).padStart(8, "0").toUpperCase();

    // Hex columns
    const hexParts: string[] = [];
    for (let i = 0; i < bytesPerRow; i++) {
      if (i < rowBytes.length) {
        hexParts.push(rowBytes[i].toString(16).padStart(2, "0").toUpperCase());
      } else {
        hexParts.push("  ");
      }
    }

    // Group hex bytes for readability
    let hexStr: string;
    if (bytesPerRow === 16) {
      // Group into 2 groups of 8
      hexStr = hexParts.slice(0, 8).join(" ") + "  " + hexParts.slice(8).join(" ");
    } else {
      // Group into 4 groups of 8
      hexStr =
        hexParts.slice(0, 8).join(" ") +
        "  " +
        hexParts.slice(8, 16).join(" ") +
        "  " +
        hexParts.slice(16, 24).join(" ") +
        "  " +
        hexParts.slice(24).join(" ");
    }

    // ASCII column
    const asciiParts: string[] = [];
    for (let i = 0; i < rowBytes.length; i++) {
      const byte = rowBytes[i];
      // Printable ASCII range (32-126)
      if (byte >= 32 && byte <= 126) {
        asciiParts.push(String.fromCharCode(byte));
      } else {
        asciiParts.push(".");
      }
    }
    const asciiStr = asciiParts.join("");

    lines.push(`${offsetStr}  ${hexStr}  |${asciiStr}|`);
  }

  return lines.join("\n");
}

/**
 * Check if a string value looks like hex data
 */
export function isHexString(value: string): boolean {
  // Check for common hex prefixes
  if (value.startsWith("0x") || value.startsWith("\\x")) {
    return true;
  }

  // Check if the string contains only hex characters and separators
  const cleaned = value.replace(/[\s:-]/g, "");
  return /^[0-9a-fA-F]+$/.test(cleaned) && cleaned.length >= 2;
}

/**
 * Safely try to parse a value as binary data
 */
export function tryParseBinary(value: unknown): Uint8Array | null {
  if (value === null || value === undefined) return null;

  // Already Uint8Array
  if (value instanceof Uint8Array) return value;

  // ArrayBuffer
  if (value instanceof ArrayBuffer) return new Uint8Array(value);

  if (typeof value === "string") {
    const trimmed = value.trim();

    // Try base64 FIRST - check for common base64 image signatures
    // These patterns indicate base64-encoded images
    const looksLikeBase64Image =
      trimmed.startsWith("iVBORw") ||  // PNG
      trimmed.startsWith("/9j/") ||     // JPEG
      trimmed.startsWith("R0lGOD") ||   // GIF
      trimmed.startsWith("UklGR") ||    // WebP
      trimmed.startsWith("Qk");         // BMP

    if (looksLikeBase64Image || (/^[A-Za-z0-9+/]+=*$/.test(trimmed) && trimmed.length > 20)) {
      try {
        return base64ToBytes(trimmed);
      } catch {
        // Fall through to hex parsing
      }
    }

    // Try hex parsing (for strings starting with \x or 0x, or pure hex)
    if (isHexString(trimmed)) {
      try {
        return hexToBytes(trimmed);
      } catch {
        return null;
      }
    }
  }

  // Array of numbers
  if (Array.isArray(value) && value.every((n) => typeof n === "number")) {
    return new Uint8Array(value);
  }

  return null;
}

/**
 * Create a data URL for an image from bytes
 */
export function createImageDataUrl(bytes: Uint8Array, mimeType: string): string {
  const base64 = bytesToBase64(bytes);
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Get a truncated preview of binary data
 */
export function getBinaryPreview(
  bytes: Uint8Array,
  maxLength: number = 50
): string {
  const preview = bytes.slice(0, maxLength);
  const hex = bytesToHex(preview, " ");
  if (bytes.length > maxLength) {
    return `${hex}... (${bytes.length} bytes total)`;
  }
  return hex;
}

/**
 * Format byte size for display
 */
export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
