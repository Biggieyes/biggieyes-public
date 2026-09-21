import * as React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseEther } from "ethers";
import NftCard from "../src/components/NftCard.jsx";

const mocks = vi.hoisted(() => ({
  contracts: null,
  readJson: vi.fn(),
  resolveImage: vi.fn(),
}));
vi.mock("../src/providers/ContractsContext.js", () => ({
  useOptionalContracts: () => mocks.contracts,
}));
vi.mock("../src/components/ImportNftButton", () => ({ default: () => null }));
vi.mock("../src/shared/services/ipfs", async (importOriginal) => ({
  ...(await importOriginal()),
  readJsonFromURI: mocks.readJson,
  resolveImageUrl: mocks.resolveImage,
}));

const MAIN_A = "0x1111111111111111111111111111111111111111";
const MAIN_B = "0x2222222222222222222222222222222222222222";
const UNKNOWN = "0x3333333333333333333333333333333333333333";
const deferred = () => {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
};
const meta = (name, image = "/nft.png") => ({
  name,
  image,
  attributes: [{ trait_type: "Eye Color", value: "Orange" }],
});
const nft = (overrides = {}) => ({
  tokenId: "1001",
  contractAddress: MAIN_A,
  ...overrides,
});
const mainContract = (address) => ({
  target: address,
  tokenURI: vi.fn().mockResolvedValue(null),
  nftInfo: vi.fn().mockResolvedValue(null),
  getMintData: vi.fn().mockResolvedValue(null),
});
let mainA;
let mainB;
const cardImage = () => document.querySelector(".nft-card__image-wrap img");
const statValue = (container, label) =>
  [...container.querySelectorAll(".nft-card__stats > div")]
    .find((node) => node.querySelector("span")?.textContent === label)
    ?.querySelector("strong")?.textContent;

