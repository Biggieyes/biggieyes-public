import * as React from "react";

/**
 * Zjistí, zda zařízení podporuje dotykové ovládání.
 * Detekce je provedena při mountu a po prvním dotyku (některé prohlížeče aktualizují maxTouchPoints až po interakci).
 * @returns true pokud je zařízení touch
 */
function detectTouch() {
  if (typeof window === "undefined") return false;

  // msMaxTouchPoints is an old IE/Edge prefixed property not present in lib.dom types;
  // check for its existence and cast to any to avoid TypeScript errors.
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    (() => {
      if ("msMaxTouchPoints" in navigator) {
        const navWithMs = navigator as Navigator & {
          msMaxTouchPoints?: number;
        };
        return (navWithMs.msMaxTouchPoints ?? 0) > 0;
      }
      return false;
    })()
  );
}

export default function useIsTouch() {
  const [isTouch, setIsTouch] = React.useState(detectTouch());

  React.useEffect(() => {
    // Některé prohlížeče aktualizují maxTouchPoints až po první interakci
    const handler = () => setIsTouch(detectTouch());

    window.addEventListener("pointerdown", handler, { once: true });

    return () => {
      window.removeEventListener("pointerdown", handler);
    };
  }, []);

  return isTouch;
}
