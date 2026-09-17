import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ImportNftButton from "../src/components/ImportNftButton.tsx";
import { Web3Context } from "../src/providers/Web3Context.js";
import { addNftToMetaMask } from "../src/lib/addNftToMetaMask";

vi.mock("../src/lib/addNftToMetaMask", () => ({ addNftToMetaMask: vi.fn() }));
const CONTRACT = "0x1111111111111111111111111111111111111111";
const ACCOUNT = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const props = {
  contractAddress: CONTRACT,
  tokenId: "1001",
  ownerAddress: ACCOUNT,
};
const clickImport = () =>
  fireEvent.click(screen.getByRole("button", { name: "Import", exact: true }));
beforeEach(() => {
  vi.mocked(addNftToMetaMask).mockReset().mockResolvedValue(true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Gallery import control", () => {
  it("uses exact NFT identity and stays available for re-import", async () => {
    const onImported = vi.fn();
    render(<ImportNftButton {...props} onImported={onImported} />);
    clickImport();
    await screen.findByRole("button", { name: "Re-import" });
    expect(addNftToMetaMask).toHaveBeenCalledWith(
      expect.objectContaining({
        contractAddress: CONTRACT,
        tokenId: "1001",
        chainId: "0x89",
        expectedAccount: ACCOUNT,
      }),
    );
    expect(onImported).toHaveBeenCalledWith("1001");
    fireEvent.click(screen.getByRole("button", { name: "Re-import" }));
    await screen.findByRole("button", { name: "Re-import" });
    expect(addNftToMetaMask).toHaveBeenCalledTimes(2);
  });

  it("blocks double clicks while a prompt is open", async () => {
    let resolve;
    vi.mocked(addNftToMetaMask).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(<ImportNftButton {...props} />);
    const button = screen.getByRole("button", { name: "Import", exact: true });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(addNftToMetaMask).toHaveBeenCalledTimes(1);
    await act(async () => resolve(true));
    expect(button).toBeEnabled();
  });

  it("does not mark cancellation as imported", async () => {
    vi.mocked(addNftToMetaMask).mockResolvedValue(false);
    render(<ImportNftButton {...props} />);
    clickImport();
    await screen.findByText("Import cancelled.");
    expect(screen.queryByText("Re-import")).not.toBeInTheDocument();
  });

  it("provides copyable manual details when NFT import is unsupported", async () => {
    vi.mocked(addNftToMetaMask).mockRejectedValue({ code: 4200 });
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<ImportNftButton {...props} />);
    clickImport();
    await screen.findByText("Polygon mainnet");
    expect(screen.getByText(CONTRACT)).toBeInTheDocument();
    expect(screen.getByText("1001")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy Contract" }));
    await act(async () => {});
    expect(writeText).toHaveBeenCalledWith(CONTRACT);
  });

  it.each([
    [-32002, "An import is already pending. Check MetaMask."],
    [
      "IMPORT_ACCOUNT_MISMATCH",
      "Select the account shown in this gallery in MetaMask, then retry.",
    ],
  ])(
    "explains wallet error %s without claiming success",
    async (code, message) => {
      vi.mocked(addNftToMetaMask).mockRejectedValue({ code });
      render(<ImportNftButton {...props} />);
      clickImport();
      await screen.findByText(message);
      expect(screen.queryByText("Re-import")).not.toBeInTheDocument();
    },
  );

  it.each([
    { contractAddress: "" },
    { tokenId: null },
    { tokenId: "-1" },
    { tokenId: Number.MAX_SAFE_INTEGER + 1 },
    { chainId: 80002 },
  ])("does not import invalid identity %j", (invalid) => {
    render(<ImportNftButton {...props} {...invalid} />);
    expect(
      screen.getByRole("button", { name: "Import", exact: true }),
    ).toBeDisabled();
    clickImport();
    expect(addNftToMetaMask).not.toHaveBeenCalled();
  });

  it("discards a late success after the gallery account changes", async () => {
    let resolve;
    vi.mocked(addNftToMetaMask).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const onImported = vi.fn();
    const { rerender } = render(
      <ImportNftButton {...props} onImported={onImported} />,
    );
    clickImport();
    rerender(
      <ImportNftButton
        {...props}
        ownerAddress={CONTRACT}
        onImported={onImported}
      />,
    );
    await act(async () => resolve(true));
    expect(
      screen.getByRole("button", { name: "Import", exact: true }),
    ).toBeEnabled();
    expect(
      screen.queryByText("NFT added to MetaMask."),
    ).not.toBeInTheDocument();
    expect(onImported).not.toHaveBeenCalled();
  });

  it("reads the connected account when no explicit gallery owner is given", async () => {
    render(
      <Web3Context.Provider value={{ account: ACCOUNT }}>
        <ImportNftButton contractAddress={CONTRACT} tokenId="1001" />
      </Web3Context.Provider>,
    );
    clickImport();
    await screen.findByRole("button", { name: "Re-import" });
    expect(addNftToMetaMask).toHaveBeenCalledWith(
      expect.objectContaining({ expectedAccount: ACCOUNT }),
    );
  });
});
