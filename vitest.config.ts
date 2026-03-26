import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
  },
});
