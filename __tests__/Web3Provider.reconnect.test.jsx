import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

const mocks = vi.hoisted(() => {
  const address = "0x1234567890123456789012345678901234567890";
  const roProvider = { kind: "read-only" };
  const signer = {
    getAddress: vi.fn().mockResolvedValue(address),
  };
  const browserProviderInstance = {
    getSigner: vi.fn().mockResolvedValue(signer),
    getNetwork: vi.fn().mockResolvedValue({ chainId: 137n }),
  };

  return {
    address,
    roProvider,
    signer,
    browserProviderInstance,
    BrowserProvider: vi
      .fn()
      .mockImplementation(function BrowserProviderMock() {
        return browserProviderInstance;
      }),
    clearInjectedProvider: vi.fn(),
    ensurePolygon: vi.fn().mockResolvedValue(undefined),
    getInjectedProvider: vi.fn().mockReturnValue(null),
    getROProvider: vi.fn().mockReturnValue(roProvider),
    hasInjectedProviderOverride: vi.fn().mockReturnValue(false),
    setInjectedProvider: vi.fn(),
    syncPolygonRpcIfNeeded: vi.fn().mockResolvedValue(undefined),
    getInjectedProviderCandidates: vi.fn().mockReturnValue([]),
    isMetaMaskExtensionMissingError: vi.fn().mockReturnValue(false),
    isLikelyMetaMaskSdkProvider: vi.fn().mockReturnValue(false),
    requestInjectedAccounts: vi.fn(async (provider) =>
      provider.request({ method: "eth_requestAccounts" }),
    ),
    startInjectedProviderDiscovery: vi.fn(),
    getWalletConnectMobileLinks: vi.fn().mockReturnValue(["metamask"]),
    shouldUseMetaMaskMobileFallback: vi.fn().mockReturnValue(false),
    clearWalletConnectSession: vi.fn().mockResolvedValue(false),
    connectWithWalletConnect: vi.fn(),
    restoreWalletConnectSession: vi.fn().mockResolvedValue(null),
  };
});

vi.mock("ethers", () => ({
  BrowserProvider: mocks.BrowserProvider,
}));

vi.mock("@/shared/utils/contract", () => ({
  ACTIVE_CHAIN: { chainId: 137, hex: "0x89" },
  clearInjectedProvider: mocks.clearInjectedProvider,
  ensurePolygon: mocks.ensurePolygon,
  getInjectedProvider: mocks.getInjectedProvider,
  getROProvider: mocks.getROProvider,
  hasInjectedProviderOverride: mocks.hasInjectedProviderOverride,
  setInjectedProvider: mocks.setInjectedProvider,
  syncPolygonRpcIfNeeded: mocks.syncPolygonRpcIfNeeded,
}));

vi.mock("@/shared/utils/injectedProviders", () => ({
  getInjectedProviderCandidates: mocks.getInjectedProviderCandidates,
  isMetaMaskExtensionMissingError: mocks.isMetaMaskExtensionMissingError,
  isLikelyMetaMaskSdkProvider: mocks.isLikelyMetaMaskSdkProvider,
  requestInjectedAccounts: mocks.requestInjectedAccounts,
  startInjectedProviderDiscovery: mocks.startInjectedProviderDiscovery,
}));

vi.mock("@/shared/utils/mobileWallet", () => ({
  getWalletConnectMobileLinks: mocks.getWalletConnectMobileLinks,
  shouldUseMetaMaskMobileFallback: mocks.shouldUseMetaMaskMobileFallback,
}));

vi.mock("@/wallet/wc.js", () => ({
  clearWalletConnectSession: mocks.clearWalletConnectSession,
  connectWithWalletConnect: mocks.connectWithWalletConnect,
  restoreWalletConnectSession: mocks.restoreWalletConnectSession,
}));

import { Web3Provider, useWeb3 } from "../src/providers/Web3Provider.jsx";

function Probe() {
  const { account, connectMetaMask, provider } = useWeb3();

  return (
    <div>
      <div data-testid="account">{account || "empty"}</div>
      <div data-testid="provider-kind">{provider?.kind || "wallet"}</div>
      <button type="button" onClick={() => connectMetaMask()}>
        connect
      </button>
    </div>
  );
}

