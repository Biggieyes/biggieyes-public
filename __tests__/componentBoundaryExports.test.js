import { expect, it } from "vitest";
import { isValidElementType } from "react-is";

it.each([
  "../src/app/Bootstrap.jsx",
  "../src/shared/components/Address.jsx",
  "../src/components/common/Address.jsx",
  "../src/features/tokenomics/tabs/FlowTab.jsx",
  "../src/features/tokenomics/tabs/HistoryTab.jsx",
  "../src/features/tokenomics/tabs/TransparencyTab.jsx",
])("keeps component-only exports in %s", async (path) => {
  const module = await import(path);
  expect(Object.keys(module)).toEqual(["default"]);
  expect(isValidElementType(module.default)).toBe(true);
});

it.each([
  ["Web3Provider", "Web3Provider"],
  ["ContractsProvider", "ContractsProvider"],
  ["RewardsProvider", "REWARDSProvider"],
  ["VrfProvider", "VRFProvider"],
  ["StatsProvider", "StatsProvider"],
  ["InventoryProvider", "InventoryProvider"],
])("keeps the provider JSX module component-only: %s", async (file, name) => {
  const module = await import(`../src/providers/${file}.jsx`);
  expect(Object.keys(module)).toEqual([name]);
  expect(module[name]).toBeTypeOf("function");
});

it.each([
  ["Web3Provider", "Web3Provider", "Web3Provider"],
  ["ContractsProvider", "ContractsProvider", "ContractsProvider"],
  ["REWARDSProvider", "RewardsProvider", "REWARDSProvider"],
  ["VrfProvider", "VrfProvider", "VRFProvider"],
])(
  "preserves the application provider alias identity: %s",
  async (alias, file, name) => {
    const application = await import(`../src/app/providers/${alias}.jsx`);
    const canonical = await import(`../src/providers/${file}.jsx`);
    expect(application[name]).toBe(canonical[name]);
    expect(Object.keys(application)).toEqual([name]);
  },
);

it("preserves the complete re-export-only Tokenomics API after changing its extension", async () => {
  const api = await import("../src/features/tokenomics/index.js");
  const formatting = await import("../src/features/tokenomics/utils/format.js");
  const { default: readerHook } =
    await import("../src/features/tokenomics/hooks/useOnchainReader.js");
  const { default: EcosystemPanel } =
    await import("../src/features/tokenomics/EcosystemPanel.jsx");
  const components = [
    "EcosystemPanel",
    "BiggiToken",
    "EcosystemErrorBoundary",
    "HeroStats",
    "LiveToggle",
    "TabsBar",
    "TokenomicsPanel",
    "ExpansionPanel",
    "FlowTab",
    "PolicyTab",
    "BUYBACKTreasuryTab",
    "DRIPTab",
    "LiquidityTab",
    "TokenDexTab",
    "DistributorTokenTab",
    "AddressLine",
    "Button",
    "Card",
    "SectionHeader",
    "Line",
    "HeroStat",
  ];
  expect(Object.keys(api).sort()).toEqual(
    [
      ...components,
      "default",
      "useOnchainReader",
      ...Object.keys(formatting),
    ].sort(),
  );
  expect(api.default).toBe(EcosystemPanel);
  expect(api.EcosystemPanel).toBe(EcosystemPanel);
  expect(api.useOnchainReader).toBe(readerHook);
  for (const [key, value] of Object.entries(formatting))
    expect(api[key]).toBe(value);
});

it("preserves the VRF hook alias and provider export", async () => {
  const alias = await import("../src/hooks/useVRF.js");
  const { useVRF } = await import("../src/providers/VrfContext.js");
  const { VRFProvider } = await import("../src/providers/VrfProvider.jsx");
  expect(Object.keys(alias).sort()).toEqual(["VRFProvider", "useVRF"]);
  expect(alias.useVRF).toBe(useVRF);
  expect(alias.VRFProvider).toBe(VRFProvider);
});
