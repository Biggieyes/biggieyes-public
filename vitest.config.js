import { defineConfig } from "vitest/config";
import { URL, fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.js"],
    include: ["__tests__/**/*.{js,jsx,ts,tsx}"],
    exclude: ["biggi-project/**", "bekend/**", "node_modules/**", "dist/**"],
  },
});
