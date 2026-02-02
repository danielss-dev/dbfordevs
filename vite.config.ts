import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Vite options tailored for Tauri development
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
      usePolling: true,
      interval: 250,
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-zustand": ["zustand"],
          "vendor-monaco": ["@monaco-editor/react"],
          "vendor-ai": ["ai", "@ai-sdk/anthropic", "@ai-sdk/openai", "@ai-sdk/google"],
          "vendor-tanstack": ["@tanstack/react-table"],
          "vendor-markdown": ["react-markdown"],
          "vendor-sql-formatter": ["sql-formatter"],
        },
      },
    },
  },
});

