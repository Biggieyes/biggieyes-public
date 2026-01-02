import * as React from "react";

export function useNavHotkeys(navOpen, goNextPanel, goPrevPanel) {
  React.useEffect(() => {
    if (navOpen && typeof window !== "undefined") {
      const handler = (event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          goNextPanel();
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          goPrevPanel();
        }
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }
  }, [navOpen, goNextPanel, goPrevPanel]);
}
