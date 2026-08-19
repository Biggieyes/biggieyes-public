import { describe, expect, it } from "vitest";
import { buildRows } from "../src/features/tokenomics/tabs/HistoryTab.jsx";
import { buildTimeline } from "../src/features/tokenomics/tabs/TransparencyTab.jsx";

describe("ecosystem snapshot history", () => {
  it("collapses unchanged polling samples but preserves later state changes", () => {
    const entries = [
      { tsLabel: "10:00", a: 1, b: 2 },
      { tsLabel: "10:01", a: 1, b: 2 },
      { tsLabel: "10:02", a: 3, b: 4 },
      { tsLabel: "10:03", a: 3, b: 4 },
    ];

    const rows = buildRows(entries, (entry) => ({
      label: entry.tsLabel,
      a: String(entry.a),
      b: String(entry.b),
    }));

    expect(rows).toEqual([
      { label: "10:03", a: "3", b: "4" },
      { label: "10:01", a: "1", b: "2" },
    ]);
  });

  it("deduplicates unchanged subsystem values in the transparency timeline", () => {
    const timeline = buildTimeline({
      buybackHistory: [
        {
          ts: 1,
          tsLabel: "10:00",
          BUYBACK: { totalNativeSpentNumeric: 0, totalBiggiAcquiredNumeric: 0 },
        },
        {
          ts: 2,
          tsLabel: "10:01",
          BUYBACK: { totalNativeSpentNumeric: 0, totalBiggiAcquiredNumeric: 0 },
        },
      ],
      dripHistory: [
        {
          ts: 3,
          tsLabel: "10:02",
          distributor: { availableNumeric: 5 },
          DRIPLM: { nativeBalanceNumeric: 1 },
        },
      ],
    });

    expect(timeline).toHaveLength(2);
    expect(timeline.map((row) => row.type)).toEqual(["DRIP", "BUYBACK"]);
    expect(timeline.find((row) => row.type === "BUYBACK")?.tsLabel).toBe(
      "10:01",
    );
  });
});
