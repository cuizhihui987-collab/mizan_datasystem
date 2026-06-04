import baseConfig from "./vitest.base";
import { defineConfig } from "vitest/config";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    environment: "jsdom",
    setupFiles: ["@testing-library/jest-dom"],
  },
});
