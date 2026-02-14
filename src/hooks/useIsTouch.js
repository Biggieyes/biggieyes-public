import * as React from "react";

const detectTouch = () => {
  if (typeof window === "undefined") return false;
  if ("ontouchstart" in window) return true;
  if (navigator && navigator.maxTouchPoints > 0) return true;
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
};

export default function useIsTouch() {
  const [isTouch, setIsTouch] = React.useState(() => detectTouch());

  React.useEffect(() => {
    const update = () => setIsTouch(detectTouch());
    if (typeof window === "undefined") return undefined;
    window.addEventListener("touchstart", update, { passive: true });
    window.addEventListener("pointerdown", update, { passive: true });
    return () => {
      window.removeEventListener("touchstart", update);
      window.removeEventListener("pointerdown", update);
    };
  }, []);

  return isTouch;
}
