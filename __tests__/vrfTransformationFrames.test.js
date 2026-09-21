import { describe, expect, it } from "vitest";

import {
  VRF_TRANSFORMATION_FRAMES,
  deriveVrfUiStage,
  getVrfStageProgress,
} from "../src/ACTIONBUTTONS/REDEEMTICKET/vrfTransformationFrames.js";

describe("VRF transformation presentation state", () => {
  it("keeps the frame list ordered and configurable in one place", () => {
    expect(VRF_TRANSFORMATION_FRAMES).toHaveLength(8);
    expect(VRF_TRANSFORMATION_FRAMES[0]).toBe(
      "/vrf-transformation/frame-01.png",
    );
    expect(VRF_TRANSFORMATION_FRAMES.at(-1)).toBe(
      "/vrf-transformation/frame-08.png",
    );
  });

  it("maps wallet, confirmation and VRF states without time-based fulfillment", () => {
    expect(deriveVrfUiStage({ isRedeeming: true, txStage: "wallet" })).toBe(
      "burning",
    );
    expect(deriveVrfUiStage({ isRedeeming: true, txStage: "pending" })).toBe(
      "confirming",
    );
    expect(deriveVrfUiStage({ vrfPending: true })).toBe("requesting_vrf");
    expect(
      deriveVrfUiStage({ vrfPending: true, requestId: "928374" }),
    ).toBe("waiting_vrf");
    expect(getVrfStageProgress("waiting_vrf")).toBe(78);
  });

  it("does not complete until a real fulfillment and selected NFT are ready", () => {
    const fulfillment = { requestId: "92", tokenId: "17" };
    expect(deriveVrfUiStage({ fulfillment })).toBe("revealing");
    expect(
      deriveVrfUiStage({
        fulfillment,
        revealComplete: true,
        selectedNftReady: false,
      }),
    ).toBe("revealing");
    expect(
      deriveVrfUiStage({
        fulfillment,
        revealComplete: true,
        selectedNftReady: true,
      }),
    ).toBe("complete");
  });

  it("surfaces errors ahead of visual progress", () => {
    expect(
      deriveVrfUiStage({
        vrfPending: true,
        requestId: "92",
        error: "Redeem reverted",
      }),
    ).toBe("error");
  });
});
