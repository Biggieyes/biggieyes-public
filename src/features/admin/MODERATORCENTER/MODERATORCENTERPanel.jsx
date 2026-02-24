// src/panels/COMMUNITYCENTER/MODERATORCENTER/MODERATORCENTERPanel.jsx
import * as React from "react";
import { BrowserProvider } from "ethers";
import WalletConnectButton from "@/components/WalletConnectButton";
import ModeratorLogin from "@/components/ModeratorLogin";
import ModeratorPanel from "@/components/ModeratorPanel";
import ReferralList from "@/components/ReferralList";
import AdminDashboard from "@/components/AdminDashboard";
import WeeklySummaryBuilder from "@/components/WeeklySummaryBuilder";
import MerkleTool from "@/components/MerkleTool";
import TransactionsModal from "@/components/TransactionsModal";
import { supabase, supabaseReady } from "@/supabaseClient";
import {
  getNonce,
  moderatorLogin,
  adminLogin,
  requestPasswordReset,
} from "@/services/api";
import {
  getConfig,
  isOwner,
  getModeratorsREWARDSContract,
  readSlotInfo,
  readWeekStats,
} from "@/utils/eth";
import "./MODERATORCENTERPanel.css";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function MODERATORCENTERPanel({
  compact = false,
  walletAddress = "",
  onConnectMetaMask,
  onConnectWalletConnect,
}) {
  const [activeTab, setActiveTab] = React.useState("moderator");
  const [moderatorSession, setModeratorSession] = React.useState(null);
  const [adminSession, setAdminSession] = React.useState(null);
  const [modLoading, setModLoading] = React.useState(false);
  const [modError, setModError] = React.useState("");
  const [adminError, setAdminError] = React.useState("");
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
  const [txModal, setTxModal] = React.useState({
    open: false,
    status: "",
    txHash: "",
    message: "",
  });

  const cfg = getConfig();
  const baseUrl = React.useMemo(
    () => (typeof window !== "undefined" ? window.location.origin : ""),
    [],
  );

  React.useEffect(() => {
    setModeratorSession(null);
    setAdminSession(null);
    setModError("");
    setAdminError("");
    setModeratorStats({});
    setReferrals([]);
    setChainSlotInfo(null);
    setChainWeekStats(null);
    setGlobalUnique(null);
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

  const handleModeratorLogin = async (secret) => {
    setModLoading(true);
    setModError("");
    try {
      if (!walletAddress) throw new Error("Connect your wallet first.");
      if (!secret) throw new Error("Enter slot secret.");
      const nonceRes = await getNonce(walletAddress);
      const nonce = nonceRes?.nonce;
      const timestamp = Date.now();
      const payload = `${nonce}|${walletAddress}|${timestamp}`;
      const signature = await signPayload(payload);
      const session = await moderatorLogin({
        address: walletAddress,
        signature,
        slotSecret: secret,
        timestamp,
      });
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

  const handleAdminLogin = async () => {
    setAdminError("");
    try {
      if (!walletAddress) throw new Error("Connect your wallet first.");
      const nonceRes = await getNonce(walletAddress);
      const nonce = nonceRes?.nonce;
      const timestamp = Date.now();
      const payload = `${nonce}|${walletAddress}|${timestamp}`;
      const signature = await signPayload(payload);
      const session = await adminLogin({
        address: walletAddress,
        signature,
        timestamp,
      });
      setAdminSession(session || { ok: true });
    } catch (err) {
      setAdminError(err?.message || "Owner login failed.");
    }
  };

  const handleRequestReset = async () => {
    try {
      if (!walletAddress) throw new Error("Connect your wallet first.");
      await requestPasswordReset({ address: walletAddress });
    } catch (err) {
      setModError(err?.message || "Reset failed.");
    }
  };

  const onTx = (payload) => {
    setTxModal({ open: true, ...payload });
  };

  const showAdmin = isOwner(walletAddress) && adminSession;

  return (
    <section
      className={`moderator-center biggi-skin${compact ? " is-compact" : ""}`}
    >
      <header className="moderator-center__header">
        <div>
          <h2>Moderator Center</h2>
          <p className="muted">
            On-chain Moderator Center + Supabase referral dashboard.
          </p>
        </div>
        <WalletConnectButton
          walletAddress={walletAddress}
          onConnectMetaMask={onConnectMetaMask}
          onConnectWalletConnect={onConnectWalletConnect}
        />
      </header>

      <div className="moderator-center__meta">
        <div>
          <span className="muted">Contract</span>
          <strong className="mono">{cfg.contractAddress || "--"}</strong>
        </div>
        <div>
          <span className="muted">RPC</span>
          <strong className="mono">{cfg.chainRpc || "--"}</strong>
        </div>
        <div>
          <span className="muted">Owner</span>
          <strong className="mono">{cfg.ownerAddress || "--"}</strong>
        </div>
      </div>

      <div className="view-tabs moderator-center__tabs" role="tablist">
        {[
          { id: "moderator", label: "Moderator" },
          { id: "admin", label: "Admin" },
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
        <div className="moderator-center__grid">
          {!moderatorSession ? (
            <ModeratorLogin
              walletAddress={walletAddress}
              onLogin={handleModeratorLogin}
              onConnect={onConnectMetaMask}
              loading={modLoading}
              error={modError}
            />
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

      {activeTab === "admin" && (
        <div className="moderator-center__grid moderator-center__grid--wide">
          {!showAdmin ? (
            <section className="moderator-center__card">
              <h3>Owner login</h3>
              <p className="muted">
                Admin tools require signing in with the owner wallet.
              </p>
              {adminError && (
                <div className="moderator-center__error">{adminError}</div>
              )}
              <div className="moderator-center__actions">
                <button
                  type="button"
                  className="biggi-btn biggi-btn--accent"
                  onClick={handleAdminLogin}
                >
                  Sign in as owner
                </button>
              </div>
            </section>
          ) : (
            <>
              <AdminDashboard walletAddress={walletAddress} onTx={onTx} />
              <div className="moderator-center__stack">
                <WeeklySummaryBuilder onEntries={setWeeklyEntries} />
                <MerkleTool entries={weeklyEntries} />
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "tools" && (
        <div className="moderator-center__grid moderator-center__grid--wide">
          <WeeklySummaryBuilder onEntries={setWeeklyEntries} />
          <MerkleTool entries={weeklyEntries} />
        </div>
      )}

      <TransactionsModal
        open={txModal.open}
        status={txModal.status}
        txHash={txModal.txHash}
        message={txModal.message}
        onClose={() =>
          setTxModal({ open: false, status: "", txHash: "", message: "" })
        }
      />
    </section>
  );
}
