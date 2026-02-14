// src/features/tokenomics/EcosystemPanel.jsx
// BIGGI ECOSYSTEM — view-only tokenomics dashboard

import * as React from "react";
import { formatUnits } from "ethers";

import styles from "./styles/BiggiToken.module.css";

import { useWeb3 } from "@/providers/Web3Provider";

import useFlowSnapshot from "@/hooks/tokenomics/useFlowSnapshot";
import usePolicySnapshot from "@/hooks/tokenomics/usePolicySnapshot";
import useBUYBACKTreasurySnapshot from "@/hooks/tokenomics/useBUYBACKTreasurySnapshot";
import useBUYBACKTreasuryHistory from "@/hooks/tokenomics/useBUYBACKTreasuryHistory";
import useDRIPSnapshot from "@/hooks/tokenomics/useDRIPSnapshot";
import useDRIPHistory from "@/hooks/tokenomics/useDRIPHistory";
import useLiquiditySnapshot from "@/hooks/tokenomics/useLiquiditySnapshot";
import useLiquidityHistory from "@/hooks/tokenomics/useLiquidityHistory";
import useTokenDexSnapshot from "@/hooks/tokenomics/useTokenDexSnapshot";
import useTokenDexHistory from "@/hooks/tokenomics/useTokenDexHistory";
import useDistributorSnapshot from "@/hooks/tokenomics/useDistributorSnapshot";
import useDistributorHistory from "@/hooks/tokenomics/useDistributorHistory";
import { toNumberSafe } from "@/hooks/tokenomics/_utils";

import EcosystemErrorBoundary from "./components/EcosystemErrorBoundary.jsx";
import HeroStats from "./HeroStats.jsx";
import TabsBar from "./TabsBar.jsx";
import FlowTab from "./tabs/FlowTab";
import PolicyTab from "./tabs/PolicyTab";
import BUYBACKTreasuryTab from "./tabs/BUYBACKTreasuryTab";
import DRIPTab from "./tabs/DRIPTab";
import HistoryTab from "./tabs/HistoryTab";
import DistributorTokenTab from "./tabs/DistributorTokenTab";
import TokenomicsPanel from "./sections/TokenomicsPanel";
import TransparencyTab from "./tabs/TransparencyTab.jsx";
import Card from "./components/Card.jsx";
import { shortAddr, explorerLink, isAddress } from "./utils/format";
import { ADDR } from "@/shared/utils/addresses.js";
import PanelInfoModal from "@/components/common/PanelInfoModal";

const TABS = [
  { key: "flow", label: "FLOW" },
  { key: "distributor", label: "DISTRIBUTOR" },
  { key: "buyback", label: "BUYBACK" },
  { key: "drip", label: "DRIP" },
  { key: "liquidity", label: "RESERVE / LM" },
  { key: "policy", label: "POLICY" },
  { key: "dex", label: "TOKEN / DEX" },
  { key: "history", label: "HISTORY" },
  { key: "transparency", label: "TRANSPARENCY" },
];

function _formatDexHistory(history = [], tokenDecimals = 18) {
  return history
    .map((h) => {
      const p = h?.dex?.pair;
      const reserves = p?.reserves;
      if (!reserves) return null;
      return {
        time: h?.tsLabel || "",
        reserveNative: toNumberSafe(reserves.native, 18),
        reserveBiggi: toNumberSafe(reserves.token, tokenDecimals),
        price: h?.derived?.priceNativePerToken == null ? null : Number(h.derived.priceNativePerToken),
      };
    })
    .filter(Boolean);
}

