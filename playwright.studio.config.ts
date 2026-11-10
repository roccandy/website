import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/studio",
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: "http://127.0.0.1:4317",
    viewport: { width: 1600, height: 1100 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tests/studio/server.mjs",
    url: "http://127.0.0.1:4317",
    reuseExistingServer: false,
  },
});
