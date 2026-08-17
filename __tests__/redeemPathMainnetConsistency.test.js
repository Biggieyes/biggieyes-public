import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readAbi(relativePath) {
  return JSON.parse(readText(relativePath).replace(/^\uFEFF/, ""));
}

function functionNames(abi) {
  return new Set(
    abi
      .filter((entry) => entry?.type === "function")
      .map((entry) => entry.name),
  );
}

describe("mainnet redeem path consistency", () => {
  it("keeps frontend redeem writes on TicketHub and not legacy MAIN redeem", () => {
    const runtimeFiles = [
      "src/app/AppCore.jsx",
      "src/providers/VrfProvider.jsx",
      "src/common/hooks/useNFTs.js",
      "public-repo/src/app/AppCore.jsx",
      "public-repo/src/providers/VrfProvider.jsx",
      "public-repo/src/common/hooks/useNFTs.js",
    ];
    const runtimeSource = runtimeFiles.map(readText).join("\n");

    expect(runtimeSource).toContain("getTicketHub");
    expect(runtimeSource).toContain("redeemTicket");
    expect(runtimeSource).toContain("getReadOnlyTicketHub");
    expect(runtimeSource).not.toContain("redeemTicketAndMintNFT");
    expect(runtimeSource).not.toContain(
      "Redeem function not available on MAIN contract",
    );
  });

  it("keeps ticket mint helpers on the central TicketHub", () => {
    const runtimeFiles = [
      "src/app/AppCore.jsx",
      "src/common/hooks/useNFTs.js",
      "src/lib/mintAuto.js",
      "src/ACTIONBUTTONS/MINTTICKET/mintAuto.js",
      "public-repo/src/app/AppCore.jsx",
      "public-repo/src/common/hooks/useNFTs.js",
      "public-repo/src/lib/mintAuto.js",
      "public-repo/src/ACTIONBUTTONS/MINTTICKET/mintAuto.js",
    ];
    const runtimeSource = runtimeFiles.map(readText).join("\n");

    expect(runtimeSource).toContain("getTicketHub");
    expect(runtimeSource).toContain("resolveActiveTicketChapterId");
    expect(runtimeSource).toContain("mintTicketForChapter");
    expect(runtimeSource).not.toMatch(/\.mintTicket\s*\(/);
    expect(runtimeSource).not.toMatch(
      /await\s+getMainRW\(\)[\s\S]{0,500}mintTicket/,
    );
  });

  it("exposes the correct ABI functions for TicketHub -> Main VRF redeem", () => {
    const ticketHubFunctions = functionNames(
      readAbi("src/config/abi/BiggiTicketHub.json"),
    );
    const mainFunctions = functionNames(
      readAbi("src/config/abi/BiggiMain.json"),
    );

    expect(ticketHubFunctions.has("redeemTicket")).toBe(true);
    expect(ticketHubFunctions.has("ownerOf")).toBe(true);
    expect(ticketHubFunctions.has("paused")).toBe(true);
    expect(mainFunctions.has("redeemFromTicketHub")).toBe(true);
    expect(mainFunctions.has("pendingMintRequest")).toBe(true);
    expect(mainFunctions.has("pendingTicketId")).toBe(true);
    expect(mainFunctions.has("redeemTicketAndMintNFT")).toBe(false);
  });
});
