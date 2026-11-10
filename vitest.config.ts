import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    exclude: [...configDefaults.exclude, "tests/studio/**"],
    environment: "node",
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
  },
});
