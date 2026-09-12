import { afterEach, describe, expect, it, vi } from "vitest";
import { createPreloadManager } from "../src/shared/utils/preloadManager.js";
afterEach(() => vi.unstubAllGlobals());
describe("preloader lifecycle", () => {
  it("is side-effect free until start and supports StrictMode stop/start", () => {
    const callbacks = new Map();
    let id = 0;
    const schedule = vi.fn((cb) => {
      callbacks.set(++id, cb);
      return id;
    });
    vi.stubGlobal("requestAnimationFrame", schedule);
    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn((id) => callbacks.delete(id)),
    );
    const manager = createPreloadManager();
    expect(schedule).not.toHaveBeenCalled();
    manager.start();
    manager.start();
    expect(callbacks.size).toBe(1);
    manager.stop();
    expect(callbacks.size).toBe(0);
    manager.reset();
    manager.start();
    expect(callbacks.size).toBe(1);
    const listener = vi.fn();
    const off = manager.onUpdate(listener);
    const done = manager.addTask(1);
    done();
    expect(listener).toHaveBeenLastCalledWith({
      ratio: 1,
      percent: 100,
      message: "",
    });
    off();
    manager.stop();
    expect(callbacks.size).toBe(0);
  });
});
