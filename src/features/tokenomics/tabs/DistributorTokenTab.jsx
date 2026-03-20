import * as React from "react";
import StatCard from "../../Common/components/StatCard.jsx";
import LineChart from "../../Charts/charts/LineChart.jsx";
import AddressLine from "../components/AddressLine.jsx";
import { explorerLink } from "../utils/format.js";
import styles from "../styles/BiggiToken.module.css";
import { ADDR } from "@/shared/utils/addresses.js";
import "./DistributorTokenTab.css";

const MISSING_DISPLAY = new Set(["", "--", "N/A", "NaN"]);

const hasValue = (value) => {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  return text ? !MISSING_DISPLAY.has(text) : false;
};

const isAddress = (value) =>
  typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);

const normalizeAddress = (value) =>
  isAddress(value) ? value.toLowerCase() : null;

const sameAddress = (left, right) => {
  const lhs = normalizeAddress(left);
  const rhs = normalizeAddress(right);
  if (!lhs || !rhs) return null;
  return lhs === rhs;
};

const shortAddress = (value) =>
  isAddress(value) ? `${value.slice(0, 6)}...${value.slice(-4)}` : "--";

const pickAddress = (...values) => values.find((value) => isAddress(value)) ?? null;

const toNumber = (value) => {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

const formatMaybeAmount = (value, unit, digits = 2) => {
  const num = toNumber(value);
  if (num != null) {
    return `${num.toLocaleString("en-US", {
      maximumFractionDigits: digits,
    })} ${unit}`.trim();
  }
  if (!hasValue(value)) return "--";
  const raw = String(value).trim();
  return unit && raw.includes(unit) ? raw : `${raw} ${unit}`.trim();
};

const formatShareHint = (part, total) => {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return "--";
  return `${((part / total) * 100).toFixed(1)}% of intake`;
};

const buildCheck = ({ label, actual, expected, reader }) => {
  const actualAddress = pickAddress(actual);
  const expectedAddress = pickAddress(expected);
  const readerAddress = pickAddress(reader);
  const configMatch = sameAddress(actualAddress, expectedAddress);
  const readerMatch = sameAddress(actualAddress, readerAddress);

  let status = "Observed";
  let tone = "ok";

  if (!actualAddress) {
    status = "Missing";
    tone = "warn";
  } else if (configMatch === false || readerMatch === false) {
    status = "Mismatch";
    tone = "warn";
  } else if (configMatch === true || readerMatch === true) {
    status = "Matched";
  }

  const reference =
    expectedAddress && readerAddress && expectedAddress !== readerAddress
      ? `${shortAddress(expectedAddress)} / ${shortAddress(readerAddress)}`
      : shortAddress(expectedAddress || readerAddress);

  return {
    label,
    reference,
    status,
    tone,
  };
};

function DistributorTokenTab({
  distributorData,
  tokenSnapshot,
  BUYBACKSnapshot,
  BUYBACKFallback,
  DRIPAvailable,
  tokenTotalSupply,
  totalSeries = [],
  pendingSeries = [],
  reserveSeries = [],
  buybackSeries = [],
  communitySeries = [],
  historyPoints = [],
  readerStatus,
  isLoading,
  error,
}) {
  if (isLoading && !distributorData) {
    return <div className="distributor-token-tab">Loading distributor snapshot...</div>;
  }

  if (error && !distributorData) {
    return (
      <div className="distributor-token-tab distributor-token-tab--error">
        {error?.message || String(error)}
      </div>
    );
  }

  if (!distributorData) {
    return <div className="distributor-token-tab">Waiting for distributor snapshot...</div>;
  }

  const dist = distributorData || {};
  const token = tokenSnapshot?.token || {};
  const tokenSymbol = token.symbol || "BIGGI";
  const totalReceivedNumeric = toNumber(
    dist.totalReceivedNumeric ?? dist.totalReceived ?? dist.totalDistributed,
  );
  const totalPendingNumeric = toNumber(dist.totalPendingNumeric ?? dist.totalPending);
  const pendingReserveNumeric = toNumber(
    dist.pendingReserveNumeric ?? dist.pendingReserve,
  );
  const pendingBuybackNumeric = toNumber(
    dist.pendingBUYBACKNumeric ?? dist.pendingBUYBACK ?? dist.pendingBUYBACKAgent,
  );
  const pendingRewardsNumeric = toNumber(
    dist.pendingCOLLECTIONREWARDSNumeric ?? dist.pendingCOLLECTIONREWARDS,
  );
  const communityPoolNumeric = toNumber(
    dist.communityPoolBalanceNumeric ?? dist.communityPoolBalance,
  );
  const buybackTotal =
    BUYBACKSnapshot?.BUYBACK?.totalBiggiAcquired ?? BUYBACKFallback ?? "--";

  const checks = [
    buildCheck({
      label: "Distributor",
      actual: dist.address,
      expected: ADDR.DISTRIBUTOR,
      reader: readerStatus?.distributor,
    }),
    buildCheck({
      label: "Reserve target",
      actual: dist.reserve,
      expected: tokenSnapshot?.token?.reserveAddress ?? ADDR.RESERVE,
      reader: readerStatus?.reserve,
    }),
    buildCheck({
      label: "BUYBACK target",
      actual: dist.BUYBACKAgent,
      expected: BUYBACKSnapshot?.BUYBACK?.address ?? ADDR.BUYBACK_AGENT,
      reader: readerStatus?.BUYBACKAgent ?? readerStatus?.buybackAgent,
    }),
    buildCheck({
      label: "Treasury target",
      actual: dist.treasury,
      expected: BUYBACKSnapshot?.treasury?.address ?? ADDR.TREASURY,
      reader: readerStatus?.treasury,
    }),
    buildCheck({
      label: "Rewards target",
      actual: dist.COLLECTIONREWARDS,
      expected: ADDR.COLLECTION_REWARDS,
      reader: readerStatus?.COLLECTIONREWARDS ?? readerStatus?.collectionRewards,
    }),
    buildCheck({
      label: "Community target",
      actual: dist.COMMUNITYCENTER,
      expected: ADDR.COMMUNITY_CENTER,
      reader: readerStatus?.COMMUNITYCENTER ?? readerStatus?.communityCenter,
    }),
    buildCheck({
      label: "DRIP target",
      actual: dist.DRIPDistributor,
      expected:
        tokenSnapshot?.token?.DRIPDistributorAddress ??
        tokenSnapshot?.token?.addresses?.DRIPDistributor ??
        ADDR.DRIP_DISTRIBUTOR,
    }),
  ];
  const mismatchCount = checks.filter((row) => row.tone !== "ok").length;
  const matchedCount = checks.length - mismatchCount;
  const statusTone =
    !hasValue(dist.address)
      ? "idle"
      : mismatchCount > 0
        ? "warning"
        : totalPendingNumeric != null && totalPendingNumeric > 0
          ? "active"
          : "idle";
  const statusLabel =
    !hasValue(dist.address)
      ? "Waiting"
      : mismatchCount > 0
        ? "Mismatch"
        : totalPendingNumeric != null && totalPendingNumeric > 0
          ? "Routing"
          : "Wired";

  const stats = [
    {
      label: "Total received",
      value: formatMaybeAmount(dist.totalReceived ?? dist.totalDistributed, "POL"),
      hint: shortAddress(dist.address),
      tone: "native",
    },
    {
      label: "Total pending",
      value: formatMaybeAmount(dist.totalPending, "POL"),
      hint: formatShareHint(totalPendingNumeric, totalReceivedNumeric),
      tone: "native",
    },
    {
      label: "Reserve queue",
      value: formatMaybeAmount(dist.pendingReserve, "POL"),
      hint: shortAddress(dist.reserve),
      tone: "native",
    },
    {
      label: "BUYBACK queue",
      value: formatMaybeAmount(
        dist.pendingBUYBACK ?? dist.pendingBUYBACKAgent,
        "POL",
      ),
      hint: shortAddress(dist.BUYBACKAgent),
      tone: "native",
    },
    {
      label: "REWARDS queue",
      value: formatMaybeAmount(dist.pendingCOLLECTIONREWARDS, "POL"),
      hint: shortAddress(dist.COLLECTIONREWARDS),
      tone: "native",
    },
    {
      label: "Community pool",
      value: formatMaybeAmount(dist.communityPoolBalance, "POL"),
      hint: shortAddress(dist.COMMUNITYCENTER),
      tone: "native",
    },
    {
      label: "DRIP available",
      value: formatMaybeAmount(DRIPAvailable, tokenSymbol),
      hint: shortAddress(dist.DRIPDistributor),
      tone: "token",
    },
    {
      label: "BUYBACK acquired",
      value: formatMaybeAmount(buybackTotal, tokenSymbol),
      hint: shortAddress(dist.BUYBACKAgent),
      tone: "token",
    },
  ];

  const routingRows = [
    {
      label: "Reserve queue",
      value: `${formatMaybeAmount(dist.pendingReserve, "POL")} (${formatShareHint(
        pendingReserveNumeric,
        totalReceivedNumeric,
      )})`,
    },
    {
      label: "BUYBACK queue",
      value: `${formatMaybeAmount(
        dist.pendingBUYBACK ?? dist.pendingBUYBACKAgent,
        "POL",
      )} (${formatShareHint(pendingBuybackNumeric, totalReceivedNumeric)})`,
    },
    {
      label: "Treasury queue",
      value: formatMaybeAmount(dist.pendingTreasury, "POL"),
    },
    {
      label: "REWARDS queue",
      value: `${formatMaybeAmount(dist.pendingCOLLECTIONREWARDS, "POL")} (${formatShareHint(
        pendingRewardsNumeric,
        totalReceivedNumeric,
      )})`,
    },
    {
      label: "Community queue",
      value: formatMaybeAmount(
        dist.pendingCOMMUNITYCENTER ?? dist.pendingCommunity,
        "POL",
      ),
    },
  ];

  const contextRows = [
    {
      label: "Snapshot source",
      value: hasValue(dist.snapshotSource) ? dist.snapshotSource : "Unknown",
    },
    {
      label: "Snapshot reader",
      value: shortAddress(dist.readerAddress ?? ADDR.MCD_READER_V2),
    },
    {
      label: "Token supply",
      value: formatMaybeAmount(tokenTotalSupply, tokenSymbol, 0),
    },
    {
      label: "Community pool",
      value: `${formatMaybeAmount(dist.communityPoolBalance, "POL")} (${formatShareHint(
        communityPoolNumeric,
        totalReceivedNumeric,
      )})`,
    },
  ];

  const receivedChartSeries = reserveSeries?.length ? reserveSeries : historyPoints;
  const pendingChartSeries = pendingSeries?.length ? pendingSeries : historyPoints;
  const buybackChartSeries = buybackSeries?.length ? buybackSeries : reserveSeries;
  const communityChartSeries = communitySeries?.length ? communitySeries : [];

  return (
    <section className="distributor-token-tab">
      <header className="distributor-token-tab__header">
        <div className="distributor-token-tab__headline">
          <h3>Distributor Routing</h3>
          <p>
            Native intake queues, downstream routing pressure, and contract
            wiring cross-checks against the active address registry.
          </p>
        </div>
        <div className="distributor-token-tab__header-meta">
          <span className={`distributor-token-tab__badge distributor-token-tab__badge--${statusTone}`}>
            {statusLabel}
          </span>
          <span className="distributor-token-tab__timestamp">
            {matchedCount}/{checks.length} wired
          </span>
          <span className="distributor-token-tab__timestamp">
            {dist.tsLabel || "--"}
          </span>
        </div>
      </header>

      <div className="distributor-token-tab__stats">
        {stats.map((stat, idx) => (
          <StatCard key={`${stat.label}-${idx}`} {...stat} />
        ))}
      </div>

      <div className="distributor-token-tab__charts">
        <div className="distributor-token-tab__chart">
          <h4>Reserve queue</h4>
          <p>Pending POL currently assigned to reserve, which moves faster than total intake.</p>
          <LineChart points={receivedChartSeries || []} height={160} />
        </div>
        <div className="distributor-token-tab__chart">
          <h4>Total pending</h4>
          <p>Backlog still sitting inside the distributor before downstream contracts consume it.</p>
          <LineChart points={pendingChartSeries || []} height={160} />
        </div>
        <div className="distributor-token-tab__chart">
          <h4>Pending BUYBACK</h4>
          <p>BUYBACK allocation waiting to be forwarded from the distributor side.</p>
          <LineChart points={buybackChartSeries || []} height={160} />
        </div>
        <div className="distributor-token-tab__chart">
          <h4>Community pool</h4>
          <p>Community-side native balance accumulated out of the distributor stream.</p>
          <LineChart points={communityChartSeries || []} height={160} />
        </div>
      </div>

      <div className={styles.ecoTables}>
        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>Routing buckets</div>
          {routingRows.map((row) => (
            <div key={row.label} className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>{row.label}</span>
              <span className={styles.ecoTableValue}>
                {hasValue(row.value) ? row.value : "--"}
              </span>
            </div>
          ))}
        </div>

        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>Cross-system context</div>
          {contextRows.map((row) => (
            <div key={row.label} className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>{row.label}</span>
              <span className={styles.ecoTableValue}>
                {hasValue(row.value) ? row.value : "--"}
              </span>
            </div>
          ))}
        </div>

        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>Connection checks</div>
          {checks.map((row) => (
            <div
              key={row.label}
              className={`${styles.ecoTableRow} ${styles.ecoTableRowThree}`}
            >
              <span className={styles.ecoTableLabel}>{row.label}</span>
              <span className={styles.ecoTableValue}>
                {hasValue(row.reference) ? row.reference : "--"}
              </span>
              <span
                className={`${styles.ecoTableStatus} ${
                  row.tone === "ok" ? styles.ecoStatusOk : styles.ecoStatusWarn
                }`}
              >
                {row.status}
              </span>
            </div>
          ))}
        </div>

        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>Contract wiring</div>
          <AddressLine
            label="Distributor"
            address={dist.address}
            href={explorerLink(dist.address)}
          />
          <AddressLine
            label="Reserve"
            address={dist.reserve}
            href={explorerLink(dist.reserve)}
          />
          <AddressLine
            label="BUYBACK Agent"
            address={dist.BUYBACKAgent}
            href={explorerLink(dist.BUYBACKAgent)}
          />
          <AddressLine
            label="Treasury"
            address={dist.treasury}
            href={explorerLink(dist.treasury)}
          />
          <AddressLine
            label="Collection Rewards"
            address={dist.COLLECTIONREWARDS}
            href={explorerLink(dist.COLLECTIONREWARDS)}
          />
          <AddressLine
            label="Community Center"
            address={dist.COMMUNITYCENTER}
            href={explorerLink(dist.COMMUNITYCENTER)}
          />
          <AddressLine
            label="DRIP Distributor"
            address={dist.DRIPDistributor}
            href={explorerLink(dist.DRIPDistributor)}
          />
          <AddressLine
            label="MCD Reader V2"
            address={dist.readerAddress ?? ADDR.MCD_READER_V2}
            href={explorerLink(dist.readerAddress ?? ADDR.MCD_READER_V2)}
          />
        </div>
      </div>
    </section>
  );
}

export default React.memo(DistributorTokenTab);
