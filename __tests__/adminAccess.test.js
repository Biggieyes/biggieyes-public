import { describe, expect, it, vi } from "vitest";

import {
  assertAdminSigner,
  getAdminAccessState,
  sameAdminAddress,
} from "../src/shared/utils/adminAccess.js";

const OWNER = "0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2";

describe("admin access guards", () => {
  it("enables writes only for the owner on Polygon mainnet", () => {
    expect(
      getAdminAccessState({
        walletAddress: OWNER.toLowerCase(),
        ownerAddress: OWNER,
        chainId: 137,
      }),
    ).toMatchObject({ chainMatches: true, ownerMatches: true, canWrite: true });

    expect(
      getAdminAccessState({
        walletAddress: OWNER,
        ownerAddress: OWNER,
        chainId: 1,
      }).canWrite,
    ).toBe(false);
  });

  it("rejects invalid addresses and a non-owner signer", async () => {
    expect(sameAdminAddress("not-an-address", OWNER)).toBe(false);

    const provider = {
      getNetwork: vi.fn(async () => ({ chainId: 137n })),
      getSigner: vi.fn(async () => ({
        getAddress: vi.fn(async () => "0x8fa5C9545B2eEF1ca3c6533951C286e05928f27B"),
      })),
    };

    await expect(
      assertAdminSigner({ provider, ownerAddress: OWNER }),
    ).rejects.toThrow("not the contract owner");
  });

  it("rejects a signer provider connected to a different chain", async () => {
    const provider = {
      getNetwork: vi.fn(async () => ({ chainId: 1n })),
      getSigner: vi.fn(),
    };

    await expect(
      assertAdminSigner({ provider, ownerAddress: OWNER }),
    ).rejects.toThrow("Polygon mainnet (137)");
    expect(provider.getSigner).not.toHaveBeenCalled();
  });
});
