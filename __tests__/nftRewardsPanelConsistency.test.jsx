import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import NftREWARDSSection from "../src/features/rewards/Rewards/NFTRewards/NftREWARDSSection.jsx";

const WALLET = "0x1111111111111111111111111111111111111111";
const CONTRACT = "0x2222222222222222222222222222222222222222";

const commonProps = {
  walletAddress: WALLET,
  formatInteger: (value) => String(value ?? 0),
  formatAddress: (value) =>
    value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "--",
  formatUriDisplay: (value) => value || "--",
};

describe("NFT Rewards panel consistency", () => {
  it("shows the real empty on-chain state without invented rank data", () => {
    const { container } = render(
      <NftREWARDSSection
        {...commonProps}
        data={{
          contractAddress: CONTRACT,
          events: [],
          rewards: [],
          userRewards: [],
          totalEventsCreated: 0,
          totalRewardsCreated: 0,
        }}
      />,
    );

    expect(
      screen.getByText("No NFT reward event has been created yet."),
    ).toBeTruthy();
    expect(screen.getByText("No reward record exists yet.")).toBeTruthy();
    expect(container.textContent).not.toContain("Leaderboard");
    expect(container.textContent).not.toContain("Block 10");
  });

  it("offers claim only for a real wallet assignment", () => {
    const onClaimReward = vi.fn();
    const reward = {
      rewardId: 1,
      eventId: 1,
      kind: 2,
      assigned: WALLET,
      isClaimed: false,
      uri: "ipfs://reward/1",
    };
    render(
      <NftREWARDSSection
        {...commonProps}
        canClaim
        onClaimReward={onClaimReward}
        data={{
          contractAddress: CONTRACT,
          events: [
            {
              eventId: 1,
              kind: 2,
              rewardStartId: 1,
              rewardCount: 1,
              eligibleCount: 0,
              randomnessRequested: false,
              finished: false,
              vrfRequestId: 0n,
            },
          ],
          rewards: [reward],
          userRewards: [reward],
          totalEventsCreated: 1,
          totalRewardsCreated: 1,
          totalClaimed: 0,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Claim NFT" }));
    expect(onClaimReward).toHaveBeenCalledWith(1);
    expect(screen.getAllByText("Manual").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Assigned").length).toBeGreaterThan(0);
  });
});
