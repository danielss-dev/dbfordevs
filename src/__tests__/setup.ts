/// <reference types="vitest/globals" />
import "@testing-library/jest-dom";

// Mock Tauri API for tests
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