describe("Web3Provider reconnect policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.getInjectedProvider.mockReturnValue(null);
    mocks.getROProvider.mockReturnValue(mocks.roProvider);
    mocks.hasInjectedProviderOverride.mockReturnValue(false);
    mocks.getInjectedProviderCandidates.mockReturnValue([]);
    mocks.shouldUseMetaMaskMobileFallback.mockReturnValue(false);
    mocks.isMetaMaskExtensionMissingError.mockReturnValue(false);
    mocks.isLikelyMetaMaskSdkProvider.mockReturnValue(false);
    mocks.restoreWalletConnectSession.mockResolvedValue(null);
    mocks.BrowserProvider.mockImplementation(function BrowserProviderMock() {
      return mocks.browserProviderInstance;
    });
    mocks.browserProviderInstance.getSigner.mockResolvedValue(mocks.signer);
    mocks.browserProviderInstance.getNetwork.mockResolvedValue({ chainId: 137n });
  });

  it("does not silently reconnect an injected wallet on mount", async () => {
    const injected = {
      isMetaMask: true,
      request: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    };

    mocks.getInjectedProviderCandidates.mockReturnValue([injected]);

    render(
      <Web3Provider>
        <Probe />
      </Web3Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("account")).toHaveTextContent("empty");
    });

    expect(screen.getByTestId("provider-kind")).toHaveTextContent("read-only");
    expect(mocks.getROProvider).toHaveBeenCalled();
    expect(mocks.BrowserProvider).not.toHaveBeenCalled();
    expect(mocks.browserProviderInstance.getSigner).not.toHaveBeenCalled();
  });

  it("connects only after an explicit user action", async () => {
    const injected = {
      isMetaMask: true,
      request: vi.fn(async ({ method }) => {
        if (method === "eth_requestAccounts") return [mocks.address];
        if (method === "eth_chainId") return "0x89";
        return null;
      }),
      on: vi.fn(),
      removeListener: vi.fn(),
    };

    mocks.getInjectedProviderCandidates.mockReturnValue([injected]);

    render(
      <Web3Provider>
        <Probe />
      </Web3Provider>,
    );

    await userEvent.click(screen.getByRole("button", { name: /connect/i }));

    await waitFor(() => {
      expect(screen.getByTestId("account")).toHaveTextContent(mocks.address);
    });

    expect(injected.request).toHaveBeenCalledWith({
      method: "eth_requestAccounts",
    });
    expect(mocks.requestInjectedAccounts).toHaveBeenCalledWith(injected, {
      forceSelection: true,
    });
    expect(mocks.setInjectedProvider).toHaveBeenCalledWith(injected);
    expect(mocks.syncPolygonRpcIfNeeded).not.toHaveBeenCalled();
    expect(mocks.BrowserProvider).toHaveBeenCalledTimes(1);
    expect(mocks.browserProviderInstance.getSigner).toHaveBeenCalled();
  });

  it("does not open WalletConnect from the MetaMask action", async () => {
    mocks.getInjectedProviderCandidates.mockReturnValue([]);
    mocks.shouldUseMetaMaskMobileFallback.mockReturnValue(true);

    render(
      <Web3Provider>
        <Probe />
      </Web3Provider>,
    );

    await userEvent.click(screen.getByRole("button", { name: /connect/i }));

    await waitFor(() => {
      expect(screen.getByTestId("account")).toHaveTextContent("empty");
    });

    expect(mocks.connectWithWalletConnect).not.toHaveBeenCalled();
    expect(mocks.setInjectedProvider).not.toHaveBeenCalled();
  });

  it("restores a persisted WalletConnect session on mount", async () => {
    const restoredProvider = {
      request: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    };
    const restoredEthersProvider = { kind: "walletconnect" };

    window.localStorage.setItem("biggi_walletconnect_resume_v1", "1");
    mocks.restoreWalletConnectSession.mockResolvedValue({
      provider: restoredProvider,
      ethersProvider: restoredEthersProvider,
      signer: mocks.signer,
      address: mocks.address,
      chainId: 137,
    });

    render(
      <Web3Provider>
        <Probe />
      </Web3Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("account")).toHaveTextContent(mocks.address);
    });

    expect(mocks.restoreWalletConnectSession).toHaveBeenCalledTimes(1);
    expect(mocks.setInjectedProvider).toHaveBeenCalledWith(restoredProvider);
    expect(screen.getByTestId("provider-kind")).toHaveTextContent(
      "walletconnect",
    );
  });

  it("treats an injected provider override as an explicit connection", async () => {
    const injected = {
      isMetaMask: true,
      request: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    };

    mocks.hasInjectedProviderOverride.mockReturnValue(true);
    mocks.getInjectedProviderCandidates.mockReturnValue([injected]);

    render(
      <Web3Provider>
        <Probe />
      </Web3Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("account")).toHaveTextContent(mocks.address);
    });

    expect(mocks.BrowserProvider).toHaveBeenCalledTimes(1);
    expect(mocks.browserProviderInstance.getSigner).toHaveBeenCalled();
  });
});
