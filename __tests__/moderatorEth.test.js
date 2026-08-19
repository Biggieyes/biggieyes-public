import { describe, expect, it, vi } from "vitest";

import { getConfig, readSlotInfo } from "../src/shared/utils/eth.js";
import { ADDR } from "../src/shared/utils/addresses.js";

describe("Moderator Center mainnet config", () => {
  it("uses the deployed mainnet moderator contract and filtered RPC config", () => {
    const cfg = getConfig();

    expect(cfg.contractAddress).toBe(ADDR.BIGGI_MODERATOR_CENTER);
    expect(cfg.ownerAddress).toBe(ADDR.OWNER);
    expect(cfg.chainRpc).toMatch(/^https?:\/\//);
    expect(cfg.chainRpc).not.toContain("polygon-rpc.com");
    expect(cfg.abiReady).toBe(true);
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
