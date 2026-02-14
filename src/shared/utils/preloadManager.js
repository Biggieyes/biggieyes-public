// jednoduchý progress manager: registrovat úlohy a reportovat completion
export function createPreloadManager({ smoothing = true } = {}) {
  let total = 0;
  let done = 0;
  let listeners = [];
  let message = "";

  function onUpdate(cb) {
    listeners.push(cb);
    return () => (listeners = listeners.filter((x) => x !== cb));
  }
  function notify() {
    const ratio = total === 0 ? 1 : done / total;
    listeners.forEach((cb) => cb({ ratio, percent: ratio * 100, message }));
  }
  function addTask(weight = 1) {
    total += weight;
    return (w = 1) => {
      done += w;
      notify();
    };
  }
  function setMessage(m) {
    message = m;
    notify();
  }

  // smoothing helper: animates percent toward target
  if (smoothing) {
    let current = 0;
    let raf;
    const tick = () => {
      const target = total === 0 ? 100 : (done / total) * 100;
      current += (target - current) * 0.12; // smoothing factor
      listeners.forEach((cb) =>
        cb({ ratio: current / 100, percent: current, message }),
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return {
      onUpdate,
      addTask,
      setMessage,
      stop: () => cancelAnimationFrame(raf),
    };
  }

  return { onUpdate, addTask, setMessage, stop: () => {} };
}

/* Helpers */

// preload images by creating Image() instances (no progress per image, so count complete)
export function preloadImages(urls, manager) {
  const done = manager.addTask(urls.length);
  return Promise.all(
    urls.map(
      (url) =>
        new Promise((res) => {
          const img = new Image();
          img.onload = () => {
            done(1);
            res(true);
          };
          img.onerror = () => {
            done(1);
            res(false);
          };
          img.src = url;
        }),
    ),
  );
}

// preload JSON/resources via fetch and measure bytes using ReadableStream if available
export async function preloadFetchWithBytes(urls, manager) {
  const task = manager.addTask(urls.length);
  for (const url of urls) {
    try {
      const resp = await fetch(url);
      if (resp.body && resp.headers.get("content-length")) {
        const reader = resp.body.getReader();
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      } else {
        // fallback: just await full body
        await resp.text();
      }
    } catch {
      // ignore error, we still count as completed
    } finally {
      task(1);
    }
  }
}

// convenience: count N generic promises
export async function trackPromises(promises, manager) {
  const task = manager.addTask(promises.length);
  await Promise.all(
    promises.map((p) =>
      p
        .then((r) => {
          task(1);
          return r;
        })
        .catch(() => {
          task(1);
          return null;
        }),
    ),
  );
}

