import * as React from "react";
import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress, arrayify } from "ethers";
import { ADDR } from "../../../utils/contract.js";
import { BiggiLpPriceFeed as ABI_LP_PRICE_FEED } from "../../../config/abi/index.js";
import LineChart from "../charts/LineChart";
import StatusBadge from "../components/StatusBadge";
import ValueRow from "../components/ValueRow";
import TokenDexFlow from "../★☆ECOSYSTEM☆★/★FLOW★/TokenDexFlow";
import {
  mapHistoryToPricePoints,
  mapHistoryToReservePoints,
  mapHistoryToLpPoints,
} from "../../../services/tokenomics/tokenDex.mappers.js";
import "./TokenDexTab.css";

const TokenDexTab = ({ snapshot, history = [], isLoading, error }) => {
  const priceSeries = mapHistoryToPricePoints(history);

  // --- LP price feed (live) ---
  const [lpPrice, setLpPrice] = React.useState(null);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const provider =
          window && window.ethereum
            ? new BrowserProvider(window.ethereum)
            : ethers.getDefaultProvider();
        const feedAddr = ADDR.LP_PRICE_FEED;
        if (feedAddr) {
          const feed = new Contract(
            feedAddr,
            ABI_LP_PRICE_FEED,
            provider,
          );
          const round = await feed.latestRoundData().catch(() => null);
          const dec = await feed.decimals().catch(() => 18);
          if (!alive) return;
          if (round && round.answer != null) {
            const price = Number(ethers.utils.formatUnits(round.answer, dec));
            if (Number.isFinite(price)) setLpPrice(price);
          }
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  const reserveSeries = mapHistoryToReservePoints(history);
  const lpSeries = mapHistoryToLpPoints(history);

  const statusMessage = error
    ? "Unable to load token/DEX snapshot."
    : !snapshot && isLoading
      ? "Loading token/DEX metrics..."
      : null;

  const tokenRows = [
    {
      label: "Total supply",
      value: snapshot?.token?.totalSupply ?? "N/A",
      hint: snapshot?.token?.symbol ?? "BIGGI",
    },
    {
      label: "Hard cap",
      value: snapshot?.token?.cap ?? "N/A",
      hint: "MAX",
    },
    {
      label: "Remaining mintable",
      value: snapshot?.token?.remainingMintable ?? "N/A",
      hint: "Mintable via owner",
    },
  ];

  const balanceRows = [
    {
      label: "Reserve balance",
      value: snapshot?.token?.balances?.reserve ?? "N/A",
      hint: "Reserve",
    },
    {
      label: "Vault balance",
      value: snapshot?.token?.balances?.liquidityVault ?? "N/A",
      hint: "Liquidity vault",
    },
    {
      label: "Treasury balance",
      value: snapshot?.token?.balances?.treasury ?? "N/A",
      hint: "Treasury",
    },
  ];

  const addressRows = [
    {
      label: "Reserve contract",
      value: snapshot?.token?.addresses?.reserveShort ?? "N/A",
      hint: snapshot?.token?.addresses?.reserve,
    },
    {
      label: "Drip distributor",
      value: snapshot?.token?.addresses?.dripDistributorShort ?? "N/A",
      hint: snapshot?.token?.addresses?.dripDistributor,
    },
    {
      label: "Token rewards",
      value: snapshot?.token?.addresses?.tokenRewardsShort ?? "N/A",
      hint: snapshot?.token?.addresses?.tokenRewards,
    },
  ];

  const priceFeedRound = snapshot?.dex?.price?.feed?.roundId;
  const dexRows = [
    {
      label: "Spot price (native/BIGGI)",
      value: snapshot?.dex?.price?.pair?.nativePerBiggi ?? "N/A",
      hint: snapshot?.dex?.price?.source,
    },
    {
      label: "Router price",
      value: snapshot?.dex?.price?.router?.nativePerBiggi ?? "N/A",
      hint: "Router quote",
    },
    {
      label: "Feed price",
      value: snapshot?.dex?.price?.feed?.price ?? "N/A",
      hint: priceFeedRound ? `Round ${priceFeedRound}` : "Oracle",
    },
    {
      label: "Native reserve",
      value: snapshot?.dex?.pair?.reserves?.native ?? "N/A",
      hint: "WETH/POL",
    },
    {
      label: "BIGGI reserve",
      value: snapshot?.dex?.pair?.reserves?.biggi ?? "N/A",
      hint: "BIGGI",
    },
    {
      label: "LP total supply",
      value: snapshot?.dex?.pair?.totalSupply ?? "N/A",
      hint: "LP tokens",
    },
    {
      label: "TVL estimate",
      value: snapshot?.dex?.derived?.tvlNative ?? "N/A",
      hint: "Native units",
    },
    {
      label: "Price impact",
      value: snapshot?.dex?.derived?.priceImpact ?? "N/A",
      hint: "Router vs pair",
    },
  ];

  const dexAddressRows = [
    {
      label: "Router",
      value: snapshot?.dex?.router?.address ?? "N/A",
      hint: "DEX router",
    },
    {
      label: "Pair",
      value: snapshot?.dex?.pairAddress ?? "N/A",
      hint: "LP contract",
    },
    {
      label: "Factory",
      value: snapshot?.dex?.router?.factory ?? "N/A",
      hint: "DEX factory",
    },
  ];

  return (
    <div className="token-dex-tab">
      <header className="token-dex-tab__header">
        <div>
          <p className="token-dex-tab__eyebrow">Token / DEX</p>
          <h3>BIGGI market snapshot</h3>
        </div>
        <span className="token-dex-tab__timestamp">
          Updated {snapshot?.tsLabel ?? "N/A"}
        </span>
      </header>

      <TokenDexFlow snapshot={snapshot} history={history} />

      <div className="token-dex-tab__charts">
        <article className="token-dex-tab__chart">
          <header>
            <h5>Price trend</h5>
            <p>Native per BIGGI (pair)</p>
          </header>
          <LineChart points={priceSeries} />
        </article>
        <article className="token-dex-tab__chart">
          <header>
            <h5>Native reserve</h5>
            <p>WETH / POL reserve levels</p>
          </header>
          <LineChart points={reserveSeries} />
        </article>
        <article className="token-dex-tab__chart">
          <header>
            <h5>LP supply trend</h5>
            <p>LP tokens minted</p>
          </header>
          <LineChart points={lpSeries} />
        </article>
      </div>

      <div className="token-dex-tab__grid">
        <section className="token-dex-card token-dex-card--dex">
          <div style={{ marginBottom: 8, fontWeight: 600, color: "#4ad2ff" }}>
            LP token price: {lpPrice != null ? `${lpPrice} POL` : "--"}
          </div>
          <div className="token-dex-card__title">
            <div>
              <h4>DEX & liquidity</h4>
              <p>BIGGI / WETH pool</p>
            </div>
            <StatusBadge
              status={snapshot?.dex?.derived?.marketHealth ?? "Unknown"}
              tone={snapshot?.dex?.derived?.marketHealthTone}
            />
          </div>
          <div className="token-dex-card__rows">
            {dexRows.map((row) => (
              <ValueRow key={row.label} {...row} />
            ))}
          </div>
          <div className="token-dex-card__addresses">
            {dexAddressRows.map((row) => (
              <ValueRow key={row.label} {...row} />
            ))}
          </div>
        </section>

        <section className="token-dex-card token-dex-card--token">
          <div className="token-dex-card__title">
            <h4>BIGGI token overview</h4>
          </div>
          <div className="token-dex-card__rows">
            {tokenRows.map((row) => (
              <ValueRow key={row.label} {...row} />
            ))}
          </div>
          <div className="token-dex-card__balances">
            {balanceRows.map((row) => (
              <ValueRow key={row.label} {...row} />
            ))}
          </div>
          <div className="token-dex-card__addresses">
            {addressRows.map((row) => (
              <ValueRow key={row.label} {...row} />
            ))}
          </div>
        </section>
      </div>

      {statusMessage && (
        <div className="token-dex-tab__status">{statusMessage}</div>
      )}
    </div>
  );
};

export default TokenDexTab;

