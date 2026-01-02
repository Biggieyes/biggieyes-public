// src/main.jsx
import * as React from "react";
import { render } from "preact/compat";
import { Buffer } from "buffer/";
import "./index.css";
import App from "./App.jsx";
import { Web3Provider } from "./providers/Web3Provider.jsx";
import { ContractsProvider } from "./providers/ContractsProvider.jsx";
import { RewardsProvider } from "./providers/RewardsProvider.jsx";

// Restore global Buffer so WalletConnect/ethers helpers depending on it keep working in-browser.
if (typeof globalThis !== "undefined" && typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}

// Spusť fix jen v prohlížeči a po mountu
if (typeof window !== "undefined") {
  (async () => {
    try {
      const mod = await import("./utils/walletModalFix");
      const installWalletModalFix = mod.installWalletModalFix || mod.default || null;
      if (typeof installWalletModalFix === "function") {
        installWalletModalFix({ top: "2vh", zIndex: 10000 });
      }
    } catch {
      // ignore
    }
  })();
}

/* -------------------------
   Inline LoadingOverlay
   ------------------------- */
function LoadingOverlay({ percent = 0, message = "Loading..." }) {
  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <div className="loading-card">
        <h1>BiggiEyes</h1>
        <div className="progress-wrap" aria-hidden>
          <div
            className="progress-bar"
            style={{ width: `${Math.max(0, Math.min(100, Math.floor(percent)))}%` }}
          />
        </div>
        <div className="percent" aria-hidden>{Math.floor(percent)}%</div>
        <div className="msg">{message}</div>
      </div>
    </div>
  );
}

/* -------------------------
   Bootstrap component
   - vždy ukáže plynulou animaci 1 -> 100
   - čeká na základní readiness (window load, fonts) ale i kdyby byly hotové dřív,
     animace poběží minimálně MIN_DURATION ms
*/
function Bootstrap({ children }) {
  const [ready, setReady] = React.useState(false);
  const [percent, setPercent] = React.useState(1); // start at 1%
  const [target, setTarget] = React.useState(1);
  const [message, setMessage] = React.useState("Initializing...");

  // smoothing RAF loop: interpoluje percent směrem k target (bez refů)
  React.useEffect(() => {
    let rafId = 0;
    const tick = () => {
      setPercent((cur) => {
        const next = cur + (target - cur) * 0.12;
        return Math.abs(next - target) < 0.25 ? target : next;
      });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target]);

  // helper pro nastavení cíle (target)
  const setTargetClamped = (v) => {
    const vv = Math.max(1, Math.min(100, Number(v || 0)));
    setTarget((prev) => Math.max(prev, vv));
  };

  // hlavní orchestrator
  React.useEffect(() => {
    let cancelled = false;
    const MIN_DURATION = 2000; // minimal visual duration in ms (change if you want longer)
    (async () => {
      try {
        const startTime = Date.now();

        setMessage("Connecting resources...");
        setTargetClamped(10);

        // wait for window load but with safety timeout
        const waitForWindowLoad = new Promise((res) => {
          if (document.readyState === "complete") return res();
          const onLoad = () => { window.removeEventListener("load", onLoad); res(); };
          window.addEventListener("load", onLoad);
          setTimeout(res, 3000); // safety fallback
        });

        setMessage("Loading fonts and UI...");
        setTargetClamped(30);

        // fonts
        const fontsReady = (document.fonts && document.fonts.ready)
          ? document.fonts.ready
          : Promise.resolve();

        // small background buffer
        const smallDelay = new Promise((res) => setTimeout(res, 500));

        // wait for readiness signals
        await Promise.all([waitForWindowLoad, fontsReady, smallDelay]);
        if (cancelled) return;

        setMessage("Loading the on-chain snapshot...");
        setTargetClamped(60);

        // allow some time for on-chain reads if any (non-blocking)
        await new Promise((res) => setTimeout(res, 700));
        if (cancelled) return;

        setMessage("Finalizing...");
        setTargetClamped(92);

        // ensure minimum visual duration
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, MIN_DURATION - elapsed);
        if (remaining > 0) {
          await new Promise((res) => setTimeout(res, remaining));
        }
        if (cancelled) return;

        // final approach to 100
        setTargetClamped(100);

        // wait briefly for smooth visual settling (max 800ms)
        await new Promise((res) => setTimeout(res, 420));
        if (cancelled) return;

        if (cancelled) return;
        setMessage("Done - loading the app");

        // tiny delay before mount to avoid flicker
        await new Promise((res) => setTimeout(res, 180));
        if (cancelled) return;

        setReady(true);
      } catch (e) {
        console.error("Bootstrap error:", e);
        if (!cancelled) setReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return (
    <>
      {children}
      {!ready && <LoadingOverlay percent={percent} message={message} />}
    </>
  );
}

/* -------------------------
   Mount aplikace
   ------------------------- */
const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root element not found");

render(
  <React.StrictMode>
    <Bootstrap>
      <Web3Provider>
        <ContractsProvider>
          <RewardsProvider>
            <App />
          </RewardsProvider>
        </ContractsProvider>
      </Web3Provider>
    </Bootstrap>
  </React.StrictMode>,
  rootEl
);