export default function EcosystemPanel() {
  const { chainId, account } = useWeb3();
  const [active, setActive] = React.useState("flow");
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [wiringOpen, setWiringOpen] = React.useState(false);
  const isLive = true;
  const needsFlow = active === "flow" || active === "transparency" || wiringOpen;
  const needsPolicy = active === "policy" || active === "transparency";
  const needsDistributor =
    active === "distributor" || active === "transparency" || wiringOpen;
  const needsDistributorHistory =
    active === "distributor" || active === "transparency";
  const needsBuybackHistory =
    active === "buyback" || active === "history" || active === "transparency";
  const needsDripHistory =
    active === "drip" || active === "history" || active === "transparency";
  const needsLiquidityHistory =
    active === "liquidity" || active === "history" || active === "transparency";
  const needsDexHistory = active === "dex" || active === "transparency";

  const infoItems = React.useMemo(
    () => [
      {
        label: "FLOW",
        description: [
          "Full tokenomics flow and value routing.",
          "Shows how mint value moves into reserves, buyback, and rewards.",
        ],
      },
      {
        label: "DISTRIBUTOR",
        description: [
          "Multi-collection distribution and reward splits.",
          "Tracks allocation to community/collection pools.",
        ],
      },
      {
        label: "BUYBACK",
        description: [
          "Buyback stats and routing outcomes.",
          "Shows executed swaps and treasury impact.",
        ],
      },
      {
        label: "DRIP",
        description: [
          "DRIP rewards schedule and balances.",
          "Displays emission status and available rewards.",
        ],
      },
      {
        label: "RESERVE / LM",
        description: [
          "Reserve and liquidity manager overview.",
          "Shows POL/BIGGI balances and LM actions.",
        ],
      },
      {
        label: "POLICY",
        description: [
          "On-chain policy parameters.",
          "Controls slippage, deadlines, and safety limits.",
        ],
      },
      {
        label: "TOKEN / DEX",
        description: [
          "Token price + DEX metrics.",
          "Reserves, LP health, and derived price.",
        ],
      },
      {
        label: "TRANSPARENCY",
        description: [
          "On-chain wiring and transparency stats.",
          "All addresses and flows are verifiable on-chain.",
        ],
      },
      {
        label: "HISTORY",
        description: [
          "Recent buyback, LM, and DRIP operations.",
          "Snapshot timeline for quick audits.",
        ],
      },
    ],
    [],
  );

  // --- snapshots (auto refresh) ---
  const flow = useFlowSnapshot({
    intervalMs: isLive && needsFlow ? 15_000 : 0,
    immediate: needsFlow,
  });
  const policy = usePolicySnapshot({
    intervalMs: isLive && needsPolicy ? 20_000 : 0,
    immediate: needsPolicy,
  });
  const buyback = useBUYBACKTreasurySnapshot({ intervalMs: isLive ? 20_000 : 0 });
  const drip = useDRIPSnapshot({ intervalMs: isLive ? 20_000 : 0 });
  const liquidity = useLiquiditySnapshot({ intervalMs: isLive ? 20_000 : 0 });
  const tokenDex = useTokenDexSnapshot({ intervalMs: isLive ? 20_000 : 0 });
  const distributor = useDistributorSnapshot({
    intervalMs: isLive && needsDistributor ? 20_000 : 0,
    immediate: needsDistributor,
  });

  // --- histories (client-side buffers) ---
  const buybackHistory = useBUYBACKTreasuryHistory(
    needsBuybackHistory ? buyback.snapshot : null,
  );
  const dripHistory = useDRIPHistory(
    needsDripHistory ? drip.snapshot : null,
  );
  const liquidityHistory = useLiquidityHistory(
    needsLiquidityHistory ? liquidity.snapshot : null,
  );
  const tokenDexHistory = useTokenDexHistory(
    needsDexHistory ? tokenDex.snapshot : null,
  );
  const distributorHistory = useDistributorHistory(
    needsDistributorHistory ? distributor.snapshot : null,
  );

  const chainStatus = React.useMemo(
    () => ({ chainId, account, role: account ? "Connected" : "Viewer" }),
    [chainId, account],
  );

  const liquidityChart = React.useMemo(() => {
    if (active !== "liquidity") return [];
    const pts = liquidityHistory?.chartPoints || [];
    return pts.map((p) => ({ time: p.time, liquidity: p.value }));
  }, [active, liquidityHistory]);

  const dexChart = React.useMemo(
    () => {
      if (active !== "dex") return [];
      return _formatDexHistory(
        tokenDexHistory?.history || [],
        tokenDex.snapshot?.token?.decimals ?? 18,
      );
    },
    [active, tokenDexHistory, tokenDex.snapshot],
  );

  const dexLiquidity = React.useMemo(() => {
    if (active !== "dex") return null;
    const p = tokenDex.snapshot?.dex?.pair;
    const r = p?.reserves;
    if (!r) return null;
    const derived = tokenDex.snapshot?.derived || {};
    return {
      reserveNative: toNumberSafe(r.native, 18),
      reserveBiggi: toNumberSafe(r.token, tokenDex.snapshot?.token?.decimals ?? 18),
      lpTotalSupply: toNumberSafe(p?.lpTotalSupply, 18),
      nativePerBiggi: derived.priceNativePerToken ?? null,
      biggiPerNative: derived.priceTokenPerNative ?? null,
      pairAddress: p.address ?? tokenDex.snapshot?.dex?.pairAddress ?? null,
    };
  }, [active, tokenDex.snapshot]);

  const pumpView = React.useMemo(() => {
    if (active !== "dex") return null;
    const p = tokenDex.snapshot?.dex?.pair;
    if (!p) return null;
    return {
      pair: {
        address: p.address,
        nativeReserve: toNumberSafe(p.reserves?.native, 18),
        biggiReserve: toNumberSafe(p.reserves?.token, tokenDex.snapshot?.token?.decimals ?? 18),
        lpTotalSupply: toNumberSafe(p.lpTotalSupply, 18),
      },
      derived: tokenDex.snapshot?.derived,
    };
  }, [active, tokenDex.snapshot]);

  const heroStats = React.useMemo(() => {
    const items = [];
    const priceNative = tokenDex.snapshot?.derived?.priceNativePerToken;
    const reserveNative = liquidity.snapshot?.reserve?.maticBalanceNumeric;
    const lpLocked = liquidity.snapshot?.vault?.totalLpLockedNumeric;
    const treasuryBiggi = buyback.snapshot?.treasury?.biggiBalanceNumeric;
    const dripAvailable = drip.snapshot?.distributor?.availableNumeric;

    if (Number.isFinite(priceNative)) {
      items.push({
        key: "price",
        label: "Price (POL / BIGGI)",
        value: priceNative.toLocaleString("en-US", {
          maximumFractionDigits: 6,
        }),
        tone: "native",
      });
    }
    if (Number.isFinite(reserveNative)) {
      items.push({
        key: "reserve",
        label: "Reserve POL",
        value: reserveNative.toLocaleString("en-US", {
          maximumFractionDigits: 2,
        }),
        tone: "native",
      });
    }
    if (Number.isFinite(lpLocked)) {
      items.push({
        key: "lp",
        label: "Vault LP locked",
        value: lpLocked.toLocaleString("en-US", {
          maximumFractionDigits: 2,
        }),
        tone: "token",
      });
    }
    if (Number.isFinite(treasuryBiggi)) {
      items.push({
        key: "treasury",
        label: "Treasury BIGGI",
        value: treasuryBiggi.toLocaleString("en-US", {
          maximumFractionDigits: 2,
        }),
        tone: "token",
      });
    }
    if (Number.isFinite(dripAvailable)) {
      items.push({
        key: "drip",
        label: "DRIP available",
        value: dripAvailable.toLocaleString("en-US", {
          maximumFractionDigits: 2,
        }),
      });
    }
    return items;
  }, [tokenDex.snapshot, liquidity.snapshot, buyback.snapshot, drip.snapshot]);

  const tokenTotalSupply = React.useMemo(() => {
    if (active !== "distributor") return null;
    const total = tokenDex.snapshot?.token?.totalSupply;
    if (total == null) return null;
    try {
      const decimals = tokenDex.snapshot?.token?.decimals ?? 18;
      return formatUnits(total, decimals);
    } catch {
      return total?.toString?.() ?? null;
    }
  }, [active, tokenDex.snapshot]);

  const lastUpdatedLabel = React.useMemo(() => {
    const ts = Math.max(
      flow.snapshot?.ts || 0,
      policy.snapshot?.ts || 0,
      buyback.snapshot?.ts || 0,
      drip.snapshot?.ts || 0,
      liquidity.snapshot?.ts || 0,
      tokenDex.snapshot?.ts || 0,
      distributor.snapshot?.ts || 0,
    );
    if (!ts) return null;
    const time = new Date(ts).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `Updated ${time}`;
  }, [
    flow.snapshot,
    policy.snapshot,
    buyback.snapshot,
    drip.snapshot,
    liquidity.snapshot,
    tokenDex.snapshot,
    distributor.snapshot,
  ]);

  const wiringGroups = React.useMemo(() => {
    if (!wiringOpen) return [];
    const pickAddr = (...values) =>
      values.find((val) => typeof val === "string" && isAddress(val)) || null;

    const core = [
      {
        label: "BIGGI Token",
        address: pickAddr(
          tokenDex.snapshot?.token?.address,
          flow.snapshot?.tokenMeta?.address,
          ADDR.BIGGI_TOKEN,
          ADDR.BIGGI,
        ),
      },
      {
        label: "Distributor",
        address: pickAddr(
          distributor.snapshot?.address,
          flow.snapshot?.addresses?.distributor,
          ADDR.DISTRIBUTOR,
        ),
      },
      {
        label: "Reserve",
        address: pickAddr(
          liquidity.snapshot?.reserve?.address,
          flow.snapshot?.addresses?.reserve,
          ADDR.RESERVE,
        ),
      },
      {
        label: "Treasury",
        address: pickAddr(
          buyback.snapshot?.treasury?.address,
          flow.snapshot?.addresses?.treasury,
          ADDR.TREASURY,
        ),
      },
      {
        label: "Buyback Agent",
        address: pickAddr(
          buyback.snapshot?.BUYBACK?.address,
          flow.snapshot?.addresses?.BUYBACK,
          ADDR.BUYBACK_AGENT,
        ),
      },
    ];

    const liquidityStack = [
      {
        label: "Liquidity Manager",
        address: pickAddr(
          liquidity.snapshot?.manager?.address,
          liquidity.snapshot?.reserve?.liquidityManager,
          ADDR.LM,
        ),
      },
      {
        label: "Liquidity Vault",
        address: pickAddr(
          liquidity.snapshot?.vault?.address,
          ADDR.LIQUIDITY_VAULT,
        ),
      },
      {
        label: "Liquidity Automation",
        address: pickAddr(ADDR.LIQUIDITY_AUTOMATION),
      },
      {
        label: "Liquidity Setup",
        address: pickAddr(ADDR.LIQUIDITY_SETUP),
      },
      {
        label: "DEX Router",
        address: pickAddr(
          tokenDex.snapshot?.dex?.router?.address,
          tokenDex.snapshot?.dex?.router,
          ADDR.ROUTER,
        ),
      },
      {
        label: "DEX Factory",
        address: pickAddr(
          tokenDex.snapshot?.dex?.router?.factory,
          ADDR.FACTORY,
        ),
      },
      {
        label: "DEX Pair",
        address: pickAddr(
          tokenDex.snapshot?.dex?.pair?.address,
          tokenDex.snapshot?.dex?.pairAddress,
          ADDR.PAIR,
        ),
      },
      {
        label: "Wrapped Native",
        address: pickAddr(
          tokenDex.snapshot?.dex?.weth,
          ADDR.WETH,
        ),
      },
    ];

    const rewards = [
      {
        label: "Collection Rewards",
        address: pickAddr(
          flow.snapshot?.addresses?.collectionRewards,
          ADDR.COLLECTION_REWARDS,
        ),
      },
      {
        label: "Token Rewards",
        address: pickAddr(
          flow.snapshot?.addresses?.tokenREWARDS,
          ADDR.TOKEN_REWARDS,
        ),
      },
      {
        label: "NFT Rewards",
        address: pickAddr(ADDR.NFT_REWARDS),
      },
      {
        label: "Community Center",
        address: pickAddr(
          flow.snapshot?.addresses?.communityCenter,
          ADDR.COMMUNITY_CENTER,
        ),
      },
      {
        label: "DRIP Distributor",
        address: pickAddr(
          flow.snapshot?.addresses?.DRIPDistributor,
          ADDR.DRIP_DISTRIBUTOR,
        ),
      },
    ];

    return [
      { title: "Core contracts", rows: core },
      { title: "Liquidity & DEX", rows: liquidityStack },
      { title: "Rewards & Community", rows: rewards },
    ];
  }, [
    wiringOpen,
    flow.snapshot,
    distributor.snapshot,
    liquidity.snapshot,
    buyback.snapshot,
    tokenDex.snapshot,
  ]);

  return (
    <EcosystemErrorBoundary>
      <section className={`rewards-grid biggi-skin ${styles.ecosystem}`}>
        <div className="rewards-grid__surface biggi-token-surface">
          <header className="rewards-grid__header biggi-header panel-header panel-header--ecosystem">
            <div className="rewards-grid__headline">
              <h2 className="rewards-grid__title">BIGGI ECOSYSTEM</h2>
              <p className="rewards-grid__subtitle">
                View-only tokenomics dashboard (no transactions).
              </p>
            </div>

            <div className="biggi-header-right">
              <div className="biggi-status">
                <span className="biggi-status-dot" />
                <span>{chainStatus.role}</span>
              </div>
            </div>
          </header>

          <HeroStats items={heroStats} />
          <div
            className="panel-tabs-row"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <TabsBar tabs={TABS} active={active} onChange={setActive} />
            <button
              type="button"
              className="panel-info-btn biggi-btn biggi-btn--ghost"
              onClick={() => setInfoOpen(true)}
              aria-label="Ecosystem buttons info"
            >
              <span>i</span>
            </button>
          </div>
          {lastUpdatedLabel ? (
            <div className="biggi-value mono" style={{ marginTop: 10 }}>
              {lastUpdatedLabel}
            </div>
          ) : null}
          <PanelInfoModal
            open={infoOpen}
            onClose={() => setInfoOpen(false)}
            title="Ecosystem Panel"
            items={infoItems}
          />
          <Card
            title="ECOSYSTEM WIRING"
            subtitle="Full on-chain wiring (addresses + status)"
            action={
              <button
                type="button"
                className="biggi-btn biggi-btn--ghost"
                onClick={() => setWiringOpen((open) => !open)}
              >
                {wiringOpen ? "Hide" : "Show"}
              </button>
            }
          >
            {wiringOpen && (
              <div className={styles.ecoWiringGrid}>
                {wiringGroups.map((group) => (
                  <div key={group.title} className={styles.ecoWiringCard}>
                    <div className={styles.ecoWiringTitle}>{group.title}</div>
                    <div className={styles.ecoTable}>
                      {group.rows.map((row) => (
                        <div
                          key={`${group.title}-${row.label}`}
                          className={`${styles.ecoTableRow} ${styles.ecoTableRowThree}`}
                        >
                          <span className={styles.ecoTableLabel}>{row.label}</span>
                          <span className={`${styles.ecoTableValue} ${styles.ecoAddrMono}`}>
                            {row.address ? shortAddr(row.address) : "--"}
                            {row.address ? (
                              <a
                                className={styles.ecoTableLink}
                                href={explorerLink(row.address)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Explorer
                              </a>
                            ) : null}
                          </span>
                          <span
                            className={`${styles.ecoStatusDot} ${row.address ? styles.ecoStatusOk : styles.ecoStatusWarn}`}
                            title={row.address ? "Connected" : "Missing"}
                            aria-label={row.address ? "Connected" : "Missing"}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <div className="biggi-content">
          {active === "flow" ? (
            <FlowTab snapshot={flow.snapshot} loading={flow.loading} error={flow.error} />
          ) : null}

          {active === "buyback" ? (
            <BUYBACKTreasuryTab
              snapshot={buyback.snapshot}
              loading={buyback.loading}
              error={buyback.error}
              onRefresh={buyback.refresh}
              nativeSeries={buybackHistory.nativeSeries}
              treasurySeries={buybackHistory.treasurySeries}
              biggiSeries={buybackHistory.biggiSeries}
            />
          ) : null}

          {active === "distributor" ? (
            <DistributorTokenTab
              distributorData={distributor.snapshot}
              tokenSnapshot={tokenDex.snapshot}
              BUYBACKSnapshot={buyback.snapshot}
              BUYBACKFallback={buyback.snapshot?.BUYBACK?.totalBiggiAcquired}
              DRIPAvailable={
                drip.snapshot?.distributor?.availableTokens ??
                drip.snapshot?.distributor?.availableNumeric
              }
              tokenTotalSupply={tokenTotalSupply}
            />
          ) : null}

          {active === "drip" ? (
            <DRIPTab
              snapshot={drip.snapshot}
              loading={drip.loading}
              error={drip.error}
              onRefresh={drip.refresh}
              tokensSeries={dripHistory.tokensSeries}
              nativeSeries={dripHistory.nativeSeries}
            />
          ) : null}

          {active === "liquidity" ? (
            <TokenomicsPanel
              activeSection="liquidity"
              chainStatus={chainStatus}
              liquidity={liquidity.snapshot}
              tokenDex={tokenDex.snapshot}
              liquidityHistory={liquidityChart}
            />
          ) : null}

          {active === "policy" ? (
            <PolicyTab
              snapshot={policy.snapshot}
              loading={policy.loading}
              error={policy.error}
            />
          ) : null}

          {active === "dex" ? (
            <TokenomicsPanel
              activeSection="dex"
              chainStatus={chainStatus}
              pumpView={pumpView}
              liquidity={dexLiquidity}
              dexHistory={dexChart}
              tok={tokenDex.snapshot?.token}
              router={tokenDex.snapshot?.dex?.router}
              tokenDex={tokenDex.snapshot}
            />
          ) : null}
          {active === "history" ? (
            <HistoryTab
              buybackHistory={buybackHistory.history}
              dripHistory={dripHistory.history}
              liquidityHistory={liquidityHistory.history}
            />
          ) : null}
          {active === "transparency" ? (
            <TransparencyTab
              flowSnapshot={flow.snapshot}
              policySnapshot={policy.snapshot}
              distributorSnapshot={distributor.snapshot}
              buybackSnapshot={buyback.snapshot}
              dripSnapshot={drip.snapshot}
              liquiditySnapshot={liquidity.snapshot}
              tokenDexSnapshot={tokenDex.snapshot}
              buybackHistory={buybackHistory.history}
              dripHistory={dripHistory.history}
              liquidityHistory={liquidityHistory.history}
              distributorHistory={distributorHistory.history}
              tokenDexHistory={tokenDexHistory.history}
            />
          ) : null}
          </div>
        </div>
      </section>
    </EcosystemErrorBoundary>
  );
}
