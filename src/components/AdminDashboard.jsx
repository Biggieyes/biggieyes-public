// src/components/AdminDashboard.jsx
import * as React from "react";
import {
  getModeratorsRewardsContract,
  getConfig,
  isOwner,
  parseWei,
} from "../utils/eth";

const shortAddr = (addr) => {
  if (!addr) return "--";
  const s = String(addr);
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
};

export default function AdminDashboard({ walletAddress, onTx }) {
  const [slotId, setSlotId] = React.useState("");
  const [slotWallet, setSlotWallet] = React.useState("");
  const [revokeSlotId, setRevokeSlotId] = React.useState("");
  const [weekNumber, setWeekNumber] = React.useState("");
  const [merkleRoot, setMerkleRoot] = React.useState("");
  const [totalAmount, setTotalAmount] = React.useState("");
  const [fundAmount, setFundAmount] = React.useState("");
  const [slots, setSlots] = React.useState([]);
  const [status, setStatus] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const cfg = getConfig();
  const ownerOk = isOwner(walletAddress);

  const callFirst = async (contract, methods, args = [], overrides = {}) => {
    for (const name of methods) {
      if (typeof contract[name] === "function") {
        return contract[name](...args, overrides);
      }
    }
    throw new Error("Function not found in ABI.");
  };

  const loadSlots = async () => {
    try {
      setStatus("Loading slots...");
      const contract = await getModeratorsRewardsContract({ signer: false });
      const rows = [];
      for (let i = 0; i < 10; i += 1) {
        let addr = "";
        try {
          addr = await callFirst(
            contract,
            ["getSlotAddress", "slotAddress", "slotToAddress", "slotWallet"],
            [i],
          );
        } catch {
          addr = "";
        }
        rows.push({ slotId: i, wallet: addr });
      }
      setSlots(rows);
      setStatus("Slots loaded.");
    } catch (err) {
      setStatus("Unable to load slots.");
    }
  };

  const handleSetSlot = async () => {
    try {
      setPending(true);
      const contract = await getModeratorsRewardsContract({ signer: true });
      const tx = await callFirst(
        contract,
        ["setSlotAddress", "setSlotWallet", "setSlot"],
        [Number(slotId), slotWallet],
      );
      onTx?.({
        status: "pending",
        txHash: tx.hash,
        message: "Slot update submitted.",
      });
      await tx.wait();
      onTx?.({
        status: "confirmed",
        txHash: tx.hash,
        message: "Slot updated.",
      });
      setStatus("Slot updated.");
    } catch (err) {
      setStatus("Slot update failed.");
    } finally {
      setPending(false);
    }
  };

  const handleRevokeSlot = async () => {
    try {
      setPending(true);
      const contract = await getModeratorsRewardsContract({ signer: true });
      const tx = await callFirst(
        contract,
        ["revokeSlot"],
        [Number(revokeSlotId)],
      );
      onTx?.({
        status: "pending",
        txHash: tx.hash,
        message: "Slot revoke submitted.",
      });
      await tx.wait();
      onTx?.({
        status: "confirmed",
        txHash: tx.hash,
        message: "Slot revoked.",
      });
      setStatus("Slot revoked.");
    } catch (err) {
      setStatus("Slot revoke failed.");
    } finally {
      setPending(false);
    }
  };

  const handleDistribute = async () => {
    try {
      setPending(true);
      const totalWei = parseWei(totalAmount || "0");
      const contract = await getModeratorsRewardsContract({ signer: true });
      const tx = await callFirst(
        contract,
        ["distributeWeek"],
        [Number(weekNumber), merkleRoot, totalWei],
        { value: totalWei },
      );
      onTx?.({
        status: "pending",
        txHash: tx.hash,
        message: "Distribution submitted.",
      });
      await tx.wait();
      onTx?.({
        status: "confirmed",
        txHash: tx.hash,
        message: "Distribution confirmed.",
      });
      setStatus("Distribution confirmed.");
    } catch (err) {
      setStatus("Distribution failed.");
    } finally {
      setPending(false);
    }
  };

  const handleFund = async () => {
    try {
      setPending(true);
      const valueWei = parseWei(fundAmount || "0");
      const contract = await getModeratorsRewardsContract({ signer: true });
      const tx = await callFirst(contract, ["fund"], [], { value: valueWei });
      onTx?.({
        status: "pending",
        txHash: tx.hash,
        message: "Funding submitted.",
      });
      await tx.wait();
      onTx?.({
        status: "confirmed",
        txHash: tx.hash,
        message: "Contract funded.",
      });
      setStatus("Contract funded.");
    } catch (err) {
      setStatus("Funding failed.");
    } finally {
      setPending(false);
    }
  };

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
      </div>

      {!cfg.contractAddress && (
        <div className="moderator-center__error">
          ModeratorsRewards contract address is missing.
        </div>
      )}
      {!cfg.abiReady && (
        <div className="moderator-center__error">
          ABI is missing in <code>src/abis/ModeratorsRewards.json</code>.
        </div>
      )}

      <div className="moderator-center__field">
        <label>Slot ID</label>
        <input
          value={slotId}
          onChange={(e) => setSlotId(e.target.value)}
          placeholder="0-9"
        />
      </div>
      <div className="moderator-center__field">
        <label>Slot wallet</label>
        <input
          value={slotWallet}
          onChange={(e) => setSlotWallet(e.target.value)}
          placeholder="0x..."
        />
      </div>
      <div className="moderator-center__actions">
        <button
          type="button"
          className="biggi-btn biggi-btn--accent"
          disabled={pending || !ownerOk}
          onClick={handleSetSlot}
        >
          Set slot
        </button>
        <button
          type="button"
          className="biggi-btn biggi-btn--ghost"
          onClick={loadSlots}
        >
          Load slots
        </button>
      </div>

      {slots.length > 0 && (
        <div className="moderator-center__table">
          <div className="moderator-center__table-head">
            <span>Slot</span>
            <span>Wallet</span>
            <span>Status</span>
          </div>
          {slots.map((row) => (
            <div key={row.slotId} className="moderator-center__table-row">
              <span className="mono">{row.slotId}</span>
              <span className="mono">{shortAddr(row.wallet)}</span>
              <span className={row.wallet ? "ok" : "muted"}>
                {row.wallet ? "Active" : "Empty"}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="moderator-center__divider" />

      <div className="moderator-center__field">
        <label>Revoke slot</label>
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
          Revoke slot
        </button>
      </div>

      <div className="moderator-center__divider" />

      <div className="moderator-center__field">
        <label>Week</label>
        <input
          value={weekNumber}
          onChange={(e) => setWeekNumber(e.target.value)}
          placeholder="e.g. 2025-W12"
        />
      </div>
      <div className="moderator-center__field">
        <label>Merkle root</label>
        <input
          value={merkleRoot}
          onChange={(e) => setMerkleRoot(e.target.value)}
          placeholder="0x..."
        />
      </div>
      <div className="moderator-center__field">
        <label>Total amount (POL)</label>
        <input
          value={totalAmount}
          onChange={(e) => setTotalAmount(e.target.value)}
          placeholder="e.g. 12.5"
        />
      </div>
      <div className="moderator-center__actions">
        <button
          type="button"
          className="biggi-btn biggi-btn--accent"
          disabled={pending || !ownerOk}
          onClick={handleDistribute}
        >
          Distribute week
        </button>
      </div>

      <div className="moderator-center__divider" />

      <div className="moderator-center__field">
        <label>Fund contract (POL)</label>
        <input
          value={fundAmount}
          onChange={(e) => setFundAmount(e.target.value)}
          placeholder="e.g. 10"
        />
      </div>
      <div className="moderator-center__actions">
        <button
          type="button"
          className="biggi-btn biggi-btn--ghost"
          disabled={pending || !ownerOk}
          onClick={handleFund}
        >
          Send funds
        </button>
      </div>

      {status && <div className="muted">{status}</div>}
    </section>
  );
}
