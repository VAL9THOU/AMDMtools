import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "packages/core/tests/**/*.test.ts",
      "src/__tests__/**/*.test.ts"
    ]
  }
});
