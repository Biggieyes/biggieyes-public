import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.js"],
    include: ["__tests__/**/*.{js,jsx,ts,tsx}"],
    exclude: ["biggi-project/**", "bekend/**", "node_modules/**", "dist/**"],
  },
});
