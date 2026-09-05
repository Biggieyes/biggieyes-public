import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const FORBIDDEN_CLIENT_ENV_KEYS = new Set([
  "VITE_DEPLOYER_PRIVATE_KEY",
  "VITE_NETLIFY_AUTH_TOKEN",
  "VITE_PINATA_API_KEY",
  "VITE_PINATA_GATEWAY_JWT",
  "VITE_PINATA_GATEWAY_TOKEN",
  "VITE_PINATA_JWT",
  "VITE_PINATA_SECRET_API_KEY",
  "VITE_PRIVATE_KEY",
  "VITE_SUPABASE_SERVICE_ROLE_KEY",
]);

const FORBIDDEN_CLIENT_ENV_SUFFIX =
  /(?:^|_)(?:PRIVATE_KEY|MNEMONIC|SEED_PHRASE|SERVICE_ROLE_KEY|SECRET_API_KEY|AUTH_TOKEN|ACCESS_TOKEN|PASSWORD)$/;

function clientSecretGuard() {
  return {
    name: "biggi-client-secret-guard",
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, "");
      const forbidden = Object.entries(env)
        .filter(([, value]) => String(value || "").trim())
        .map(([key]) => key)
        .filter(
          (key) =>
            key.startsWith("VITE_") &&
            (FORBIDDEN_CLIENT_ENV_KEYS.has(key) ||
              FORBIDDEN_CLIENT_ENV_SUFFIX.test(key)),
        )
        .sort();

      if (forbidden.length) {
        throw new Error(
          `Refusing to expose secret-like client environment variable(s): ${forbidden.join(", ")}`,
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [clientSecretGuard(), react()],
  resolve: { alias: { '@': '/src' } },
  server: {
    headers: {
      // Dev-only CSP to allow console eval; do not use this in production.
      'Content-Security-Policy':
        "default-src 'self' data: blob: https: http:; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: https: http:; " +
        "style-src 'self' 'unsafe-inline' https: http: data:; " +
        "img-src 'self' data: blob: https: http:; " +
        "font-src 'self' data: https: http:; " +
        "connect-src 'self' https: http: ws: wss:; " +
        "worker-src 'self' blob:; " +
        "frame-src 'self' https: http:; " +
        "base-uri 'self';",
    },
  },
  build: {
    chunkSizeWarningLimit: 1700,
    rollupOptions: {
      input: {
        landing: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app/index.html'),
      },
      onwarn(warning, warn) {
        const message = warning?.message || "";
        const id = warning?.id || warning?.loc?.file || "";
        if (
          warning?.code === "INVALID_ANNOTATION" &&
          (id.includes("node_modules/ox/_esm/core/Base64.js") ||
            message.includes("node_modules/ox/_esm/core/Base64.js"))
        ) {
          return;
        }
        warn(warning);
      },
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.match(/node_modules\/(react|react-dom|scheduler)/)) {
            return 'vendor-react';
          }
          if (id.match(/node_modules\/(@?ethers|@ethersproject)/)) {
            return 'vendor-ethers';
          }
          if (id.match(/node_modules\/(@walletconnect|walletconnect|@reown|reown|viem|wagmi|@web3modal|web3modal)/)) {
            return 'vendor-wallet';
          }
          if (id.match(/node_modules\/@supabase/)) {
            return 'vendor-supabase';
          }
          if (id.match(/node_modules\/@phosphor-icons/)) {
            return 'vendor-icons';
          }
          return 'vendor';
        },
      },
    },
  },

});
