import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
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
          // Keep Vite's preload helper out of heavy vendor chunks.
          // Otherwise app entry can import the helper from vendor-wallet
          // and force early download of the wallet stack.
          if (id.includes("vite/preload-helper")) {
            return "vendor-preload";
          }
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
