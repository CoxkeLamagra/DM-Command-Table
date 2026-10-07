import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  timeout: 60_000,
  use: { baseURL: "http://127.0.0.1:3100", headless: true },
  webServer: {
    command: "node --experimental-strip-types scripts/browser-test-server.mjs",
    url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
