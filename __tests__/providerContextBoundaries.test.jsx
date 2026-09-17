import * as React from "react";
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Web3Provider } from "../src/providers/Web3Provider.jsx";
import { ContractsProvider } from "../src/providers/ContractsProvider.jsx";
import { REWARDSProvider } from "../src/providers/RewardsProvider.jsx";
import { VRFProvider } from "../src/providers/VrfProvider.jsx";
import { StatsProvider } from "../src/providers/StatsProvider.jsx";
import { InventoryProvider } from "../src/providers/InventoryProvider.jsx";
import {
  Web3Context,
  useWeb3,
  useOptionalWeb3,
} from "../src/providers/Web3Context.js";
import {
  ContractsContext,
  useContracts,
  useOptionalContracts,
} from "../src/providers/ContractsContext.js";
import { RewardsContext, useREWARDS } from "../src/providers/RewardsContext.js";
import { VrfContext, useVRF } from "../src/providers/VrfContext.js";
import { StatsContext, useStats } from "../src/providers/StatsContext.js";
import {
  InventoryContext,
  useInventory,
} from "../src/providers/InventoryContext.js";
import { useContracts as useUiContracts } from "../src/UI/hooks/useContracts.js";
import { useVRF as useVrfAlias } from "../src/hooks/useVRF.js";

// Isolate provider/context wiring; wallet effect behavior is covered separately
// by Web3Provider.reconnect.test.jsx. No polling or RPC is started in this test.
vi.mock("react", async (load) => ({ ...(await load()), useEffect: vi.fn() }));
const fixture = vi.hoisted(() => ({ reader: { kind: "offline-reader" } }));
vi.mock("@/shared/utils/contract", async (load) => ({
  ...(await load()),
  getROProvider: () => fixture.reader,
}));

afterEach(cleanup);

function Providers({ children }) {
  return (
    <Web3Provider>
      <ContractsProvider>
        <REWARDSProvider>
          <VRFProvider>
            <StatsProvider>
              <InventoryProvider>{children}</InventoryProvider>
            </StatsProvider>
          </VRFProvider>
        </REWARDSProvider>
      </ContractsProvider>
    </Web3Provider>
  );
}

describe("provider/context module boundaries", () => {
  it("uses the same context instances across real providers, hooks and aliases", () => {
    const { result } = renderHook(
      () => ({
        values: [
          useWeb3(),
          useContracts(),
          useREWARDS(),
          useVRF(),
          useStats(),
          useInventory(),
        ],
        contexts: [
          React.useContext(Web3Context),
          React.useContext(ContractsContext),
          React.useContext(RewardsContext),
          React.useContext(VrfContext),
          React.useContext(StatsContext),
          React.useContext(InventoryContext),
        ],
        aliases: [
          useOptionalWeb3(),
          useOptionalContracts(),
          useUiContracts(),
          useVrfAlias(),
        ],
      }),
      { wrapper: Providers },
    );
    result.current.values.forEach((value, i) => {
      expect(value).not.toBeNull();
      expect(value).toBe(result.current.contexts[i]);
    });
    const [web3, contracts, , vrf] = result.current.values;
    expect(result.current.aliases).toEqual([web3, contracts, contracts, vrf]);
    expect(web3.account).toBe("");
    expect(web3.connectMetaMask).toBeTypeOf("function");
    expect(contracts._effectiveROProvider()).toBe(fixture.reader);
    expect(vrf.requestRedeem).toBeTypeOf("function");
  });

  it("keeps optional hooks nullable outside providers", () => {
    const { result } = renderHook(() => [
      useOptionalWeb3(),
      useOptionalContracts(),
      useInventory(),
    ]);
    expect(result.current).toEqual([null, null, null]);
  });

  it.each([
    [useWeb3, "useWeb3 must be used inside <Web3Provider>"],
    [useContracts, "useContracts must be used inside <ContractsProvider>"],
    [useREWARDS, "useREWARDS must be used inside <REWARDSProvider>"],
    [useVRF, "useVRF must be used inside <VRFProvider>"],
    [useStats, "useStats must be used inside <StatsProvider>"],
  ])("keeps the missing-provider guard for %s", (hook, message) => {
    expect(() => renderHook(() => hook())).toThrow(message);
  });
});
