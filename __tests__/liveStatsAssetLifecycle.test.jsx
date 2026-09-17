import * as React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseEther } from "ethers";
import LiveStats from "../src/components/LiveStats.jsx";
import { DEFAULT_BLOCKS } from "../src/shared/blocks";

const mocks = vi.hoisted(() => ({
  contracts: new Map(),
  main: null,
  tokenURI: vi.fn(),
  readJson: vi.fn(),
  resolveImage: vi.fn(),
}));

vi.mock("ethers", async (importOriginal) => ({
  ...(await importOriginal()),
  Contract: vi.fn(function (address) {
    return mocks.contracts.get(address) || { tokenURI: mocks.tokenURI };
  }),
}));
vi.mock("@/shared/utils/contract", () => ({
  ADDR: {},
  getROProvider: () => ({}),
  getReaderRO: () => null,
  getReadOnlyMain: () => mocks.main,
  getReadOnlyChapterMain: () => mocks.main,
  getReadOnlyChapterMain2: () => mocks.main,
  getTokenREWARDSRO: () => null,
  getDistributorRO: () => null,
  getReadOnlyLiquidityContract: () => null,
  getTokenRO: () => null,
  getPairRO: () => null,
  getInjectedProvider: () => null,
  resetROProvider: vi.fn(),
}));
vi.mock("@/shared/services/ipfs", async (importOriginal) => ({
  ...(await importOriginal()),
  readJsonFromURI: mocks.readJson,
  resolveImageUrl: mocks.resolveImage,
}));
vi.mock("@/shared/utils/metadata", () => ({ getCachedPriceAttrs: () => null }));
vi.mock("../src/hooks/useWeeklyCountdown", () => ({
  default: () => ({ displayed: null, syncWeeklyInfo: vi.fn() }),
}));

const MAIN_A = "0x1111111111111111111111111111111111111111";
const MAIN_B = "0x2222222222222222222222222222222222222222";
const props = {
  biggiMinted: 12,
  maxSupply: 550,
  ticketMinted: 50,
  maxTickets: 550,
  ticketPrice: 500,
  blockNames: DEFAULT_BLOCKS,
  lastBlockName: "ORANGE",
  lastBackgroundName: "ORANGE",
  lastContractAddress: MAIN_A,
};
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const image = () => screen.getByRole("img", { name: "Last Minted NFT" });
const nftCard = (container) =>
  within(container.querySelector(".ls-summary-card--nft"));
const prices = (block, final) => [
  parseEther("500"),
  parseEther(block),
  parseEther(final),
];
const pol = (value) =>
  `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} POL`;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.contracts.clear();
  mocks.main = null;
  mocks.tokenURI.mockResolvedValue(null);
  mocks.readJson.mockImplementation(async (uri) => ({ image: `${uri}.png` }));
  mocks.resolveImage.mockImplementation(async (field) => field);
  localStorage.clear();
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

