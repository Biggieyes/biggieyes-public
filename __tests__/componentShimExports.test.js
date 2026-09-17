import { expect, it } from "vitest";

it.each([
  [
    "../src/components/common/FullscreenPanel.jsx",
    "../src/shared/components/FullscreenPanel.jsx",
  ],
  [
    "../src/features/Charts/charts/LineChart.jsx",
    "../src/shared/components/charts/LineChart.jsx",
  ],
  [
    "../src/features/Charts/charts/SimpleLineChart.jsx",
    "../src/shared/components/charts/SimpleLineChart.jsx",
  ],
  [
    "../src/features/Common/components/BiggiButton.jsx",
    "../src/shared/components/components/BiggiButton.jsx",
  ],
  [
    "../src/features/Common/components/StatCard.jsx",
    "../src/shared/components/components/StatCard.jsx",
  ],
])(
  "preserves the full component-only shim API: %s",
  async (shimPath, canonicalPath) => {
    const shim = await import(shimPath);
    const canonical = await import(canonicalPath);
    expect(Object.keys(shim).sort()).toEqual(Object.keys(canonical).sort());
    expect(shim.default).toBe(canonical.default);
  },
);
