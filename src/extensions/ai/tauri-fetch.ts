/**
 * Custom fetch wrapper using Tauri HTTP plugin
 *
 * This bypasses browser CORS restrictions by making HTTP requests
 * through Tauri's Rust backend.
 */

import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

/**
 * Create a fetch function compatible with AI SDK that uses Tauri's HTTP client
 */
export function createTauriFetch(): typeof globalThis.fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    // Convert headers to Record<string, string>
    const headers: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, init.headers);
      }
    }

    console.log("[Tauri Fetch] Request:", {
      url,
      method: init?.method || "GET",
      headers: Object.keys(headers),
    });

    try {
      const response = await tauriFetch(url, {
        method: init?.method || "GET",
        headers,
        body: init?.body as BodyInit | undefined,
      });

      console.log("[Tauri Fetch] Response:", {
        status: response.status,
        statusText: response.statusText,
      });

      return response;
    } catch (error) {
      console.error("[Tauri Fetch] Error:", error);
      throw error;
    }
  };
}

/**
 * Singleton instance of the Tauri fetch wrapper
 */
export const tauriFetchWrapper = createTauriFetch();
