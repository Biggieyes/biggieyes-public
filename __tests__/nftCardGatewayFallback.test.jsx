import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NftCard from "../src/components/NftCard.jsx";
import {
  GWS,
  addIpfsGateway,
  getIpfsGatewayCandidates,
} from "../src/shared/services/ipfs.js";

vi.mock("../src/providers/ContractsProvider", () => ({
  useOptionalContracts: () => null,
}));

const originalGateways = [...GWS];
const imagePath = "/ipfs/QmCaseSensitive/Biggi_1_ORANGE_O.png";
const initialImage = `https://source.example${imagePath}`;
const ticket = {
  tokenId: "3",
  isTicket: true,
  chapterId: 1,
  image: initialImage,
  meta: { name: "Original ticket", image: initialImage },
};

afterEach(() => GWS.splice(0, GWS.length, ...originalGateways));

describe("NFT card gateway fallback", () => {
  it("uses the shared custom gateway without guessing another file extension", () => {
    addIpfsGateway("https://custom.example");
    render(<NftCard nft={ticket} />);
    const image = screen.getByRole("img", { name: "Original ticket" });
    expect(image).toHaveAttribute("src", initialImage);
    fireEvent.error(image);
    expect(image).toHaveAttribute("src", `https://custom.example${imagePath}`);
    expect(ticket.meta.image).toBe(initialImage);
  });

  it("tries each exact-path candidate once then shows the existing placeholder", () => {
    render(<NftCard nft={ticket} />);
    const image = screen.getByRole("img", { name: "Original ticket" });
    const candidates = getIpfsGatewayCandidates(initialImage);
    for (const expected of candidates) {
      expect(image).toHaveAttribute("src", expected);
      expect(new URL(expected).pathname).toBe(imagePath);
      fireEvent.error(image);
    }
    expect(image).toHaveAttribute("src", "/images/Biggi.png");
    expect(ticket.meta.image).toBe(initialImage);
  });
});
