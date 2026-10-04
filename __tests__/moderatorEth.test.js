import { describe, expect, it, vi } from "vitest";

import {
  getConfig,
  getLegacyModeratorCenterContract,
  readSlotInfo,
} from "../src/shared/utils/eth.js";
import { ADDR } from "../src/shared/utils/addresses.js";
import { getContractMeta } from "../src/config/contracts/index.js";

describe("Moderator Center mainnet config", () => {
  it("uses the deployed mainnet moderator contract and filtered RPC config", () => {
    const cfg = getConfig();

    expect(cfg.contractAddress).toBe(ADDR.MODERATOR_CENTER_V2);
    expect(cfg.v2ContractAddress).toBe(ADDR.MODERATOR_CENTER_V2);
    expect(cfg.legacyContractAddress).toBe(ADDR.MODERATOR_CENTER_V1);
    expect(ADDR.MODERATOR_CENTER).toBe(ADDR.MODERATOR_CENTER_V2);
    expect(cfg.ownerAddress).toBe(ADDR.OWNER);
    expect(cfg.chainRpc).toMatch(/^https?:\/\//);
    expect(cfg.chainRpc).not.toContain("polygon-rpc.com");
    expect(cfg.abiReady).toBe(true);
  });

  it("resolves the canonical key to V2 and exposes V1 only explicitly", () => {
    const canonical = getContractMeta(137, "MODERATOR_CENTER");
    const v2 = getContractMeta(137, "MODERATOR_CENTER_V2");
    const v1 = getContractMeta(137, "MODERATOR_CENTER_V1");

    expect(canonical.address).toBe(ADDR.MODERATOR_CENTER_V2);
    expect(canonical.abiName).toBe("ModeratorCenterV2");
    expect(v2.abiName).toBe("ModeratorCenterV2");
    expect(v1.address).toBe(ADDR.MODERATOR_CENTER_V1);
    expect(v1.abiName).toBe("ModeratorCenter");
  });

  it("blocks writes through the deprecated V1 contract helper", async () => {
    await expect(
      getLegacyModeratorCenterContract({ signer: true }),
    ).rejects.toThrow("ModeratorCenter V1 is deprecated and read-only.");
  });
});

describe("readSlotInfo", () => {
  it("merges getSlotInfo with slots mapping fields from the ModeratorCenter ABI", async () => {
    const contract = {
      getSlotInfo: vi.fn().mockResolvedValue({
        enabled: true,
        isLeader: false,
        payout: "0x1234567890123456789012345678901234567890",
        referralHash:
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        cumulativeSales: 27n,
      }),
      slots: vi.fn().mockResolvedValue({
        enabled: true,
        isLeader: false,
        payout: "0x1234567890123456789012345678901234567890",
        passwordHash:
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        referralHash:
          "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        cumulativeTicketSales: 19n,
      }),
    };

    const slotInfo = await readSlotInfo(contract, 3);

    expect(contract.getSlotInfo).toHaveBeenCalledWith(3);
    expect(contract.slots).toHaveBeenCalledWith(3);
    expect(slotInfo).toEqual({
      enabled: true,
      isLeader: false,
      payout: "0x1234567890123456789012345678901234567890",
      passwordHash:
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      referralHash:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      cumulativeSales: 27n,
    });
  });

  it("falls back to slots mapping when getSlotInfo is unavailable", async () => {
    const contract = {
      slots: vi.fn().mockResolvedValue({
        enabled: false,
        isLeader: true,
        payout: "0x9999999999999999999999999999999999999999",
        passwordHash:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        referralHash:
          "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        cumulativeTicketSales: 9n,
      }),
    };

    const slotInfo = await readSlotInfo(contract, 1);

    expect(slotInfo).toEqual({
      enabled: false,
      isLeader: true,
      payout: "0x9999999999999999999999999999999999999999",
      passwordHash:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      referralHash:
        "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      cumulativeSales: 9n,
    });
  });
});
