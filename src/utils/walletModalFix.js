// src/utils/walletModalFix.js
const PATCH_ID = "wallet-modal-fix-v2";

function applyStyles(root, { top, z }) {
  try {
    // hosty + vnitřní kontejnery (širší match)
    const candidates = [
      "w3m-modal",
      "#w3m-modal",
      ".w3m-modal",
      ".w3m-modal__container",
      ".w3m-modal-container",
      "wcm-modal",
      "#wcm-modal",
      ".wcm-modal",
      ".wcm-modal__inner",
      ".wcm-modal-container",
      "[class*='w3m-'][class*='modal']",
      "[class*='wcm-'][class*='modal']",
    ];

    const wrappers = root.querySelectorAll(candidates.join(","));
    wrappers.forEach((el) => {
      el.style.setProperty("align-items", "flex-start", "important");
      el.style.setProperty("justify-content", "center", "important");
      el.style.setProperty(
        "padding-top",
        `calc(${top} + env(safe-area-inset-top))`,
        "important",
      );
      el.style.setProperty("z-index", String(z), "important");
      el.style.setProperty("inset", "0", "important");
      el.style.setProperty("position", "fixed", "important");
    });

    const panels = root.querySelectorAll(
      [
        ".w3m-modal-container",
        ".w3m-modal__container",
        ".w3m-modal-card",
        ".wcm-modal-container",
        ".wcm-modal-card",
        ".wcm-desktop-connecting-container",
        "[class*='w3m-'][class*='card']",
        "[class*='wcm-'][class*='card']",
      ].join(","),
    );
    panels.forEach((el) => {
      el.style.setProperty(
        "max-height",
        `calc(100svh - (${top} + env(safe-area-inset-top)))`,
        "important",
      );
      el.style.setProperty("overflow", "auto", "important");
      el.style.setProperty("margin-top", "0", "important");
      el.style.setProperty("overscroll-behavior", "contain", "important");
    });

    const overlays = root.querySelectorAll(
      ".w3m-overlay, .wcm-overlay, [class*='w3m-'][class*='overlay'], [class*='wcm-'][class*='overlay']",
    );
    overlays.forEach((el) => {
      el.style.setProperty("z-index", String(z - 1), "important");
      el.style.setProperty("position", "fixed", "important");
      el.style.setProperty("inset", "0", "important");
    });
  } catch {
    // ignore style patch errors
  }
}

function patchOne(el, opts) {
  const roots = [];
  if (el?.shadowRoot) roots.push(el.shadowRoot);
  if (el) roots.push(el);
  roots.forEach((r) => applyStyles(r, opts));
}

function hasAnyModalInDom() {
  return !!document.querySelector(
    "w3m-modal,#w3m-modal,.w3m-modal,.w3m-modal-container,wcm-modal,#wcm-modal,.wcm-modal",
  );
}

function scanAndPatch(opts) {
  // nastavit i CSS proměnnou Web3Modalu (zvedne z-index i uvnitř shadow-dom)
  try {
    document.documentElement.style.setProperty("--w3m-z-index", String(opts.z));
  } catch {
    // ignore style set errors
  }
  if (!hasAnyModalInDom()) return;

  const hosts = [
    ...document.querySelectorAll(
      "w3m-modal, w3m-connect-button, w3m-core-button, wcm-modal",
    ),
    ...document.querySelectorAll(
      "#w3m-modal, #wcm-modal, .w3m-modal, .wcm-modal",
    ),
  ];
  hosts.forEach((h) => patchOne(h, opts));
  patchOne(document.body, opts);
}

export function installWalletModalFix({ top = "2vh", zIndex = 10000 } = {}) {
  if (typeof document === "undefined") return;
  if (document.documentElement.hasAttribute(PATCH_ID)) return;
  document.documentElement.setAttribute(PATCH_ID, "1");

  const opts = { top, z: zIndex };
  scanAndPatch(opts);

  // MutationObserver + interval (některé verze si přepisují styly po animaci)
  let rafId = null;
  const obs = new MutationObserver(() => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => scanAndPatch(opts));
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  const intId = setInterval(() => {
    if (
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    )
      return;
    scanAndPatch(opts);
  }, 1200);

  return () => {
    obs.disconnect();
    if (rafId) cancelAnimationFrame(rafId);
    clearInterval(intId);
  };
}

