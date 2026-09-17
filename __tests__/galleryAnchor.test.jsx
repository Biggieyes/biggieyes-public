import React, { StrictMode, Suspense } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MainLayout from "../src/components/layout/MainLayout.jsx";
import GallerySection from "../src/components/layout/GallerySection.jsx";

vi.mock("../src/components/layout/HeaderControls", () => ({
  default: () => null,
}));
vi.mock("@/shared/components/StatusBanner", () => ({ default: () => null }));
vi.mock("../src/components/layout/LiveStatsPanel", () => ({
  default: () => null,
}));
vi.mock("../src/components/Gallery", () => ({
  default: () => <div data-testid="gallery-content">Gallery content</div>,
}));
vi.mock("@/providers/Web3Context.js", () => ({
  useWeb3: () => ({ chainId: 137, account: null }),
}));
vi.mock("@/shared/utils/contract", () => ({
  ACTIVE_CHAIN: { chainId: 137, name: "Polygon mainnet" },
}));

let observers;
const originalScroll = HTMLElement.prototype.scrollIntoView;
beforeEach(() => {
  window.history.replaceState(null, "", "/app/");
  observers = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback) {
        this.callback = callback;
        this.disconnect = vi.fn();
        observers.push(this);
      }
      observe(node) {
        this.node = node;
      }
    },
  );
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/app/");
  HTMLElement.prototype.scrollIntoView = originalScroll;
  vi.unstubAllGlobals();
});

function reveal(observer) {
  act(() =>
    observer.callback([{ target: observer.node, isIntersecting: true }]),
  );
}

describe("Gallery anchor ownership and lazy navigation", () => {
  it.each([false, true])(
    "retains one outer anchor after intersection (StrictMode=%s)",
    async (strict) => {
      const layout = <MainLayout />;
      const { container, unmount } = render(
        strict ? <StrictMode>{layout}</StrictMode> : layout,
      );
      const host = container.querySelector("#gallery");
      expect(host).not.toBeNull();
      expect(container.querySelector(".gallery-section")).toBeNull();
      reveal(observers.filter((observer) => observer.node === host).at(-1));
      await screen.findByTestId("gallery-content");
      expect(container.querySelectorAll("#gallery")).toHaveLength(1);
      expect(host).toContainElement(
        container.querySelector(".gallery-section"),
      );
      unmount();
      for (const observer of observers)
        expect(observer.disconnect).toHaveBeenCalled();
    },
  );

  it.each(["#gallery", "#/dashboard#gallery"])(
    "mounts a direct %s link without waiting for intersection",
    async (hash) => {
      window.history.replaceState(null, "", `/app/${hash}`);
      const { container } = render(<MainLayout />);
      await screen.findByTestId("gallery-content");
      expect(container.querySelectorAll("#gallery")).toHaveLength(1);
    },
  );

  it("mounts the deferred gallery when the hash changes", async () => {
    const { container } = render(<MainLayout />);
    expect(container.querySelector(".gallery-section")).toBeNull();
    act(() => {
      window.history.replaceState(null, "", "/app/#gallery");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await screen.findByTestId("gallery-content");
    expect(container.querySelectorAll("#gallery")).toHaveLength(1);
  });

  it("keeps footer navigation pointing to the stable outer host", async () => {
    const { container } = render(<MainLayout />);
    const host = container.querySelector("#gallery");
    reveal(observers.find((observer) => observer.node !== host));
    fireEvent.click(
      await screen.findByRole("link", { name: "Gallery", exact: true }),
    );
    expect(window.location.hash).toBe("#gallery");
    expect(HTMLElement.prototype.scrollIntoView.mock.contexts.at(-1)).toBe(
      host,
    );
    reveal(observers.find((observer) => observer.node === host));
    await screen.findByTestId("gallery-content");
    expect(container.querySelectorAll("#gallery")).toHaveLength(1);
  });

  it("preserves the standalone GallerySection default anchor", async () => {
    const { container } = render(
      <Suspense>
        <GallerySection />
      </Suspense>,
    );
    await screen.findByTestId("gallery-content");
    expect(container.querySelectorAll("#gallery")).toHaveLength(1);
    expect(container.querySelector("#gallery")).toHaveClass("gallery-section");
  });
});
