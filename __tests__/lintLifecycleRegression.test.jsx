import fs from "node:fs";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { parse } from "@babel/parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FullscreenPanel from "../src/shared/components/FullscreenPanel.jsx";
import RedeemOverlay from "../src/ACTIONBUTTONS/REDEEMTICKET/RedeemOverlay.jsx";

const wallet = vi.hoisted(() => ({
  request: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}));
vi.mock("@/shared/utils/contract", () => ({
  getInjectedProvider: () => wallet,
}));
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { resolve, promise };
};
beforeEach(() => {
  vi.clearAllMocks();
  wallet.request.mockResolvedValue("0x89");
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("fullscreen effect ownership", () => {
  it.each([false, true])(
    "restores the original detached node's style on close (StrictMode: %s)",
    async (strict) => {
      const wrap = (open) => {
        const node = (
          <FullscreenPanel open={open} title="Fixture">
            <button>Content</button>
          </FullscreenPanel>
        );
        return strict ? <React.StrictMode>{node}</React.StrictMode> : node;
      };
      const view = render(wrap(true));
      const root = screen.getByRole("dialog", { name: "Fixture" });
      expect(root.style.overscrollBehavior).toBe("contain");
      view.rerender(wrap(false));
      expect(root.isConnected).toBe(false);
      expect(root.style.overscrollBehavior).toBe("none");
    },
  );
});

describe("legacy redeem network label", () => {
  it("ignores an older network response after a chain change", async () => {
    const old = deferred();
    wallet.request.mockReturnValueOnce(old.promise);
    render(<RedeemOverlay open />);
    const onChain = wallet.on.mock.calls.find(
      ([event]) => event === "chainChanged",
    )[1];
    await act(async () => onChain());
    expect(screen.getByText("Polygon mainnet (137)")).toBeInTheDocument();
    await act(async () => old.resolve("0x13882"));
    expect(
      screen.queryByText("Unsupported chain (80002)"),
    ).not.toBeInTheDocument();
  });
  it("removes only its own listener on unmount", async () => {
    const old = deferred();
    wallet.request.mockReturnValueOnce(old.promise);
    const view = render(<RedeemOverlay open />);
    const onChain = wallet.on.mock.calls[0][1];
    view.unmount();
    await act(async () => old.resolve("0x89"));
    expect(wallet.removeListener).toHaveBeenCalledExactlyOnceWith(
      "chainChanged",
      onChain,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("invalidates the discarded StrictMode session", async () => {
    const old = deferred();
    wallet.request.mockReturnValueOnce(old.promise);
    render(
      <React.StrictMode>
        <RedeemOverlay open />
      </React.StrictMode>,
    );
    await act(async () => {});
    expect(screen.getByText("Polygon mainnet (137)")).toBeInTheDocument();
    await act(async () => old.resolve("0x13882"));
    expect(
      screen.queryByText("Unsupported chain (80002)"),
    ).not.toBeInTheDocument();
    expect(wallet.on).toHaveBeenCalledTimes(2);
    expect(wallet.removeListener).toHaveBeenCalledTimes(1);
  });
});

it("AppCore resume cleanup clears its original timer even if the ref has been replaced", async () => {
  vi.useFakeTimers();
  const source = fs.readFileSync("src/app/AppCore.jsx", "utf8");
  const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
  let callback;
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (
      node.type === "CallExpression" &&
      node.callee?.property?.name === "useEffect"
    ) {
      const fn = node.arguments[0];
      const text = source.slice(fn.start, fn.end);
      if (text.includes("const scheduleResumeSync")) callback = text;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  };
  visit(ast);
  expect(callback).toBeDefined();
  const original = { timer: null, inFlight: false };
  const ref = { current: original };
  const resume = vi.fn(async () => {});
  const run = new Function(
    "walletResumeSyncRef",
    "walletAddressRef",
    "walletConnectResumeAllowedRef",
    "resyncWalletAfterResume",
    "WALLET_RESUME_SYNC_DEBOUNCE_MS",
    `return (${callback});`,
  )(ref, { current: "connected" }, { current: false }, resume, 10);
  const dispose = run();
  try {
    fireEvent(window, new Event("focus"));
    ref.current = { timer: null, inFlight: false };
    dispose();
    await vi.advanceTimersByTimeAsync(20);
    expect(original.timer).toBeNull();
    expect(resume).not.toHaveBeenCalled();
  } finally {
    dispose();
  }
});
