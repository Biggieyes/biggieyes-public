import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useHashRouting from "../src/shared/hooks/useHashRouting.ts";

let frames;
let nextFrame;
const originalScroll = HTMLElement.prototype.scrollIntoView;
beforeEach(() => {
  window.history.replaceState(null, "", "/app/");
  frames = new Map();
  nextFrame = 0;
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    }),
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((id) => frames.delete(id)),
  );
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  document
    .querySelectorAll("[data-anchor-fixture]")
    .forEach((node) => node.remove());
  window.history.replaceState(null, "", "/app/");
  HTMLElement.prototype.scrollIntoView = originalScroll;
  vi.unstubAllGlobals();
});
function flushFrame() {
  const callbacks = [...frames.values()];
  frames.clear();
  act(() => callbacks.forEach((callback) => callback(0)));
}
function target(id) {
  const node = document.createElement("div");
  node.id = id;
  node.dataset.anchorFixture = "true";
  document.body.append(node);
  return node;
}

describe("Hash navigation scheduling", () => {
  it("treats fragments as exact IDs, not CSS selectors", () => {
    const node = target("gallery:details");
    const { result } = renderHook(() => useHashRouting("/"));
    act(() => result.current.scrollToAnchor("#gallery%3Adetails"));
    expect(() => flushFrame()).not.toThrow();
    expect(HTMLElement.prototype.scrollIntoView.mock.contexts).toEqual([node]);
  });

  it.each(["#[", "#%E0%A4%A", "#"])(
    "ignores an invalid or missing fragment target %s without crashing",
    (hash) => {
      const { result } = renderHook(() => useHashRouting("/"));
      act(() => result.current.scrollToAnchor(hash));
      expect(() => {
        flushFrame();
        flushFrame();
        flushFrame();
      }).not.toThrow();
      expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
      expect(frames.size).toBe(0);
    },
  );

  it("cancels older scrolling when a newer target is requested", () => {
    target("gallery");
    const latest = target("top");
    const { result } = renderHook(() => useHashRouting("/"));
    act(() => {
      result.current.scrollToAnchor("#gallery");
      result.current.scrollToAnchor("#top");
    });
    flushFrame();
    expect(HTMLElement.prototype.scrollIntoView.mock.contexts).toEqual([
      latest,
    ]);
  });

  it("cancels deferred scrolling on unmount", () => {
    const { result, unmount } = renderHook(() => useHashRouting("/"));
    act(() => result.current.scrollToAnchor("#gallery"));
    flushFrame();
    expect(frames.size).toBe(1);
    unmount();
    target("gallery");
    flushFrame();
    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });

  it("cancels scrolling to a stale hash when navigation changes", () => {
    target("gallery");
    const { result } = renderHook(() => useHashRouting("/"));
    act(() => result.current.scrollToAnchor("#gallery"));
    act(() => {
      window.history.replaceState(null, "", "/app/#top");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    flushFrame();
    expect(result.current.anchor).toBe("#top");
    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it("retries a lazy target for at most three animation frames", () => {
    const { result } = renderHook(() => useHashRouting("/"));
    act(() => result.current.scrollToAnchor("#not-mounted"));
    flushFrame();
    flushFrame();
    flushFrame();
    expect(requestAnimationFrame).toHaveBeenCalledTimes(3);
    expect(frames.size).toBe(0);
  });
});
