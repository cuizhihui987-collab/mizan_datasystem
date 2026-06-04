import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["@testing-library/jest-dom"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules"],
    passWithNoTests: true,
  },
});
