import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Next's server bundler resolves "server-only" to its `react-server`
      // export condition (a no-op). Vitest has no such condition, so it
      // hits the package's default export, which throws unconditionally.
      // Alias to the same empty shim Next uses server-side — this stopped
      // being latent once src/mastra/workflows/brand-intelligence.ts (via
      // service-role.ts) pulled "server-only" into the src/mastra import
      // graph that tests/planner-001.test.ts already depended on.
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/components/**/*.test.tsx"],
  },
});

