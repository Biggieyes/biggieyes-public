// src/main.jsx
import "../polyfills/module.js";
import * as React from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import "../index.css";
import LoadingOverlay from "@/components/LoadingOverlay.jsx";
import Bootstrap from "./Bootstrap.jsx";

const BiggiEyesDocsApp = React.lazy(
  () => import("../docs/BiggiEyesDocsApp.jsx"),
);
const AppRuntime = React.lazy(() => import("./AppRuntime.jsx"));

const isBiggiEyesDocsRoute =
  typeof window !== "undefined" &&
  window.location.pathname.replace(/\/+$/, "") === "/docs/biggieyes";

// React dev tooling and some debug paths stringify props/snapshots.
// Native BigInt breaks JSON.stringify, which can crash the whole render tree.
if (
  typeof BigInt === "function" &&
  typeof BigInt.prototype.toJSON !== "function"
) {
  Object.defineProperty(BigInt.prototype, "toJSON", {
    value() {
      return this.toString();
    },
    configurable: true,
    writable: true,
  });
}

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || "";
if (SENTRY_DSN) {
  const tracesSampleRate = Number(
    import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0,
  );
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
    enabled: true,
  });
}

// Spusť fix jen v prohlížeči a po mountu
if (typeof window !== "undefined" && !isBiggiEyesDocsRoute) {
  (async () => {
    try {
      const mod = await import("./utils/walletModalFix");
      const installWalletModalFix =
        mod.installWalletModalFix || mod.default || null;
      if (typeof installWalletModalFix === "function") {
        installWalletModalFix({ top: "2vh", zIndex: 10000 });
      }
    } catch {
      // ignore
    }
  })();
}

/* -------------------------
   Mount aplikace
   ------------------------- */
const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root element not found");

const root = createRoot(rootEl);
const appTree = isBiggiEyesDocsRoute ? (
  <React.Suspense
    fallback={<LoadingOverlay open percent={90} message="Loading docs..." />}
  >
    <BiggiEyesDocsApp />
  </React.Suspense>
) : (
  <Bootstrap>
    <React.Suspense
      fallback={
        <LoadingOverlay open percent={25} message="Loading dashboard..." />
      }
    >
      <AppRuntime />
    </React.Suspense>
  </Bootstrap>
);

const appWithBoundary = SENTRY_DSN ? (
  <Sentry.ErrorBoundary
    fallback={
      <div
        style={{
          margin: "12vh auto",
          maxWidth: 520,
          padding: 24,
          borderRadius: 16,
          background: "rgba(10,10,18,0.9)",
          color: "#f6f7fb",
          border: "1px solid rgba(255, 232, 0, 0.35)",
          textAlign: "center",
          fontFamily: "inherit",
        }}
      >
        <h2 style={{ margin: "0 0 10px" }}>Something went wrong</h2>
        <p style={{ margin: 0, opacity: 0.8 }}>
          Please refresh the page. If the issue persists, contact support.
        </p>
      </div>
    }
  >
    {appTree}
  </Sentry.ErrorBoundary>
) : (
  appTree
);

const strictModeEnabled =
  !import.meta.env.DEV || import.meta.env.VITE_REACT_STRICT_MODE === "1";

root.render(
  strictModeEnabled ? (
    <React.StrictMode>{appWithBoundary}</React.StrictMode>
  ) : (
    appWithBoundary
  ),
);