beforeEach(() => {
  mocks.readJson
    .mockReset()
    .mockImplementation(async (uri) => meta("Fetched NFT", `${uri}.png`));
  mocks.resolveImage.mockReset().mockImplementation(async (image) => image);
  mainA = mainContract(MAIN_A);
  mainB = mainContract(MAIN_B);
  mocks.contracts = {
    collectionReadByAddress: vi.fn((address) =>
      address?.toLowerCase() === MAIN_A
        ? mainA
        : address?.toLowerCase() === MAIN_B
          ? mainB
          : null,
    ),
    mainRead: vi.fn(() => mainA),
    main2Read: vi.fn(() => mainB),
    readerRead: vi.fn(() => null),
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("NFT card metadata lifecycle", () => {
  it("shows the exact on-chain token ID for a ticket", async () => {
    const ticketId = "1000000000000000000000000000201";
    render(
      <NftCard
        nft={nft({
          tokenId: ticketId,
          isTicket: true,
          chapterId: 2,
          meta: meta("Universe ticket"),
        })}
      />,
    );
    await act(async () => {});
    expect(screen.getByText(`Token ID #${ticketId}`)).toBeInTheDocument();
  });

  it("uses a persistent latest-mint label only for promoted NFTs", async () => {
    const asset = nft({ meta: meta("Latest NFT") });
    const { rerender } = render(<NftCard nft={asset} promoted />);
    await act(async () => {});
    expect(screen.getByText("Latest mint")).toBeInTheDocument();

    rerender(<NftCard nft={{ ...asset, isTicket: true }} promoted />);
    await act(async () => {});
    expect(screen.queryByText("Latest mint")).not.toBeInTheDocument();
  });

  it("does not overwrite a newer direct image after an old resolveImageUrl completes", async () => {
    const old = deferred();
    mainA.tokenURI.mockResolvedValue("https://metadata.example/old");
    mocks.resolveImage.mockReturnValue(old.promise);
    const { rerender } = render(<NftCard nft={nft()} />);
    await act(async () => {});
    expect(mocks.resolveImage).toHaveBeenCalledTimes(1);
    rerender(
      <NftCard
        nft={nft({ image: "/new.png", meta: meta("New NFT", "/new.png") })}
      />,
    );
    await act(async () => {
      old.resolve("/old.png");
    });
    expect(cardImage()).toHaveAttribute("src", "/new.png");
  });

  it("does not fetch JSON after the card unmounts during tokenURI", async () => {
    const old = deferred();
    mainA.tokenURI.mockReturnValue(old.promise);
    const { unmount } = render(<NftCard nft={nft()} />);
    unmount();
    await act(async () => {
      old.resolve("https://metadata.example/unmounted");
    });
    expect(mocks.readJson).not.toHaveBeenCalled();
  });

  it("resets metadata and details for equal token IDs in another contract", async () => {
    const { container, rerender } = render(
      <NftCard nft={nft({ meta: meta("Old collection") })} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show details" }));
    mainB.tokenURI.mockResolvedValue("https://metadata.example/new-collection");
    rerender(<NftCard nft={nft({ contractAddress: MAIN_B })} />);
    await act(async () => {});
    expect(container.querySelector(".nft-card__title")).toHaveTextContent(
      "Fetched NFT",
    );
    expect(
      screen.getByRole("button", { name: "Show details" }),
    ).toBeInTheDocument();
    expect(cardImage()).toHaveAttribute(
      "src",
      "https://metadata.example/new-collection.png",
    );
  });

  it("ignores an old image resolution after the read-provider context changes", async () => {
    const old = deferred();
    mainA.tokenURI.mockResolvedValue("https://metadata.example/provider-a");
    mocks.resolveImage.mockReturnValueOnce(old.promise);
    const { rerender } = render(<NftCard nft={nft()} />);
    await act(async () => {});
    mainA = mainContract(MAIN_A);
    mainA.tokenURI.mockResolvedValue("https://metadata.example/provider-b");
    mocks.contracts = { ...mocks.contracts };
    rerender(<NftCard nft={nft()} />);
    await act(async () => {});
    await act(async () => {
      old.resolve("/outdated-provider.png");
    });
    expect(cardImage()).not.toHaveAttribute("src", "/outdated-provider.png");
    expect(cardImage()).not.toHaveAttribute("src", "/images/Biggi.png");
  });

  it("fills missing metadata attributes without replacing known parent attributes", async () => {
    mainA.tokenURI.mockResolvedValue("https://metadata.example/partial");
    mocks.readJson.mockResolvedValue({
      name: "Remote name",
      image: "/remote.png",
      attributes: [
        { trait_type: "Eye Color", value: "Blue" },
        { trait_type: "Background", value: "Pink" },
      ],
    });
    const supplied = {
      name: "Known name",
      attributes: [{ trait_type: "Eye Color", value: "Orange" }],
    };
    const { rerender } = render(<NftCard nft={nft({ meta: supplied })} />);
    await act(async () => {});
    expect(
      screen.getByRole("heading", { name: "Known name" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pink")).toBeInTheDocument();
    expect(screen.getByText("Orange")).toBeInTheDocument();
    expect(supplied.attributes).toEqual([
      { trait_type: "Eye Color", value: "Orange" },
    ]);
    rerender(<NftCard nft={nft({ meta: { ...supplied } })} />);
    await act(async () => {});
    expect(screen.getByText("Pink")).toBeInTheDocument();
    expect(mainA.tokenURI).toHaveBeenCalledTimes(1);
  });

  it("uses a complete image_url metadata record without an unnecessary tokenURI read", async () => {
    const supplied = {
      name: "Image URL NFT",
      image_url: "/image-url.png",
      attributes: [{ trait_type: "Eye Color", value: "Orange" }],
    };
    render(<NftCard nft={nft({ meta: supplied })} />);
    await act(async () => {});
    expect(cardImage()).toHaveAttribute("src", "/image-url.png");
    expect(mainA.tokenURI).not.toHaveBeenCalled();
  });

  it("does not fetch a different collection when an explicit contract is unknown", async () => {
    mainA.tokenURI.mockResolvedValue(
      "https://metadata.example/wrong-collection",
    );
    render(<NftCard nft={nft({ contractAddress: UNKNOWN })} />);
    await act(async () => {});
    expect(mainA.tokenURI).not.toHaveBeenCalled();
    expect(mainA.nftInfo).not.toHaveBeenCalled();
    expect(mainA.getMintData).not.toHaveBeenCalled();
    expect(mainB.tokenURI).not.toHaveBeenCalled();
    expect(mocks.contracts.readerRead).not.toHaveBeenCalled();
  });

  it("retains the address-matched original reader fallback when the lookup helper is unavailable", async () => {
    delete mocks.contracts.collectionReadByAddress;
    mainB.tokenURI.mockResolvedValue("https://metadata.example/matching-main2");
    render(<NftCard nft={nft({ contractAddress: MAIN_B })} />);
    await act(async () => {});
    expect(mainA.tokenURI).not.toHaveBeenCalled();
    expect(mainB.tokenURI).toHaveBeenCalledWith("1001");
  });

  it("finishes metadata loading after an RPC failure without a fabricated price", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mainA.tokenURI.mockRejectedValue(new Error("RPC unavailable"));
    mainA.getMintData.mockRejectedValue(new Error("RPC unavailable"));
    const { container } = render(<NftCard nft={nft()} />);
    fireEvent.click(screen.getByRole("button", { name: "Show details" }));
    await act(async () => {});
    expect(screen.getByText("No details available.")).toBeInTheDocument();
    expect(screen.queryByText("Loading metadata...")).not.toBeInTheDocument();
    expect(statValue(container, "Final")).toBe("--");
  });

  it("ignores the first StrictMode setup and keeps the active metadata request", async () => {
    const old = deferred();
    mainA.tokenURI
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue("https://metadata.example/active");
    render(
      <React.StrictMode>
        <NftCard nft={nft()} />
      </React.StrictMode>,
    );
    await act(async () => {});
    await act(async () => {
      old.resolve("https://metadata.example/stale");
    });
    expect(mocks.readJson).toHaveBeenCalledTimes(1);
    expect(cardImage()).toHaveAttribute(
      "src",
      "https://metadata.example/active.png",
    );
  });

  it("ignores JSON completed after a different asset mounts", async () => {
    const old = deferred();
    mainA.tokenURI.mockResolvedValue("https://metadata.example/old");
    mocks.readJson.mockReturnValue(old.promise);
    const { rerender } = render(<NftCard nft={nft()} />);
    await act(async () => {});
    rerender(
      <NftCard
        nft={nft({
          tokenId: "1002",
          meta: meta("New asset", "/new-asset.png"),
        })}
      />,
    );
    await act(async () => {
      old.resolve(meta("Old asset", "/old-asset.png"));
    });
    expect(cardImage()).toHaveAttribute("src", "/new-asset.png");
    expect(mocks.resolveImage).not.toHaveBeenCalled();
  });
});

describe("NFT card price and fallback integrity", () => {
  it("does not overwrite real metadata prices with fabricated zero traits", async () => {
    mocks.contracts = null;
    const supplied = {
      name: "Priced NFT",
      image: "/priced.png",
      attributes: [
        { trait_type: "Ticket Price", value: "500 POL" },
        { trait_type: "Block Price", value: "100 POL" },
        { trait_type: "Final Price", value: "105 POL" },
      ],
    };
    render(<NftCard nft={nft({ meta: supplied })} />);
    await act(async () => {});
    expect(screen.getByText("105 POL")).toBeInTheDocument();
    expect(screen.queryByText("0.0000 POL")).not.toBeInTheDocument();
  });

  it("uses all historical mint-data fields and keeps current block price separate", async () => {
    mainA.getMintData.mockResolvedValue([
      parseEther("500"),
      parseEther("100"),
      parseEther("105"),
    ]);
    mainA.getCurrentBlockPriceByTokenId = vi
      .fn()
      .mockResolvedValue(parseEther("150"));
    const { container } = render(
      <NftCard nft={nft({ image: "/priced.png", meta: meta("Minted NFT") })} />,
    );
    await act(async () => {});
    expect(mainA.getMintData).toHaveBeenCalledWith("1");
    expect(statValue(container, "Final")).toBe("105.0 POL");
    expect(statValue(container, "Block (now)")).toBe("150.0 POL");
    expect(screen.getByText("100.0000 POL")).toBeInTheDocument();
  });

  it("does not invent historical prices from a current-only contract", async () => {
    mainA.getTicketPrice = vi.fn().mockResolvedValue(parseEther("600"));
    mainA.getCurrentBlockPriceByTokenId = vi
      .fn()
      .mockResolvedValue(parseEther("150"));
    const { container } = render(
      <NftCard nft={nft({ meta: meta("Current only") })} />,
    );
    await act(async () => {});
    expect(statValue(container, "Ticket")).toBe("--");
    expect(statValue(container, "Final")).toBe("--");
    expect(statValue(container, "Block (now)")).toBe("150.0 POL");
    expect(mainA.getTicketPrice).not.toHaveBeenCalled();
  });

  it("preserves legitimate zero block and final prices", async () => {
    mainA.getMintData.mockResolvedValue([parseEther("500"), 0n, 0n]);
    mainA.getCurrentBlockPriceByTokenId = vi.fn().mockResolvedValue(0n);
    const { container } = render(
      <NftCard nft={nft({ meta: meta("Zero prices") })} />,
    );
    await act(async () => {});
    expect(statValue(container, "Final")).toBe("0.0 POL");
    expect(statValue(container, "Block (now)")).toBe("0.0 POL");
  });

  it("does not use another collection's delayed price result", async () => {
    const old = deferred();
    mainA.getMintData.mockReturnValue(old.promise);
    const { container, rerender } = render(
      <NftCard nft={nft({ meta: meta("Old") })} />,
    );
    mainB.getMintData.mockResolvedValue([
      parseEther("600"),
      parseEther("200"),
      parseEther("210"),
    ]);
    rerender(
      <NftCard nft={nft({ contractAddress: MAIN_B, meta: meta("New") })} />,
    );
    await act(async () => {});
    await act(async () => {
      old.resolve([parseEther("500"), parseEther("100"), parseEther("105")]);
    });
    expect(statValue(container, "Final")).toBe("210.0 POL");
  });

  it("updates price inputs for the same NFT when the parent provides new mint data", async () => {
    mocks.contracts = null;
    const asset = nft({
      meta: meta("Prices"),
      mint: { ticketPrice: 5, blockPrice: 10, finalPrice: 15 },
    });
    const { container, rerender } = render(<NftCard nft={asset} />);
    rerender(
      <NftCard
        nft={{
          ...asset,
          mint: { ticketPrice: 20, blockPrice: 25, finalPrice: 30 },
        }}
      />,
    );
    await act(async () => {});
    expect(statValue(container, "Final")).toBe("30.0 POL");
    expect(screen.getByText("25.0000 POL")).toBeInTheDocument();
    expect(statValue(container, "Block (now)")).toBe("--");
  });

  it.each([{ isTicket: true }, { isPending: true }])(
    "does not read NFT mint prices for ticket/pending state %j",
    async (status) => {
      render(
        <NftCard
          nft={nft({ ...status, image: "/preview.png", meta: meta("Preview") })}
        />,
      );
      await act(async () => {});
      expect(mainA.getMintData).not.toHaveBeenCalled();
      expect(mainA.tokenURI).not.toHaveBeenCalled();
      expect(mainA.nftInfo).not.toHaveBeenCalled();
    },
  );

  it("does not label unknown rarity as Legendary", async () => {
    mocks.contracts = null;
    render(
      <NftCard
        nft={nft({ meta: { name: "Unknown traits", image: "/unknown.png" } })}
      />,
    );
    await act(async () => {});
    expect(screen.queryByText("Legendary")).not.toBeInTheDocument();
  });

  it("does not invent orange traits from an uninitialized nftInfo record", async () => {
    mainA.nftInfo.mockResolvedValue([false, 0n, 0n, 0n, 0n, 0n, 0n]);
    render(<NftCard nft={nft()} />);
    await act(async () => {});
    expect(screen.queryByText("ORANGE")).not.toBeInTheDocument();
    expect(cardImage()).toHaveAttribute("src", "/images/Biggi.png");
  });

  it("does not use a neighboring block's base URI for a missing block URI", async () => {
    mainA.nftInfo.mockResolvedValue([true, 1n, 2n, 1n, 0n, 0n, 0n]);
    mainA.blockBaseURIs = vi
      .fn()
      .mockImplementation(async (index) =>
        index === 2 ? "" : "https://images.example/wrong-block",
      );
    render(<NftCard nft={nft()} />);
    await act(async () => {});
    expect(mainA.blockBaseURIs.mock.calls.every(([index]) => index === 2)).toBe(
      true,
    );
    expect(cardImage().getAttribute("src")).not.toContain("wrong-block");
  });
});
