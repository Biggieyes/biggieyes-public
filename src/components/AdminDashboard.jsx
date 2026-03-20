// src/components/AdminDashboard.jsx
import * as React from "react";
import { ZeroAddress } from "ethers";
import {
  getModeratorsREWARDSContract,
  getConfig,
  isOwner,
  parseWei,
  formatWei,
  normalizeAddress,
  toBytes32,
  readSlotInfo,
} from "../utils/eth";
import "../features/admin/MODERATORCENTER/MODERATORCENTERPanel.css";

const ZERO_ADDR = ZeroAddress || "0x0000000000000000000000000000000000000000";

const shortAddr = (addr) => {
  if (!addr) return "--";
  const s = String(addr);
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
};

const shortHash = (hash) => {
  if (!hash) return "--";
  const s = String(hash);
  return s.length > 12 ? `${s.slice(0, 8)}...${s.slice(-6)}` : s;
};

const toNum = (v) => {
  try {
    if (typeof v === "bigint") return Number(v);
    return Number(v);
  } catch {
    return null;
  }
};

export default function AdminDashboard({ walletAddress, onTx }) {
  const [slotId, setSlotId] = React.useState("");
  const [slotEnabled, setSlotEnabled] = React.useState(true);
  const [slotLeader, setSlotLeader] = React.useState(false);
  const [slotPayout, setSlotPayout] = React.useState("");
  const [slotReferral, setSlotReferral] = React.useState("");
  const [slotPassword, setSlotPassword] = React.useState("");
  const [revokeSlotId, setRevokeSlotId] = React.useState("");

  const [leaderCoefBps, setLeaderCoefBps] = React.useState("");
  const [moderatorCoefBps, setModeratorCoefBps] = React.useState("");
  const [saleBoostBps, setSaleBoostBps] = React.useState("");
  const [globalUnique, setGlobalUnique] = React.useState(false);

  const [milestone100, setMilestone100] = React.useState("");
  const [milestone500, setMilestone500] = React.useState("");
  const [milestone1000, setMilestone1000] = React.useState("");

  const [multiCollection, setMultiCollection] = React.useState("");
  const [reporterAddress, setReporterAddress] = React.useState("");
  const [reporterEnabled, setReporterEnabled] = React.useState(false);

  const [allocationAmount, setAllocationAmount] = React.useState("");
  const [withdrawAmount, setWithdrawAmount] = React.useState("");

  const [totalSlots, setTotalSlots] = React.useState(null);
  const [contractBalance, setContractBalance] = React.useState(null);
  const [slots, setSlots] = React.useState([]);
  const [status, setStatus] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const cfg = getConfig();
  const ownerOk = isOwner(walletAddress);

  const loadConfig = React.useCallback(async () => {
    try {
      const contract = await getModeratorsREWARDSContract({ signer: false });
      const [
        totalSlotsRaw,
        leaderBpsRaw,
        moderatorBpsRaw,
        saleBoostRaw,
        globalUniqueRaw,
        m100Raw,
        m500Raw,
        m1000Raw,
        mcRaw,
      ] = await Promise.all([
        contract.TOTAL_SLOTS?.().catch(() => null),
        contract.leaderCoefBps?.().catch(() => null),
        contract.moderatorCoefBps?.().catch(() => null),
        contract.saleBoostBpsPerTicket?.().catch(() => null),
        contract.globalUniquePerWeek?.().catch(() => null),
        contract.milestone100?.().catch(() => null),
        contract.milestone500?.().catch(() => null),
        contract.milestone1000?.().catch(() => null),
        contract.multiCollection?.().catch(() => null),
      ]);

      if (totalSlotsRaw != null) setTotalSlots(toNum(totalSlotsRaw));
      if (leaderBpsRaw != null) setLeaderCoefBps(String(leaderBpsRaw));
      if (moderatorBpsRaw != null) setModeratorCoefBps(String(moderatorBpsRaw));
      if (saleBoostRaw != null) setSaleBoostBps(String(saleBoostRaw));
      if (typeof globalUniqueRaw === "boolean")
        setGlobalUnique(globalUniqueRaw);
      if (m100Raw != null) {
        const v = formatWei(m100Raw);
        setMilestone100(v === "--" ? "" : v);
      }
      if (m500Raw != null) {
        const v = formatWei(m500Raw);
        setMilestone500(v === "--" ? "" : v);
      }
      if (m1000Raw != null) {
        const v = formatWei(m1000Raw);
        setMilestone1000(v === "--" ? "" : v);
      }
      if (mcRaw) setMultiCollection(String(mcRaw));

      const provider = contract.runner?.provider || contract.runner;
      const target = contract.target || contract.address;
      if (provider && target) {
        const bal = await provider.getBalance(target).catch(() => null);
        if (bal != null) setContractBalance(bal);
      }
    } catch (err) {
      setStatus("Failed to load contract config.");
    }
  }, []);

  const loadSlots = React.useCallback(async () => {
    try {
      setStatus("Loading slots...");
      const contract = await getModeratorsREWARDSContract({ signer: false });
      const count = Number.isFinite(totalSlots) ? totalSlots : 10;
      const rows = await Promise.all(
        Array.from({ length: count }, async (_, i) => {
          try {
            const info = await readSlotInfo(contract, i);
            return {
              slotId: i,
              enabled: info.enabled,
              isLeader: info.isLeader,
              payout: info.payout,
              referralHash: info.referralHash,
              cumulativeSales: info.cumulativeSales,
            };
          } catch {
            return { slotId: i };
          }
        }),
      );
      setSlots(rows);
      setStatus("Slots loaded.");
    } catch (err) {
      setStatus("Unable to load slots.");
    }
  }, [totalSlots]);

  const loadSlotIntoForm = React.useCallback(async () => {
    try {
      if (slotId === "") throw new Error("Enter slot ID.");
      const contract = await getModeratorsREWARDSContract({ signer: false });
      const info = await readSlotInfo(contract, slotId);
      setSlotEnabled(Boolean(info.enabled));
      setSlotLeader(Boolean(info.isLeader));
      setSlotPayout(info.payout || "");
    } catch (err) {
      setStatus(err?.message || "Failed to load slot info.");
    }
  }, [slotId]);

  React.useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleConfigureSlot = async () => {
    try {
      setPending(true);
      const contract = await getModeratorsREWARDSContract({ signer: true });
      const slot = Number(slotId);
      if (!Number.isFinite(slot)) throw new Error("Invalid slot ID.");
      const payout = slotPayout ? normalizeAddress(slotPayout) : ZERO_ADDR;
      const tx = await contract.configureSlot(
        slot,
        Boolean(slotEnabled),
        Boolean(slotLeader),
        payout,
      );
      onTx?.({
        status: "pending",
        txHash: tx.hash,
        message: "Slot configuration submitted.",
      });
      await tx.wait();
      onTx?.({
        status: "confirmed",
        txHash: tx.hash,
        message: "Slot updated.",
      });
      setStatus("Slot updated.");
      await loadSlots();
    } catch (err) {
      setStatus(err?.message || "Slot update failed.");
    } finally {
      setPending(false);
    }
  };

  const handleRevokeSlot = async () => {
    try {
      setPending(true);
      const contract = await getModeratorsREWARDSContract({ signer: true });
      const slot = Number(revokeSlotId);
      if (!Number.isFinite(slot)) throw new Error("Invalid slot ID.");
      const tx = await contract.configureSlot(slot, false, false, ZERO_ADDR);
      onTx?.({
        status: "pending",
        txHash: tx.hash,
        message: "Slot disabled.",
      });
      await tx.wait();
      onTx?.({
        status: "confirmed",
        txHash: tx.hash,
        message: "Slot disabled.",
      });
      setStatus("Slot disabled.");
      await loadSlots();
    } catch (err) {
      setStatus(err?.message || "Slot disable failed.");
    } finally {
      setPending(false);
    }
  };

  const handleSetReferralHash = async () => {
    try {
      setPending(true);
      const contract = await getModeratorsREWARDSContract({ signer: true });
      const slot = Number(slotId);
      if (!Number.isFinite(slot)) throw new Error("Invalid slot ID.");
      if (!slotReferral) throw new Error("Enter referral code or hash.");
      const hash = toBytes32(slotReferral);
      const tx = await contract.setReferralHash(slot, hash);
      onTx?.({
        status: "pending",
        txHash: tx.hash,
        message: "Referral hash update submitted.",
      });
      await tx.wait();
      onTx?.({
        status: "confirmed",
        txHash: tx.hash,
        message: "Referral hash updated.",
      });
      setStatus("Referral hash updated.");
      await loadSlots();
    } catch (err) {
      setStatus(err?.message || "Referral hash update failed.");
    } finally {
      setPending(false);
    }
  };

  const handleSetPasswordHash = async () => {
    try {
      setPending(true);
      const contract = await getModeratorsREWARDSContract({ signer: true });
      const slot = Number(slotId);
      if (!Number.isFinite(slot)) throw new Error("Invalid slot ID.");
      if (!slotPassword) throw new Error("Enter password.");
      const hash = toBytes32(slotPassword);
      const tx = await contract.setPasswordHash(slot, hash);
      onTx?.({
        status: "pending",
        txHash: tx.hash,
        message: "Password hash update submitted.",
      });
      await tx.wait();
      onTx?.({
        status: "confirmed",
        txHash: tx.hash,
        message: "Password hash updated.",
      });
      setStatus("Password hash updated.");
    } catch (err) {
      setStatus(err?.message || "Password hash update failed.");
    } finally {
      setPending(false);
    }
  };

  const handleSetCoefs = async () => {
    try {
      setPending(true);
      const contract = await getModeratorsREWARDSContract({ signer: true });
      const tx = await contract.setCoefs(
        Number(leaderCoefBps || 0),
        Number(moderatorCoefBps || 0),
        Number(saleBoostBps || 0),
      );
      onTx?.({
        status: "pending",
        txHash: tx.hash,
        message: "Coefficients update submitted.",
      });
      await tx.wait();
      onTx?.({
        status: "confirmed",
        txHash: tx.hash,
        message: "Coefficients updated.",
      });
      setStatus("Coefficients updated.");
      await loadConfig();
    } catch (err) {
      setStatus(err?.message || "Coefficient update failed.");
    } finally {
      setPending(false);
    }
  };

  const handleSetMilestones = async () => {
    try {
      setPending(true);
      const contract = await getModeratorsREWARDSContract({ signer: true });
      const tx = await contract.setMilestones(
        parseWei(milestone100 || "0"),
        parseWei(milestone500 || "0"),
        parseWei(milestone1000 || "0"),
      );
      onTx?.({
        status: "pending",
        txHash: tx.hash,
        message: "Milestones update submitted.",
      });
      await tx.wait();
      onTx?.({
        status: "confirmed",
        txHash: tx.hash,
        message: "Milestones updated.",
      });
      setStatus("Milestones updated.");
      await loadConfig();
    } catch (err) {
      setStatus(err?.message || "Milestones update failed.");
    } finally {
      setPending(false);
    }
  };

  const handleToggleGlobalUnique = async () => {
    try {
      setPending(true);
      const contract = await getModeratorsREWARDSContract({ signer: true });
      const tx = await contract.setGlobalUniquePerWeek(Boolean(globalUnique));
      onTx?.({
        status: "pending",
        txHash: tx.hash,
        message: "Global unique flag update submitted.",
      });
      await tx.wait();
      onTx?.({
        status: "confirmed",
        txHash: tx.hash,
        message: "Global unique flag updated.",
      });
      setStatus("Global unique flag updated.");
    } catch (err) {
      setStatus(err?.message || "Global unique update failed.");
    } finally {
      setPending(false);
    }
  };

  const handleSetReporter = async () => {
    try {
      setPending(true);
      const contract = await getModeratorsREWARDSContract({ signer: true });
      const reporter = normalizeAddress(reporterAddress);
      if (!reporter) throw new Error("Reporter address is required.");
      const tx = await contract.setReporter(reporter, Boolean(reporterEnabled));
      onTx?.({
        status: "pending",
        txHash: tx.hash,
        message: "Reporter update submitted.",
      });
      await tx.wait();
      onTx?.({
        status: "confirmed",
        txHash: tx.hash,
        message: "Reporter updated.",
      });
      setStatus("Reporter updated.");
    } catch (err) {
      setStatus(err?.message || "Reporter update failed.");
    } finally {
      setPending(false);
    }
  };

  const handleSetMultiCollection = async () => {
    try {
      setPending(true);
      const contract = await getModeratorsREWARDSContract({ signer: true });
      const mc = normalizeAddress(multiCollection);
      if (!mc) throw new Error("MultiCollection address is required.");
      const tx = await contract.setMultiCollection(mc);
      onTx?.({
        status: "pending",
        txHash: tx.hash,
        message: "MultiCollection update submitted.",
      });
      await tx.wait();
      onTx?.({
        status: "confirmed",
        txHash: tx.hash,
        message: "MultiCollection updated.",
      });
      setStatus("MultiCollection updated.");
      await loadConfig();
    } catch (err) {
      setStatus(err?.message || "MultiCollection update failed.");
    } finally {
      setPending(false);
    }
  };

  const handleNotifyAllocation = async () => {
    try {
      setPending(true);
      const contract = await getModeratorsREWARDSContract({ signer: true });
      const valueWei = parseWei(allocationAmount || "0");
      const tx = await contract.notifyAllocation({ value: valueWei });
      onTx?.({
        status: "pending",
        txHash: tx.hash,
        message: "Allocation submitted.",
      });
      await tx.wait();
      onTx?.({
        status: "confirmed",
        txHash: tx.hash,
        message: "Allocation received.",
      });
      setStatus("Allocation received.");
    } catch (err) {
      setStatus(err?.message || "Allocation failed.");
    } finally {
      setPending(false);
    }
  };

  const handleDistributeWeek = async () => {
    try {
      setPending(true);
      const contract = await getModeratorsREWARDSContract({ signer: true });
      const tx = await contract.distributeWeekRewards();
      onTx?.({
        status: "pending",
        txHash: tx.hash,
        message: "Weekly distribution submitted.",
      });
      await tx.wait();
      onTx?.({
        status: "confirmed",
        txHash: tx.hash,
        message: "Weekly distribution executed.",
      });
      setStatus("Weekly distribution executed.");
    } catch (err) {
      setStatus(err?.message || "Weekly distribution failed.");
    } finally {
      setPending(false);
    }
  };

  const handleWithdrawToOwner = async () => {
    try {
      setPending(true);
      const contract = await getModeratorsREWARDSContract({ signer: true });
      const valueWei = parseWei(withdrawAmount || "0");
      const tx = await contract.withdrawToOwner(valueWei);
      onTx?.({
        status: "pending",
        txHash: tx.hash,
        message: "Withdraw submitted.",
      });
      await tx.wait();
      onTx?.({
        status: "confirmed",
        txHash: tx.hash,
        message: "Withdraw completed.",
      });
      setStatus("Withdraw completed.");
    } catch (err) {
      setStatus(err?.message || "Withdraw failed.");
    } finally {
      setPending(false);
    }
  };

  const referralHashPreview = slotReferral ? toBytes32(slotReferral) : "";
  const passwordHashPreview = slotPassword ? toBytes32(slotPassword) : "";

  return (
    <section className="moderator-center__card">
      <h3>Owner overview</h3>
      <div className="moderator-center__notice">
        <div>
          <span className="muted">Owner wallet</span>
          <strong>{shortAddr(cfg.ownerAddress) || "--"}</strong>
        </div>
        <div>
          <span className="muted">Connected wallet</span>
          <strong>{shortAddr(walletAddress)}</strong>
        </div>
        <div>
          <span className="muted">Status</span>
          <strong>{ownerOk ? "Owner" : "No access"}</strong>
        </div>
        <div>
          <span className="muted">Total slots</span>
          <strong>{totalSlots != null ? totalSlots : "--"}</strong>
        </div>
        <div>
          <span className="muted">Contract balance</span>
          <strong className="mono">
            {contractBalance != null ? formatWei(contractBalance) : "--"} POL
          </strong>
        </div>
      </div>

      {!cfg.contractAddress && (
        <div className="moderator-center__error">
          Moderator Center contract address is missing.
        </div>
      )}
      {!cfg.abiReady && (
        <div className="moderator-center__error">
          ABI is missing in <code>src/config/abi/ModeratorCenter.json</code>.
        </div>
      )}

      <div className="moderator-center__divider" />

      <h3>Slot configuration</h3>
      <div className="moderator-center__field">
        <label>Slot ID</label>
        <input
          value={slotId}
          onChange={(e) => setSlotId(e.target.value)}
          placeholder="0-9"
        />
      </div>
      <div className="moderator-center__field">
        <label>Payout wallet</label>
        <input
          value={slotPayout}
          onChange={(e) => setSlotPayout(e.target.value)}
          placeholder="0x..."
        />
      </div>
      <div className="moderator-center__field moderator-center__field--inline">
        <label className="moderator-center__toggle">
          <input
            type="checkbox"
            checked={slotEnabled}
            onChange={(e) => setSlotEnabled(e.target.checked)}
          />
          Enabled
        </label>
        <label className="moderator-center__toggle">
          <input
            type="checkbox"
            checked={slotLeader}
            onChange={(e) => setSlotLeader(e.target.checked)}
          />
          Leader
        </label>
      </div>
      <div className="moderator-center__actions">
        <button
          type="button"
          className="biggi-btn biggi-btn--accent"
          disabled={pending || !ownerOk}
          onClick={handleConfigureSlot}
        >
          Configure slot
        </button>
        <button
          type="button"
          className="biggi-btn biggi-btn--ghost"
          onClick={loadSlotIntoForm}
        >
          Load slot info
        </button>
      </div>

      <div className="moderator-center__field">
        <label>Referral code or hash</label>
        <input
          value={slotReferral}
          onChange={(e) => setSlotReferral(e.target.value)}
          placeholder="string or 0x..."
        />
      </div>
      {referralHashPreview && (
        <div className="muted mono">Hash: {referralHashPreview}</div>
      )}
      <div className="moderator-center__actions">
        <button
          type="button"
          className="biggi-btn biggi-btn--ghost"
          disabled={pending || !ownerOk}
          onClick={handleSetReferralHash}
        >
          Set referral hash
        </button>
      </div>

      <div className="moderator-center__field">
        <label>Password (will be hashed)</label>
        <input
          type="password"
          value={slotPassword}
          onChange={(e) => setSlotPassword(e.target.value)}
          placeholder="secret"
        />
      </div>
      {passwordHashPreview && (
        <div className="muted mono">Hash: {passwordHashPreview}</div>
      )}
      <div className="moderator-center__actions">
        <button
          type="button"
          className="biggi-btn biggi-btn--ghost"
          disabled={pending || !ownerOk}
          onClick={handleSetPasswordHash}
        >
          Set password hash
        </button>
      </div>

      <div className="moderator-center__divider" />

      <h3>Slot overview</h3>
      <div className="moderator-center__actions">
        <button
          type="button"
          className="biggi-btn biggi-btn--ghost"
          onClick={loadSlots}
        >
          Load slots
        </button>
      </div>
      {slots.length > 0 && (
        <div className="moderator-center__table moderator-center__table--wide">
          <div className="moderator-center__table-head">
            <span>Slot</span>
            <span>Payout</span>
            <span>Enabled</span>
            <span>Leader</span>
            <span>Referral</span>
            <span>Sales</span>
          </div>
          {slots.map((row) => (
            <div key={row.slotId} className="moderator-center__table-row">
              <span className="mono">{row.slotId}</span>
              <span className="mono">{shortAddr(row.payout)}</span>
              <span className={row.enabled ? "ok" : "muted"}>
                {row.enabled ? "Yes" : "No"}
              </span>
              <span className={row.isLeader ? "ok" : "muted"}>
                {row.isLeader ? "Yes" : "No"}
              </span>
              <span className="mono">{shortHash(row.referralHash)}</span>
              <span className="mono">
                {row.cumulativeSales != null
                  ? String(row.cumulativeSales)
                  : "--"}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="moderator-center__divider" />

      <h3>Global config</h3>
      <div className="moderator-center__field">
        <label>Leader coef (bps)</label>
        <input
          value={leaderCoefBps}
          onChange={(e) => setLeaderCoefBps(e.target.value)}
          placeholder="e.g. 1500"
        />
      </div>
      <div className="moderator-center__field">
        <label>Moderator coef (bps)</label>
        <input
          value={moderatorCoefBps}
          onChange={(e) => setModeratorCoefBps(e.target.value)}
          placeholder="e.g. 600"
        />
      </div>
      <div className="moderator-center__field">
        <label>Sale boost per ticket (bps)</label>
        <input
          value={saleBoostBps}
          onChange={(e) => setSaleBoostBps(e.target.value)}
          placeholder="e.g. 50"
        />
      </div>
      <div className="moderator-center__actions">
        <button
          type="button"
          className="biggi-btn biggi-btn--accent"
          disabled={pending || !ownerOk}
          onClick={handleSetCoefs}
        >
          Update coefs
        </button>
      </div>

      <div className="moderator-center__field moderator-center__field--inline">
        <label className="moderator-center__toggle">
          <input
            type="checkbox"
            checked={globalUnique}
            onChange={(e) => setGlobalUnique(e.target.checked)}
          />
          Global unique per week
        </label>
      </div>
      <div className="moderator-center__actions">
        <button
          type="button"
          className="biggi-btn biggi-btn--ghost"
          disabled={pending || !ownerOk}
          onClick={handleToggleGlobalUnique}
        >
          Save global unique flag
        </button>
      </div>

      <div className="moderator-center__divider" />

      <h3>Milestones (POL)</h3>
      <div className="moderator-center__field">
        <label>Milestone 100</label>
        <input
          value={milestone100}
          onChange={(e) => setMilestone100(e.target.value)}
          placeholder="e.g. 1.25"
        />
      </div>
      <div className="moderator-center__field">
        <label>Milestone 500</label>
        <input
          value={milestone500}
          onChange={(e) => setMilestone500(e.target.value)}
          placeholder="e.g. 2.5"
        />
      </div>
      <div className="moderator-center__field">
        <label>Milestone 1000</label>
        <input
          value={milestone1000}
          onChange={(e) => setMilestone1000(e.target.value)}
          placeholder="e.g. 5"
        />
      </div>
      <div className="moderator-center__actions">
        <button
          type="button"
          className="biggi-btn biggi-btn--ghost"
          disabled={pending || !ownerOk}
          onClick={handleSetMilestones}
        >
          Update milestones
        </button>
      </div>

      <div className="moderator-center__divider" />

      <h3>Reporting + collection</h3>
      <div className="moderator-center__field">
        <label>Reporter address</label>
        <input
          value={reporterAddress}
          onChange={(e) => setReporterAddress(e.target.value)}
          placeholder="0x..."
        />
      </div>
      <div className="moderator-center__field moderator-center__field--inline">
        <label className="moderator-center__toggle">
          <input
            type="checkbox"
            checked={reporterEnabled}
            onChange={(e) => setReporterEnabled(e.target.checked)}
          />
          Reporter enabled
        </label>
      </div>
      <div className="moderator-center__actions">
        <button
          type="button"
          className="biggi-btn biggi-btn--ghost"
          disabled={pending || !ownerOk}
          onClick={handleSetReporter}
        >
          Set reporter
        </button>
      </div>

      <div className="moderator-center__field">
        <label>MultiCollection address</label>
        <input
          value={multiCollection}
          onChange={(e) => setMultiCollection(e.target.value)}
          placeholder="0x..."
        />
      </div>
      <div className="moderator-center__actions">
        <button
          type="button"
          className="biggi-btn biggi-btn--ghost"
          disabled={pending || !ownerOk}
          onClick={handleSetMultiCollection}
        >
          Update MultiCollection
        </button>
      </div>

      <div className="moderator-center__divider" />

      <h3>Allocations & payout</h3>
      <div className="moderator-center__field">
        <label>Notify allocation (POL)</label>
        <input
          value={allocationAmount}
          onChange={(e) => setAllocationAmount(e.target.value)}
          placeholder="e.g. 10"
        />
      </div>
      <div className="moderator-center__actions">
        <button
          type="button"
          className="biggi-btn biggi-btn--accent"
          disabled={pending || !ownerOk}
          onClick={handleNotifyAllocation}
        >
          Notify allocation
        </button>
        <button
          type="button"
          className="biggi-btn biggi-btn--ghost"
          disabled={pending || !ownerOk}
          onClick={handleDistributeWeek}
        >
          Distribute week rewards
        </button>
      </div>

      <div className="moderator-center__field">
        <label>Withdraw to owner (POL)</label>
        <input
          value={withdrawAmount}
          onChange={(e) => setWithdrawAmount(e.target.value)}
          placeholder="e.g. 5"
        />
      </div>
      <div className="moderator-center__actions">
        <button
          type="button"
          className="biggi-btn biggi-btn--ghost"
          disabled={pending || !ownerOk}
          onClick={handleWithdrawToOwner}
        >
          Withdraw
        </button>
      </div>

      <div className="moderator-center__divider" />

      <h3>Disable slot</h3>
      <div className="moderator-center__field">
        <label>Revoke slot ID</label>
        <input
          value={revokeSlotId}
          onChange={(e) => setRevokeSlotId(e.target.value)}
          placeholder="Slot ID"
        />
      </div>
      <div className="moderator-center__actions">
        <button
          type="button"
          className="biggi-btn biggi-btn--ghost"
          disabled={pending || !ownerOk}
          onClick={handleRevokeSlot}
        >
          Disable slot
        </button>
      </div>

      {status && <div className="muted">{status}</div>}
    </section>
  );
}
