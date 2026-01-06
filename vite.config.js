import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import inject from "@rollup/plugin-inject";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wcEnvEsm = path.resolve(__dirname, "node_modules/@walletconnect/environment/dist/esm/index.js");
const wcTimeEsm = path.resolve(__dirname, "node_modules/@walletconnect/time/dist/esm/index.js");
const wcWindowGettersEsm = path.resolve(__dirname, "node_modules/@walletconnect/window-getters/dist/esm/index.js");
const wcWindowMetadataEsm = path.resolve(__dirname, "node_modules/@walletconnect/window-metadata/dist/esm/index.js");

export default defineConfig({
  plugins: [
    react(),
    inject({
      Buffer: ["buffer", "Buffer"],
      process: path.resolve(__dirname, "src/shims/process-shim.js"),
    }),
  ],

  base: "/",

  define: {
    global: "globalThis",
    "process.env": {},
  },

  resolve: {
    alias: [
      { find: /^@walletconnect\/environment$/, replacement: wcEnvEsm },
      { find: /^@walletconnect\/time$/, replacement: wcTimeEsm },
      { find: /^@walletconnect\/window-getters$/, replacement: wcWindowGettersEsm },
      { find: /^@walletconnect\/window-metadata$/, replacement: wcWindowMetadataEsm },
      { find: /^react$/, replacement: "preact/compat" },
      { find: /^react-dom$/, replacement: "preact/compat" },
      { find: /^react-dom\/client$/, replacement: "preact/compat" },
      { find: /^react\/jsx-dev-runtime$/, replacement: "preact/jsx-dev-runtime" },
      { find: /^react\/jsx-runtime$/, replacement: "preact/jsx-runtime" },
      { find: /^react-is$/, replacement: path.resolve(__dirname, "src/shims/react-is.js") },
      { find: /^recharts$/, replacement: path.resolve(__dirname, "src/shims/recharts-esm.js") },
      {
        find: /^use-sync-external-store\/with-selector$/,
        replacement: path.resolve(__dirname, "src/shims/useSyncExternalStoreWithSelector.js"),
      },
      {
        find: /^use-sync-external-store\/shim\/with-selector$/,
        replacement: path.resolve(__dirname, "src/shims/useSyncExternalStoreWithSelector.js"),
      },
      {
        find: /use-sync-external-store\/with-selector\.js$/,
        replacement: path.resolve(__dirname, "src/shims/useSyncExternalStoreWithSelector.js"),
      },
      { find: /^buffer$/, replacement: "buffer" },
      { find: /^util$/, replacement: "util/" },
      { find: /^process$/, replacement: path.resolve(__dirname, "src/shims/process-shim.js") },
      { find: /^js-sha3$/, replacement: path.resolve(__dirname, "src/shims/js-sha3-default.js") },
    ],
    dedupe: ["react", "react-dom"],
  },

  server: {
    proxy: {
      "/.netlify/functions": {
        target: "http://localhost:8888",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:8888",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, "/.netlify/functions"),
      },
      "/rpc-amoy": {
        target: "https://rpc-amoy.polygon.technology",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/rpc-amoy/, ""),
      },
    },
  },

  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "framer-motion",
      "i18next",
      "react-i18next",
      "react-markdown",
      "ethers",
      "buffer",
      "util",
      "process",
      "@walletconnect/ethereum-provider",
      "@walletconnect/modal",
      "js-sha3",
      "@noble/hashes/sha3.js",
      "@noble/hashes/utils.js",
      "hash.js",
      "bech32",
      "aes-js",
      "scrypt-js",
      "@ethersproject/bignumber",
      "@ethersproject/bytes",
      "@ethersproject/signing-key",
      "@ethersproject/keccak256",
      "@ethersproject/sha2",
      "@ethersproject/pbkdf2",
    ],
    exclude: [],
    needsInterop: [
      "react",
      "react-dom",
      "scheduler",
      "use-sync-external-store",
      "use-sync-external-store/shim",
      "use-sync-external-store/shim/with-selector",
      "recharts",
    ],
    esbuildOptions: {
      define: {
        global: "globalThis",
        "process.env": "{}",
      },
    },
  },

  build: {
    target: "es2020",
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: true,
    assetsInlineLimit: 0,
    minify: "esbuild",
    modulePreload: { polyfill: true },
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      onwarn(warning, warn) {
        const isPureAnnotation =
          typeof warning.message === "string" && warning.message.includes("/*#__PURE__*/");
        if (
          isPureAnnotation &&
          warning.id &&
          /node_modules[\\/](?:@walletconnect|@reown)/.test(warning.id) &&
          /[\\/]ox[\\/]_esm[\\/]/.test(warning.id)
        ) {
          return;
        }
        warn(warning);
      },
      output: {
        manualChunks: {
          motion: ["framer-motion"],
          i18n: ["i18next", "react-i18next"],
          markdown: ["react-markdown"],
          wc: ["@walletconnect/ethereum-provider", "@walletconnect/modal"],
          reown: ["@reown/appkit", "@reown/appkit-controllers"],
        },
      },
    },
  },

  esbuild: {
    drop: ["console", "debugger"],
  },
});
