import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["dotenv/config"],
    include: ["test/**/*.test.ts", "src/**/__tests__/**/*.test.ts", "tests/security/**/*.test.ts"],
    testTimeout: 10000,
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      exclude: ["src/lib/data/client.ts"],
    },
  },
  resolve: {
    alias: {
      "@": import.meta.dirname + "/src",
    },
  },
});