describe("LiveStats asset image lifecycle", () => {
  it("reads tokenURI with the numeric token ID and uses its exact metadata image", async () => {
    mocks.tokenURI.mockResolvedValue(
      "https://metadata.example/CaseSensitive/1001.json",
    );
    render(<LiveStats {...props} lastNftId="1001" />);
    await act(async () => {});
    expect(mocks.tokenURI).toHaveBeenCalledWith("1001");
    expect(image()).toHaveAttribute(
      "src",
      "https://metadata.example/CaseSensitive/1001.json.png",
    );
    expect(mocks.tokenURI).toHaveBeenCalledTimes(1);
  });

  it("does not request metadata again when a direct image is available", async () => {
    render(
      <LiveStats {...props} lastNftId="1002" lastImage="/direct-1002.png" />,
    );
    await act(async () => {});
    expect(mocks.tokenURI).not.toHaveBeenCalled();
    expect(image()).toHaveAttribute("src", "/direct-1002.png");
  });

  it("ignores a late tokenURI response from a previous contract with the same token ID", async () => {
    const old = deferred();
    const current = deferred();
    const readA = vi.fn(() => old.promise);
    const readB = vi.fn(() => current.promise);
    mocks.contracts.set(MAIN_A, { tokenURI: readA });
    mocks.contracts.set(MAIN_B, { tokenURI: readB });
    const { rerender } = render(<LiveStats {...props} lastNftId="1003" />);
    rerender(
      <LiveStats {...props} lastNftId="1003" lastContractAddress={MAIN_B} />,
    );
    await act(async () => {
      current.resolve("https://metadata.example/new");
    });
    await act(async () => {
      old.resolve("https://metadata.example/old");
    });
    expect(readA).toHaveBeenCalledWith("1003");
    expect(readB).toHaveBeenCalledWith("1003");
    expect(image()).toHaveAttribute("src", "https://metadata.example/new.png");
    expect(mocks.readJson).not.toHaveBeenCalledWith(
      "https://metadata.example/old",
    );
  });

  it("does not cache the previous resolved image under a newly selected contract", async () => {
    mocks.tokenURI.mockResolvedValueOnce("https://metadata.example/old-1004");
    const { rerender } = render(<LiveStats {...props} lastNftId="1004" />);
    await act(async () => {});
    expect(image()).toHaveAttribute(
      "src",
      "https://metadata.example/old-1004.png",
    );
    mocks.tokenURI.mockReturnValue(new Promise(() => {}));
    rerender(
      <LiveStats {...props} lastNftId="1004" lastContractAddress={MAIN_B} />,
    );
    expect(image()).not.toHaveAttribute(
      "src",
      "https://metadata.example/old-1004.png",
    );
    const cachedForNew = Object.keys(localStorage).filter((key) =>
      key.endsWith(`${MAIN_B}:1004`),
    );
    for (const key of cachedForNew) {
      expect(localStorage.getItem(key)).not.toContain("old-1004");
    }
  });

  it("discards a metadata resolution after unmount, including StrictMode cleanup", async () => {
    const old = deferred();
    mocks.tokenURI.mockReturnValue(old.promise);
    const { unmount } = render(
      <React.StrictMode>
        <LiveStats {...props} lastNftId="1005" />
      </React.StrictMode>,
    );
    expect(mocks.tokenURI).toHaveBeenCalledTimes(2);
    unmount();
    await act(async () => {
      old.resolve("https://metadata.example/unmounted");
    });
    expect(mocks.readJson).not.toHaveBeenCalled();
    expect(
      Object.values(localStorage).some((value) => value.includes("unmounted")),
    ).toBe(false);
  });

  it("handles a rejected metadata RPC without an unhandled promise or extra reads", async () => {
    mocks.tokenURI.mockRejectedValue(new Error("RPC unavailable"));
    render(<LiveStats {...props} lastNftId="1006" />);
    await act(async () => {});
    expect(mocks.tokenURI).toHaveBeenCalledTimes(1);
    expect(mocks.readJson).not.toHaveBeenCalled();
    expect(image()).toBeInTheDocument();
  });

  it("advances through fallback images once without cycling back to a failed cached URL", () => {
    render(
      <LiveStats
        {...props}
        lastNftId="1007"
        lastImage="https://images.example/1007.png"
      />,
    );
    fireEvent.error(image());
    expect(image().getAttribute("src")).toContain("/Biggi_1007_ORANGE_O.png");
    const remote = image().getAttribute("src");
    fireEvent.error(image());
    const local = image().getAttribute("src");
    expect(local).not.toBe(remote);
    expect(local).toContain("Biggi_1007_ORANGE_O.png");
    fireEvent.error(image());
    expect(image()).toHaveAttribute("src", local);
  });

  it("bounds retries for a single IPFS image to two attempts", async () => {
    vi.useFakeTimers();
    render(
      <LiveStats
        {...props}
        lastNftId="1008"
        lastBlockName="-"
        lastBackgroundName="-"
        lastImage="https://images.example/ipfs/ExactCid/1008.png"
      />,
    );
    fireEvent.error(image());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });
    expect(image().getAttribute("src")).toMatch(/1008\.png\?r=\d+$/);
    const firstRetry = image().getAttribute("src");
    fireEvent.error(image());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });
    const secondRetry = image().getAttribute("src");
    expect(secondRetry).not.toBe(firstRetry);
    fireEvent.error(image());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(image()).toHaveAttribute("src", secondRetry);
  });

  it("replaces the image element when the contract changes even if token ID and URL are equal", () => {
    const shared = {
      ...props,
      lastNftId: "1009",
      lastImage: "/shared-preview.png",
    };
    const { rerender } = render(<LiveStats {...shared} />);
    const previousImage = image();
    rerender(<LiveStats {...shared} lastContractAddress={MAIN_B} />);
    expect(image()).not.toBe(previousImage);
    fireEvent.load(previousImage);
    expect(image()).toHaveAttribute("src", "/shared-preview.png");
  });

  it("preserves case-sensitive image paths when updated for the same NFT", () => {
    const shared = { ...props, lastNftId: "1013" };
    const { rerender } = render(
      <LiveStats {...shared} lastImage="https://images.example/Art.PNG" />,
    );
    fireEvent.load(image());
    rerender(
      <LiveStats {...shared} lastImage="https://images.example/art.png" />,
    );
    expect(image()).toHaveAttribute("src", "https://images.example/art.png");
  });

  it("does not apply an old retry timer to a newly selected contract", async () => {
    vi.useFakeTimers();
    const shared = {
      ...props,
      lastNftId: "1014",
      lastBlockName: "-",
      lastBackgroundName: "-",
      lastImage: "https://images.example/ipfs/ExactCid/shared.png",
    };
    const { rerender } = render(<LiveStats {...shared} />);
    fireEvent.error(image());
    rerender(<LiveStats {...shared} lastContractAddress={MAIN_B} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(image()).toHaveAttribute("src", shared.lastImage);
  });

  it("ignores late image resolution after switching to a direct image for another NFT", async () => {
    const old = deferred();
    mocks.tokenURI.mockResolvedValue("https://metadata.example/1015");
    mocks.resolveImage.mockReturnValue(old.promise);
    const { rerender } = render(<LiveStats {...props} lastNftId="1015" />);
    await act(async () => {});
    expect(mocks.resolveImage).toHaveBeenCalledTimes(1);
    rerender(
      <LiveStats {...props} lastNftId="1016" lastImage="/new-nft.png" />,
    );
    await act(async () => {
      old.resolve("/old-nft.png");
    });
    expect(image()).toHaveAttribute("src", "/new-nft.png");
  });
});

