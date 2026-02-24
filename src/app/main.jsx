// src/main.jsx
import "../polyfills/module.js";
import * as React from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import "../index.css";
import App from "./App.jsx";
import { Web3Provider } from "./providers/Web3Provider.jsx";
import { ContractsProvider } from "./providers/ContractsProvider.jsx";
import { REWARDSProvider } from "./providers/REWARDSProvider.jsx";
import { VRFProvider } from "./providers/VrfProvider.jsx";
import { ensurePreferredRpc } from "../shared/utils/rpcConfig.js";
import LoadingOverlay from "@/components/LoadingOverlay.jsx";
import { createPreloadManager } from "../shared/utils/preloadManager.js";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || "";
if (SENTRY_DSN) {
  const tracesSampleRate = Number(
    import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0,
  );
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: Number.isFinite(tracesSampleRate)
      ? tracesSampleRate
      : 0,
    enabled: true,
  });
}

// Spusť fix jen v prohlížeči a po mountu
if (typeof window !== "undefined") {
  (async () => {
    try {
      await ensurePreferredRpc();
    } catch {
      // ignore
    }
  })();
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

// LoadingOverlay now lives in src/components/LoadingOverlay.jsx

/* -------------------------
   Bootstrap component
   - vždy ukáže plynulou animaci 1 -> 100
   - čeká na základní readiness (window load, fonts) ale i kdyby byly hotové dřív,
     animace poběží minimálně MIN_DURATION ms
*/
function Bootstrap({ children }) {
  const [ready, setReady] = React.useState(false);
  const [percent, setPercent] = React.useState(1);
  const [message, setMessage] = React.useState("Initializing...");

  const managerRef = React.useRef(null);
  if (!managerRef.current) {
    managerRef.current = createPreloadManager({ smoothing: true });
  }
  const manager = managerRef.current;

  React.useEffect(() => {
    const unsubscribe = manager.onUpdate(({ percent: p, message: msg }) => {
      if (Number.isFinite(p)) setPercent(p);
      if (msg) setMessage(msg);
    });
    return () => {
      unsubscribe();
      manager.stop();
    };
  }, [manager]);

  React.useEffect(() => {
    if (ready) manager.stop();
  }, [ready, manager]);

  React.useEffect(() => {
    let cancelled = false;
    const MIN_DURATION = 2000; // minimal visual duration in ms (change if you want longer)
    (async () => {
      try {
        const startTime = Date.now();

        const doneWindowLoad = manager.addTask(1);
        const doneFonts = manager.addTask(1);
        const doneDelay = manager.addTask(1);
        const doneSnapshot = manager.addTask(1);
        const doneFinalize = manager.addTask(1);

        manager.setMessage("Connecting resources...");

        const waitForWindowLoad = new Promise((res) => {
          if (document.readyState === "complete") {
            doneWindowLoad(1);
            return res();
          }
          let resolved = false;
          const finish = () => {
            if (resolved) return;
            resolved = true;
            doneWindowLoad(1);
            res();
          };
          const onLoad = () => {
            window.removeEventListener("load", onLoad);
            finish();
          };
          window.addEventListener("load", onLoad);
          setTimeout(finish, 3000);
        });

        manager.setMessage("Loading fonts and UI...");

        const fontsReady = (
          document.fonts && document.fonts.ready
            ? document.fonts.ready
            : Promise.resolve()
        ).then(() => doneFonts(1));

        const smallDelay = new Promise((res) => setTimeout(res, 500)).then(() =>
          doneDelay(1),
        );

        await Promise.all([waitForWindowLoad, fontsReady, smallDelay]);
        if (cancelled) return;

        manager.setMessage("Loading the on-chain snapshot...");
        await new Promise((res) => setTimeout(res, 700));
        doneSnapshot(1);
        if (cancelled) return;

        manager.setMessage("Finalizing...");

        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, MIN_DURATION - elapsed);
        if (remaining > 0) {
          await new Promise((res) => setTimeout(res, remaining));
        }
        if (cancelled) return;

        doneFinalize(1);

        await new Promise((res) => setTimeout(res, 420));
        if (cancelled) return;

        manager.setMessage("Done - loading the app");
        setPercent(100);

        await new Promise((res) => setTimeout(res, 180));
        if (cancelled) return;

        setReady(true);
      } catch (e) {
        console.error("Bootstrap error:", e);
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [manager]);

  return (
    <>
      {children}
      {!ready && (
        <LoadingOverlay open={!ready} percent={percent} message={message} />
      )}
    </>
  );
}

/* -------------------------
   Mount aplikace
   ------------------------- */
const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root element not found");

const root = createRoot(rootEl);
const appTree = (
  <Bootstrap>
    <Web3Provider>
      <ContractsProvider>
        <VRFProvider>
          <REWARDSProvider>
            <App />
          </REWARDSProvider>
        </VRFProvider>
      </ContractsProvider>
    </Web3Provider>
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

root.render(
  <React.StrictMode>
    {appWithBoundary}
  </React.StrictMode>,
);





