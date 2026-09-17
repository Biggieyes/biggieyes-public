import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Bootstrap from "../src/app/Bootstrap.jsx";

const fixture = vi.hoisted(() => ({ managers: [] }));
vi.mock("../src/shared/utils/preloadManager.js", () => ({
  createPreloadManager: () => {
    const manager = {
      reset: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      setMessage: vi.fn(),
      addTask: vi.fn(() => vi.fn()),
      unsubscribe: vi.fn(),
    };
    manager.onUpdate = vi.fn((update) => {
      manager.update = update;
      return manager.unsubscribe;
    });
    fixture.managers.push(manager);
    return manager;
  },
}));
vi.mock("@/components/LoadingOverlay.jsx", () => ({
  default: ({ percent }) => <div role="status">{percent}</div>,
}));

const originalReadyState = Object.getOwnPropertyDescriptor(
  document,
  "readyState",
);
const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");
const setReadiness = (readyState, ready) => {
  Object.defineProperty(document, "readyState", {
    configurable: true,
    value: readyState,
  });
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready },
  });
};
const advance = async (ms) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
beforeEach(() => {
  vi.useFakeTimers();
  fixture.managers = [];
  setReadiness("complete", Promise.resolve());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  for (const [key, descriptor] of [
    ["readyState", originalReadyState],
    ["fonts", originalFonts],
  ]) {
    if (descriptor) Object.defineProperty(document, key, descriptor);
    else delete document[key];
  }
});

it.each([false, true])(
  "preserves bootstrap timing and child rendering (StrictMode: %s)",
  async (strict) => {
    const content = (
      <Bootstrap>
        <button>Dashboard</button>
      </Bootstrap>
    );
    render(strict ? <React.StrictMode>{content}</React.StrictMode> : content);
    expect(
      screen.getByRole("button", { name: "Dashboard" }),
    ).toBeInTheDocument();
    await advance(349);
    expect(screen.getByRole("status")).toBeInTheDocument();
    await advance(1);
    expect(screen.getByRole("status")).toHaveTextContent("100");
    await advance(79);
    expect(screen.getByRole("status")).toBeInTheDocument();
    await advance(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  },
);

it("does not commit another render for unchanged displayed progress", () => {
  const onRender = vi.fn();
  render(
    <React.Profiler id="startup" onRender={onRender}>
      <Bootstrap>Dashboard</Bootstrap>
    </React.Profiler>,
  );
  const manager = fixture.managers.at(-1);
  act(() => manager.update({ percent: 67.1 }));
  expect(screen.getByRole("status")).toHaveTextContent("67");
  const commits = onRender.mock.calls.length;
  act(() => manager.update({ percent: 67.8 }));
  expect(onRender).toHaveBeenCalledTimes(commits);
});

it("finishes when fonts and the window-load event never arrive", async () => {
  setReadiness("loading", new Promise(() => {}));
  render(<Bootstrap>Dashboard</Bootstrap>);
  await advance(3079);
  expect(screen.getByRole("status")).toBeInTheDocument();
  await advance(1);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("removes the load listener and cancels timers on unmount without publishing a late font result", async () => {
  let finishFonts;
  setReadiness(
    "loading",
    new Promise((resolve) => {
      finishFonts = resolve;
    }),
  );
  const remove = vi.spyOn(window, "removeEventListener");
  const view = render(<Bootstrap>Dashboard</Bootstrap>);
  const manager = fixture.managers.at(-1);
  view.unmount();
  const count = manager.setMessage.mock.calls.length;
  expect(remove).toHaveBeenCalledWith("load", expect.any(Function));
  expect(manager.unsubscribe).toHaveBeenCalledOnce();
  expect(manager.stop).toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  await act(async () => {
    finishFonts();
    fireEvent.load(window);
  });
  await advance(4000);
  expect(manager.setMessage).toHaveBeenCalledTimes(count);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  remove.mockRestore();
});
