import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3105",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "npm run build && PORT=3105 ADMIN_IDS=1 PGLITE_DIR=memory:// MIGRATIONS_DIR=apps/server/drizzle WEB_DIST_DIR=apps/web/dist node apps/server/dist/index.mjs",
    url: "http://127.0.0.1:3105/api/health",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
