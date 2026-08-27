import * as React from "react";
import WalletConnectButton from "@/components/WalletConnectButton";
import ModeratorPanel from "@/components/ModeratorPanel";
import AdminDashboard from "@/components/AdminDashboard";
import WeeklySummaryBuilder from "@/components/WeeklySummaryBuilder";
import MerkleTool from "@/components/MerkleTool";
import {
  getConfig,
  getModeratorCenterV2Contract,
  readSlotInfo,
  readWeekStats,
} from "@/utils/eth";
import "./MODERATORCENTERPanel.css";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const shortValue = (value, start = 8, end = 6) => {
  if (!value) return "--";
  const text = String(value);
  if (text.length <= start + end + 3) return text;
  return `${text.slice(0, start)}...${text.slice(-end)}`;
};

const sameAddress = (left, right) =>
  Boolean(left && right) && String(left).toLowerCase() === String(right).toLowerCase();

const rpcLabel = (value) => {
  if (!value) return "--";
  try {
    return new URL(String(value)).host || String(value);
  } catch {
    return String(value);
  }
};

export default function MODERATORCENTERPanel({
  compact = false,
  walletAddress = "",
  onConnectMetaMask,
  onConnectWalletConnect,
  onTx,
}) {
  const [activeTab, setActiveTab] = React.useState("moderator");
  const [weekId, setWeekId] = React.useState(() =>
    String(Math.floor(Date.now() / WEEK_MS)),
  );
  const [contractState, setContractState] = React.useState("checking");
  const [slots, setSlots] = React.useState([]);
  const [weekStats, setWeekStats] = React.useState(null);
  const [globalUnique, setGlobalUnique] = React.useState(null);
  const [claimable, setClaimable] = React.useState(null);
  const [paused, setPaused] = React.useState(null);
  const [operationallyReady, setOperationallyReady] = React.useState(null);
  const [chainLoading, setChainLoading] = React.useState(false);
  const [chainError, setChainError] = React.useState("");
  const [claimState, setClaimState] = React.useState({ pending: false, message: "" });
  const [weeklyEntries, setWeeklyEntries] = React.useState([]);

  const cfg = getConfig();
  const baseUrl = React.useMemo(
    () => (typeof window !== "undefined" ? window.location.origin : ""),
    [],
  );
  const activeSlots = React.useMemo(() => slots.filter((slot) => slot.enabled), [slots]);
  const ownerConnected = sameAddress(walletAddress, cfg.ownerAddress);
  const walletSlot = React.useMemo(
    () => slots.find((slot) => sameAddress(slot.payout, walletAddress)) || null,
    [slots, walletAddress],
  );

  const loadChainState = React.useCallback(async () => {
    setChainLoading(true);
    setChainError("");
    try {
      const contract = await getModeratorCenterV2Contract({ signer: false });
      await contract.ticketHub();
      const loadedSlots = await Promise.all(
        Array.from({ length: 10 }, (_, slotId) => readSlotInfo(contract, slotId)),
      );
      const matchedSlotId = loadedSlots.findIndex((slot) =>
        sameAddress(slot.payout, walletAddress),
      );
      const [globalUniqueResult, pausedResult, readyResult, claimableResult, weekResult] =
        await Promise.all([
          contract.globalUniquePerWeek(),
          contract.paused(),
          contract.operationallyReady(),
          walletAddress ? contract.claimable(walletAddress) : Promise.resolve(null),
          matchedSlotId >= 0 && weekId
            ? readWeekStats(contract, weekId, matchedSlotId)
            : Promise.resolve(null),
        ]);
      setSlots(loadedSlots.map((slot, slotId) => ({ ...slot, slotId })));
      setGlobalUnique(globalUniqueResult);
      setPaused(pausedResult);
      setOperationallyReady(readyResult);
      setClaimable(claimableResult);
      setWeekStats(weekResult);
      setContractState("v2");
    } catch (error) {
      setSlots([]);
      setWeekStats(null);
      setClaimable(null);
      setPaused(null);
      setOperationallyReady(null);
      setContractState("legacy");
      setChainError(
        error?.message?.includes("missing")
          ? error.message
          : "ModeratorCenter V2 is not active at the configured address.",
      );
    } finally {
      setChainLoading(false);
    }
  }, [walletAddress, weekId]);

  React.useEffect(() => {
    loadChainState();
  }, [loadChainState]);

  const handleClaim = React.useCallback(async () => {
    setClaimState({ pending: true, message: "" });
    try {
      const contract = await getModeratorCenterV2Contract({ signer: true });
      const tx = await contract.claim();
      await tx.wait();
      setClaimState({ pending: false, message: `Claim confirmed: ${shortValue(tx.hash)}` });
      await loadChainState();
    } catch (error) {
      setClaimState({
        pending: false,
        message: error?.shortMessage || error?.message || "Claim failed.",
      });
    }
  }, [loadChainState]);

  const accessState =
    contractState !== "v2"
      ? "Legacy / staged"
      : !walletAddress
        ? "Wallet required"
        : walletSlot?.enabled
          ? "Verified"
          : walletSlot
            ? "Slot disabled"
            : "No assigned slot";

  return (
    <section className={`moderator-center biggi-skin${compact ? " is-compact" : ""}`}>
      <div className="moderator-center__surface">
        <header className="moderator-center__header">
          <div />
          <div className="moderator-center__headline">
            <p className="moderator-center__eyebrow">Moderator Workspace</p>
            <h2 className="moderator-center__title">Moderator Center</h2>
            <p className="moderator-center__subtitle">
              Verified paid-ticket referrals, weekly weights, and pull claims.
            </p>
          </div>
          <div className="moderator-center__header-side">
            <div className="moderator-center__header-meta">
              <span className="moderator-center__chip">Polygon on-chain</span>
              <span className="moderator-center__chip moderator-center__chip--cyan">
                {contractState === "v2" ? "V2" : "Legacy"}
              </span>
            </div>
            <WalletConnectButton
              walletAddress={walletAddress}
              onConnectMetaMask={onConnectMetaMask}
              onConnectWalletConnect={onConnectWalletConnect}
            />
          </div>
        </header>

        <div className="moderator-center__hero">
          <article className="moderator-center__hero-card">
            <span className="moderator-center__hero-label">Access</span>
            <strong className="moderator-center__hero-value">{accessState}</strong>
            <span className="moderator-center__hero-hint">Payout wallet identity</span>
          </article>
          <article className="moderator-center__hero-card">
            <span className="moderator-center__hero-label">Current slot</span>
            <strong className="moderator-center__hero-value">
              {walletSlot ? `Slot ${walletSlot.slotId}` : "--"}
            </strong>
            <span className="moderator-center__hero-hint">
              {activeSlots.length} active / 10 total
            </span>
          </article>
          <article className="moderator-center__hero-card">
            <span className="moderator-center__hero-label">Contract</span>
            <strong className="moderator-center__hero-value mono">
              {shortValue(cfg.v2ContractAddress)}
            </strong>
            <span className="moderator-center__hero-hint">
              {paused == null ? "Status unavailable" : paused ? "Paused" : "Active"}
            </span>
          </article>
          <article className="moderator-center__hero-card">
            <span className="moderator-center__hero-label">Readiness</span>
            <strong className="moderator-center__hero-value">
              {operationallyReady == null ? "--" : operationallyReady ? "Ready" : "Blocked"}
            </strong>
            <span className="moderator-center__hero-hint">RPC {rpcLabel(cfg.chainRpc)}</span>
          </article>
        </div>

        <div className="view-tabs moderator-center__tabs" role="tablist">
          {[
            { id: "moderator", label: "Moderator" },
            { id: "tools", label: "Tools" },
            ...(ownerConnected ? [{ id: "admin", label: "Admin" }] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab-button${activeTab === tab.id ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "moderator" && (
          <div className="moderator-center__stack">
            {chainError ? <div className="moderator-center__error">{chainError}</div> : null}
            {contractState === "v2" && walletSlot ? (
              <ModeratorPanel
                walletAddress={walletAddress}
                baseUrl={baseUrl}
                weekId={weekId}
                onWeekChange={setWeekId}
                onRefreshChain={loadChainState}
                chainLoading={chainLoading}
                slotInfo={walletSlot}
                weekStats={weekStats}
                globalUniquePerWeek={globalUnique}
                claimable={claimable}
                onClaim={handleClaim}
                claimState={claimState}
                compact={compact}
              />
            ) : (
              <section className="moderator-center__card">
                <div className="moderator-center__card-head">
                  <h3>{contractState === "v2" ? "Wallet not assigned" : "V2 not active"}</h3>
                  <span className="moderator-center__chip moderator-center__chip--warn">
                    {chainLoading ? "Checking" : accessState}
                  </span>
                </div>
                <div className="moderator-center__statlines">
                  <div className="moderator-center__statline">
                    <span>Connected wallet</span>
                    <strong className="mono">{shortValue(walletAddress)}</strong>
                  </div>
                  <div className="moderator-center__statline">
                    <span>Configured V2</span>
                    <strong className="mono">{shortValue(cfg.v2ContractAddress)}</strong>
                  </div>
                  <div className="moderator-center__statline">
                    <span>Owner</span>
                    <strong className="mono">{shortValue(cfg.ownerAddress)}</strong>
                  </div>
                </div>
                <div className="moderator-center__actions">
                  <button
                    type="button"
                    className="biggi-btn biggi-btn--ghost"
                    disabled={chainLoading}
                    onClick={loadChainState}
                  >
                    {chainLoading ? "Checking..." : "Refresh"}
                  </button>
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === "tools" && (
          <div className="moderator-center__grid moderator-center__grid--wide">
            <WeeklySummaryBuilder onEntries={setWeeklyEntries} />
            <MerkleTool entries={weeklyEntries} />
          </div>
        )}

        {activeTab === "admin" && ownerConnected ? (
          <AdminDashboard walletAddress={walletAddress} onTx={onTx} />
        ) : null}
      </div>
    </section>
  );
}
