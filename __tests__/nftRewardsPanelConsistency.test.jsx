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
  it.each([{ loading: true }, { error: new Error("RPC unavailable") }])(
    "does not present unavailable data as zero rewards (%j)",
    (state) => {
      const { container } = render(
        <NftREWARDSSection
          {...commonProps}
          {...state}
          data={{ userRewards: [], events: [], rewards: [] }}
        />,
      );
      expect(container.textContent).not.toContain("No NFT reward is assigned");
      expect(container.textContent).not.toContain("No reward record exists");
      expect(container.textContent).not.toContain(
        "No NFT reward event has been created",
      );
      expect(
        [...container.querySelectorAll(".nft-rewards__summary-value")].map(
          (el) => el.textContent,
        ),
      ).toEqual(["--", "--", "--", "--"]);
    },
  );

  it("limits empty-wallet claims to the displayed page and provides history navigation", () => {
    const onRewardPageChange = vi.fn();
    render(
      <NftREWARDSSection
        {...commonProps}
        onRewardPageChange={onRewardPageChange}
        data={{
          rewardsTruncated: true,
          rewardPage: 0,
          rewardPages: 2,
          totalRewardsCreated: 501,
          firstRewardId: 2,
          lastRewardId: 501,
        }}
      />,
    );
    expect(
      screen.getByText(
        "No NFT reward is assigned to this wallet in these records.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Older rewards" }));
    expect(onRewardPageChange).toHaveBeenCalledWith(1);
    expect(screen.getByRole("button", { name: "Newer rewards" }).disabled).toBe(
      true,
    );
  });

  it("keeps V1 manual events assigned even when their reward is on another page", () => {
    render(
      <NftREWARDSSection
        {...commonProps}
        data={{
          events: [
            {
              eventId: 1,
              kind: 2,
              rewardStartId: 1,
              rewardCount: 1,
              finished: false,
            },
          ],
          rewards: [],
        }}
      />,
    );
    expect(screen.getByText("Assigned")).toBeTruthy();
    expect(screen.queryByText("Created")).toBeNull();
  });

  it("does not mistake a completed draw for an NFT claim", () => {
    render(
      <NftREWARDSSection
        {...commonProps}
        data={{
          events: [
            {
              eventId: 1,
              kind: 3,
              rewardStartId: 1,
              rewardCount: 1,
              finished: true,
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("Draw completed")).toBeTruthy();
    expect(screen.queryByText("Claimed")).toBeNull();
  });

  it("hides another wallet's stale assignments and disables all claims during a pending transaction", () => {
    render(
      <NftREWARDSSection
        {...commonProps}
        canClaim
        claimState={1}
        data={{
          userRewards: [
            { rewardId: 1, assigned: WALLET, kind: 2 },
            { rewardId: 2, assigned: WALLET, kind: null },
            { rewardId: 3, assigned: CONTRACT, kind: 2 },
          ],
        }}
      />,
    );
    expect(screen.queryByText("Reward #3")).toBeNull();
    expect(screen.getByRole("button", { name: "Claim NFT" }).disabled).toBe(
      true,
    );
    expect(screen.getByText("Unknown")).toBeTruthy();
  });
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
