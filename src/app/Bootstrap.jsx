import * as React from "react";
import LoadingOverlay from "@/components/LoadingOverlay.jsx";
import { createPreloadManager } from "../shared/utils/preloadManager.js";

export default function Bootstrap({ children }) {
  const [ready, setReady] = React.useState(false);
  const [percent, setPercent] = React.useState(1);
  const [message, setMessage] = React.useState("Initializing...");
  const publishedRef = React.useRef({ percent: 1, message: "Initializing..." });

  const managerRef = React.useRef(null);
  if (!managerRef.current) {
    managerRef.current = createPreloadManager({ smoothing: true });
  }
  const manager = managerRef.current;

  React.useEffect(() => {
    manager.reset();
    const unsubscribe = manager.onUpdate(({ percent: p, message: msg }) => {
      const next = Math.floor(p);
      if (Number.isFinite(p) && next !== publishedRef.current.percent) {
        publishedRef.current.percent = next;
        setPercent(next);
      }
      if (msg && msg !== publishedRef.current.message) {
        publishedRef.current.message = msg;
        setMessage(msg);
      }
    });
    manager.start();
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
    const cleanups = [];
    const delay = (ms) =>
      new Promise((resolve) => {
        const id = setTimeout(resolve, ms);
        cleanups.push(() => {
          clearTimeout(id);
          resolve();
        });
      });
    const MIN_DURATION = 350;
    (async () => {
      try {
        const startTime = Date.now();

        const doneWindowLoad = manager.addTask(1);
        const doneFonts = manager.addTask(1);
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
            window.removeEventListener("load", finish);
            clearTimeout(timeoutId);
            if (!cancelled) doneWindowLoad(1);
            res();
          };
          window.addEventListener("load", finish);
          const timeoutId = setTimeout(finish, 3000);
          cleanups.push(finish);
        });

        manager.setMessage("Loading fonts and UI...");

        const fontsReady = new Promise((resolve) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);
            if (!cancelled) doneFonts(1);
            resolve();
          };
          const timeoutId = window.setTimeout(finish, 1500);
          cleanups.push(finish);
          const readiness =
            document.fonts && document.fonts.ready
              ? document.fonts.ready
              : Promise.resolve();

          Promise.resolve(readiness).then(finish, finish);
        });

        await Promise.all([waitForWindowLoad, fontsReady]);
        if (cancelled) return;

        manager.setMessage("Preparing dashboard...");

        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, MIN_DURATION - elapsed);
        if (remaining > 0) {
          await delay(remaining);
        }
        if (cancelled) return;

        doneFinalize(1);
        manager.setMessage("Done");
        publishedRef.current.percent = 100;
        setPercent(100);

        await delay(80);
        if (cancelled) return;

        setReady(true);
      } catch (e) {
        console.error("Bootstrap error:", e);
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((cleanup) => cleanup());
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
