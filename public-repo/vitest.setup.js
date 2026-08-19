import "@testing-library/jest-dom/vitest";

if (typeof navigator !== "undefined") {
  if (!navigator.userAgent) {
    Object.defineProperty(navigator, "userAgent", {
      value: "vitest",
      configurable: true,
    });
  }
  if (!navigator.clipboard) {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {},
        readText: async () => "",
      },
      configurable: true,
    });
  }
}
