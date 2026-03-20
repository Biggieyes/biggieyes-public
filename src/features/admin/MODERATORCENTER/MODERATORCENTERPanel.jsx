// src/panels/COMMUNITYCENTER/MODERATORCENTER/MODERATORCENTERPanel.jsx
import * as React from "react";
import { BrowserProvider } from "ethers";
import WalletConnectButton from "@/components/WalletConnectButton";
import ModeratorLogin from "@/components/ModeratorLogin";
import ModeratorPanel from "@/components/ModeratorPanel";
import ReferralList from "@/components/ReferralList";
import WeeklySummaryBuilder from "@/components/WeeklySummaryBuilder";
import MerkleTool from "@/components/MerkleTool";
import { supabase, supabaseReady } from "@/supabaseClient";
import { getNonce, moderatorLogin, requestPasswordReset } from "@/services/api";
import {
  getConfig,
  getModeratorsREWARDSContract,
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
}) {
  const [activeTab, setActiveTab] = React.useState("moderator");
  const [moderatorSession, setModeratorSession] = React.useState(null);
  const [modLoading, setModLoading] = React.useState(false);
  const [modError, setModError] = React.useState("");
  const [moderatorStats, setModeratorStats] = React.useState({});
  const [referrals, setReferrals] = React.useState([]);
  const [weeklyEntries, setWeeklyEntries] = React.useState([]);
  const [weekId, setWeekId] = React.useState(() => {
    const now = Date.now();
    return String(Math.floor(now / WEEK_MS));
  });
  const [chainSlotInfo, setChainSlotInfo] = React.useState(null);
  const [chainWeekStats, setChainWeekStats] = React.useState(null);
  const [globalUnique, setGlobalUnique] = React.useState(null);
  const [chainLoading, setChainLoading] = React.useState(false);
  const [chainError, setChainError] = React.useState("");

  const cfg = getConfig();
  const baseUrl = React.useMemo(
    () => (typeof window !== "undefined" ? window.location.origin : ""),
    [],
  );
  const accessState = moderatorSession ? "Signed in" : "Password required";
  const slotSummary = moderatorSession?.slotId != null ? `Slot ${moderatorSession.slotId}` : "No session";
  const dataMode = supabaseReady ? "On-chain + Supabase" : "On-chain only";

  React.useEffect(() => {
    setModError("");
    setChainError("");
  }, [walletAddress]);

  const loadModeratorData = React.useCallback(async (slotId) => {
    if (!supabaseReady) {
      setModError("Supabase is not configured.");
      return;
    }
    if (slotId == null || slotId === "") return;

    setModError("");
    try {
      const { data, error } = await supabase
        .from("referrals")
        .select("wallet,first_seen,purchased,slot_id")
        .eq("slot_id", slotId)
        .order("first_seen", { ascending: false });

      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      const mapped = rows.map((row) => ({
        wallet: row.wallet,
        firstSeen: row.first_seen,
        purchased: Boolean(row.purchased),
      }));

      const uniqueCount = mapped.length;
      const purchasesCount = mapped.filter((r) => r.purchased).length;
      const weekAgo = Date.now() - WEEK_MS;
      const isInWeek = (ts) => {
        const t = Date.parse(ts);
        return Number.isFinite(t) && t >= weekAgo;
      };
      const uniqueThisWeek = mapped.filter((r) => isInWeek(r.firstSeen)).length;
      const purchasesThisWeek = mapped.filter(
        (r) => r.purchased && isInWeek(r.firstSeen),
      ).length;

      setModeratorStats((prev) => ({
        ...prev,
        slotId,
        uniqueCount,
        purchasesCount,
        uniqueThisWeek,
        purchasesThisWeek,
      }));
      setReferrals(mapped);
    } catch {
      setModError("Failed to load data from Supabase.");
    }
  }, []);

  const signPayload = async (payload) => {
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("Wallet provider is not available.");
    }
    await window.ethereum
      .request?.({ method: "eth_requestAccounts" })
      .catch(() => {});
    const provider = new BrowserProvider(window.ethereum, "any");
    const signer = await provider.getSigner();
    return signer.signMessage(payload);
  };

  const handleModeratorLogin = async (password) => {
    setModLoading(true);
    setModError("");
    try {
      if (!password) throw new Error("Enter password.");

      const passwordPayload = {
        password,
        secret: password,
        slotSecret: password,
      };

      let session = null;
      try {
        session = await moderatorLogin(passwordPayload);
      } catch (passwordOnlyError) {
        if (!walletAddress) throw passwordOnlyError;
        const nonceRes = await getNonce(walletAddress);
        const nonce = nonceRes?.nonce;
        const timestamp = Date.now();
        const payload = `${nonce}|${walletAddress}|${timestamp}`;
        const signature = await signPayload(payload);
        session = await moderatorLogin({
          ...passwordPayload,
          address: walletAddress,
          signature,
          timestamp,
        });
      }

      setModeratorSession(session);
      setModeratorStats({
        slotId: session?.slotId,
        payoutWallet: session?.payoutWallet,
        strikes: session?.strikes,
      });
      await loadModeratorData(session?.slotId);
      await loadChainStats(session?.slotId, weekId);
    } catch (err) {
      setModError(err?.message || "Login failed.");
    } finally {
      setModLoading(false);
    }
  };

  const loadChainStats = React.useCallback(
    async (slotId, week) => {
      if (slotId == null || slotId === "") return;
      setChainLoading(true);
      setChainError("");
      try {
        const contract = await getModeratorsREWARDSContract({ signer: false });
        const [slotInfo, weekStats, globalUniqueRes] = await Promise.all([
          readSlotInfo(contract, slotId).catch(() => null),
          readWeekStats(contract, week, slotId).catch(() => null),
          contract.globalUniquePerWeek?.().catch(() => null),
        ]);
        setChainSlotInfo(slotInfo);
        setChainWeekStats(weekStats);
        if (typeof globalUniqueRes === "boolean") {
          setGlobalUnique(globalUniqueRes);
        }
      } catch (err) {
        setChainError("Failed to load on-chain stats.");
      } finally {
        setChainLoading(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    if (moderatorSession?.slotId != null && weekId) {
      loadChainStats(moderatorSession.slotId, weekId);
    }
  }, [moderatorSession?.slotId, weekId, loadChainStats]);

  const handleRequestReset = async () => {
    try {
      if (!walletAddress) throw new Error("Connect your wallet first.");
      await requestPasswordReset({ address: walletAddress });
    } catch (err) {
      setModError(err?.message || "Reset failed.");
    }
  };

  return (
    <section
      className={`moderator-center biggi-skin${compact ? " is-compact" : ""}`}
    >
      <div className="moderator-center__surface">
        <header className="moderator-center__header">
          <div />
          <div className="moderator-center__headline">
            <p className="moderator-center__eyebrow">Moderator Workspace</p>
            <h2 className="moderator-center__title">Moderator Center</h2>
            <p className="moderator-center__subtitle">
              Password-based access for moderator slot health, referrals, and
              weekly checks. Owner controls now live only in the main Admin
              Panel.
            </p>
          </div>
          <div className="moderator-center__header-side">
            <div className="moderator-center__header-meta">
              <span className="moderator-center__chip">{dataMode}</span>
              <span className="moderator-center__chip moderator-center__chip--cyan">
                Moderator only
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
            <span className="moderator-center__hero-hint">
              Login is now driven by the moderator password.
            </span>
          </article>
          <article className="moderator-center__hero-card">
            <span className="moderator-center__hero-label">Current slot</span>
            <strong className="moderator-center__hero-value">{slotSummary}</strong>
            <span className="moderator-center__hero-hint">
              Wallet connection is optional for extra on-chain context.
            </span>
          </article>
          <article className="moderator-center__hero-card">
            <span className="moderator-center__hero-label">Contract</span>
            <strong className="moderator-center__hero-value mono">
              {shortValue(cfg.contractAddress)}
            </strong>
            <span className="moderator-center__hero-hint">
              Owner: {shortValue(cfg.ownerAddress, 6, 4)}
            </span>
          </article>
          <article className="moderator-center__hero-card">
            <span className="moderator-center__hero-label">RPC</span>
            <strong className="moderator-center__hero-value">
              {rpcLabel(cfg.chainRpc)}
            </strong>
            <span className="moderator-center__hero-hint">
              Tools tab keeps weekly summary and Merkle export helpers.
            </span>
          </article>
        </div>

        <div className="view-tabs moderator-center__tabs" role="tablist">
          {[
            { id: "moderator", label: "Moderator" },
            { id: "tools", label: "Tools" },
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
            {!moderatorSession ? (
              <div className="moderator-center__grid moderator-center__grid--wide">
                <ModeratorLogin
                  onLogin={handleModeratorLogin}
                  loading={modLoading}
                  error={modError}
                />
                <section className="moderator-center__card">
                  <div className="moderator-center__card-head">
                    <h3>What you can do here</h3>
                    <span className="moderator-center__chip">Overview</span>
                  </div>
                  <p className="moderator-center__copy muted">
                    This screen is now reduced to the actual moderator workflow:
                    sign in, check your slot, copy your referral link, and watch
                    weekly results.
                  </p>
                  <div className="moderator-center__statlines">
                    <div className="moderator-center__statline">
                      <span>1. Sign in</span>
                      <strong>Password</strong>
                    </div>
                    <div className="moderator-center__statline">
                      <span>2. Review slot health</span>
                      <strong>On-chain status</strong>
                    </div>
                    <div className="moderator-center__statline">
                      <span>3. Share referral link</span>
                      <strong>Track visits and purchases</strong>
                    </div>
                    <div className="moderator-center__statline">
                      <span>Owner actions</span>
                      <strong>Main Admin Panel</strong>
                    </div>
                  </div>
                </section>
              </div>
            ) : (
              <>
                {modError ? (
                  <div className="moderator-center__error">{modError}</div>
                ) : null}
                <ModeratorPanel
                  stats={moderatorStats}
                  walletAddress={walletAddress}
                  baseUrl={baseUrl}
                  onRequestReset={handleRequestReset}
                  weekId={weekId}
                  onWeekChange={setWeekId}
                  onRefreshChain={() =>
                    loadChainStats(moderatorSession?.slotId, weekId)
                  }
                  chainLoading={chainLoading}
                  chainError={chainError}
                  slotInfo={chainSlotInfo}
                  weekStats={chainWeekStats}
                  globalUniquePerWeek={globalUnique}
                  compact={compact}
                />
                <ReferralList items={referrals} />
              </>
            )}
          </div>
        )}

        {activeTab === "tools" && (
          <div className="moderator-center__grid moderator-center__grid--wide">
            <div className="moderator-center__stack">
              <section className="moderator-center__card">
                <div className="moderator-center__card-head">
                  <h3>Support tools</h3>
                  <span className="moderator-center__chip moderator-center__chip--cyan">
                    Ops only
                  </span>
                </div>
                <p className="moderator-center__copy muted">
                  These helpers are for manual weekly exports and proof
                  generation. Slot configuration, password updates, and contract
                  writes are no longer mixed into this panel.
                </p>
              </section>
              <WeeklySummaryBuilder onEntries={setWeeklyEntries} />
            </div>
            <MerkleTool entries={weeklyEntries} />
          </div>
        )}
      </div>
    </section>
  );
}