describe("LiveStats last mint price lifecycle", () => {
  it("hides a previous NFT's prices while the new contract's prices are pending", async () => {
    const current = deferred();
    const getMintData = vi
      .fn()
      .mockResolvedValueOnce(prices("120", "123.45"))
      .mockReturnValue(current.promise);
    mocks.main = { getMintData };
    const shared = { ...props, lastNftId: "1010", lastImage: "/prices.png" };
    const { container, rerender } = render(<LiveStats {...shared} />);
    await act(async () => {});
    expect(nftCard(container).getByText(pol(123.45))).toBeInTheDocument();
    rerender(<LiveStats {...shared} lastContractAddress={MAIN_B} />);
    expect(nftCard(container).queryByText(pol(123.45))).not.toBeInTheDocument();
    await act(async () => {
      current.resolve(prices("670", "678.9"));
    });
    expect(nftCard(container).getByText(pol(678.9))).toBeInTheDocument();
  });

  it("does not let an older mint-price response overwrite the current NFT", async () => {
    const old = deferred();
    mocks.main = {
      getMintData: vi
        .fn()
        .mockReturnValueOnce(old.promise)
        .mockResolvedValue(prices("220", "234.56")),
    };
    const { container, rerender } = render(
      <LiveStats {...props} lastNftId="1011" lastImage="/prices-old.png" />,
    );
    rerender(
      <LiveStats {...props} lastNftId="1012" lastImage="/prices-new.png" />,
    );
    await act(async () => {});
    await act(async () => {
      old.resolve(prices("900", "987.65"));
    });
    expect(nftCard(container).getByText(pol(234.56))).toBeInTheDocument();
    expect(nftCard(container).queryByText(pol(987.65))).not.toBeInTheDocument();
  });

  it("recomputes the mint-data index when the supplied collection capacity changes", async () => {
    const getMintData = vi.fn().mockResolvedValue(prices("120", "123.45"));
    mocks.main = { getMintData };
    const shared = {
      ...props,
      lastNftId: "1120",
      lastImage: "/prices-capacity.png",
    };
    const { rerender } = render(<LiveStats {...shared} />);
    await act(async () => {});
    expect(getMintData).toHaveBeenLastCalledWith(120n);
    rerender(<LiveStats {...shared} maxSupply={100} />);
    await act(async () => {});
    expect(getMintData).toHaveBeenLastCalledWith(1120n);
  });
});
