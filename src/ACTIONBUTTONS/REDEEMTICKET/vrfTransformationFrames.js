export const VRF_TRANSFORMATION_FRAMES = Object.freeze(
  Array.from(
    { length: 8 },
    (_, index) =>
      `/vrf-transformation/frame-${String(index + 1).padStart(2, "0")}.png`,
  ),
);

export const VRF_FRAME_SEQUENCES = Object.freeze({
  burning: Object.freeze({ frames: [0, 1], durationMs: 520, loop: false }),
  confirming: Object.freeze({ frames: [1, 2, 3], durationMs: 440, loop: false }),
  requesting_vrf: Object.freeze({
    frames: [2, 3, 4],
    durationMs: 420,
    loop: false,
  }),
  waiting_vrf: Object.freeze({
    frames: [3, 4, 5, 4],
    durationMs: 480,
    loop: true,
  }),
  revealing: Object.freeze({ frames: [5, 6, 7], durationMs: 390, loop: false }),
  flash_hold: Object.freeze({ frames: [7], durationMs: 400, loop: false }),
  error: Object.freeze({ frames: [0], durationMs: 500, loop: false }),
});

export const VRF_STEPS = Object.freeze([
  "Ticket Burned",
  "Transaction Confirmed",
  "Requesting VRF",
  "Awaiting Fulfillment",
  "Reveal NFT",
]);

export function deriveVrfUiStage({
  isRedeeming = false,
  vrfPending = false,
  txStage = "",
  requestId = "",
  fulfillment = null,
  revealComplete = false,
  selectedNftReady = false,
  error = "",
} = {}) {
  if (error) return "error";
  if (fulfillment) {
    return revealComplete && selectedNftReady ? "complete" : "revealing";
  }
  if (vrfPending) {
    return requestId && requestId !== "0" ? "waiting_vrf" : "requesting_vrf";
  }
  if (isRedeeming) {
    return String(txStage).toLowerCase() === "pending"
      ? "confirming"
      : "burning";
  }
  return "idle";
}

export function getVrfStageProgress(stage) {
  const values = {
    idle: 0,
    burning: 15,
    confirming: 38,
    requesting_vrf: 58,
    waiting_vrf: 78,
    revealing: 100,
    complete: 100,
    error: 0,
  };
  return values[stage] ?? 0;
}

export function getVrfActiveStep(stage) {
  const values = {
    burning: 0,
    confirming: 1,
    requesting_vrf: 2,
    waiting_vrf: 3,
    revealing: 4,
    complete: 5,
    error: 0,
  };
  return values[stage] ?? 0;
}
