import * as React from "react";
import {
  formatWei,
  getConfig,
  getModeratorCenterV2Contract,
  readSlotInfo,
  readWeekStats,
} from "@/utils/eth";

const sameAddress = (left, right) =>
  Boolean(left && right) && String(left).toLowerCase() === String(right).toLowerCase();

const shortValue = (value, start = 8, end = 6) => {
  if (!value) return "--";
  const text = String(value);
  return text.length <= start + end + 3
    ? text
    : `${text.slice(0, start)}...${text.slice(-end)}`;
};

const asText = (value) => (value == null ? "--" : String(value));

export default function AdminDashboard({ walletAddress = "", onTx }) {
  const [state, setState] = React.useState(null);
  const [slots, setSlots] = React.useState([]);
  const [contractMode, setContractMode] = React.useState("checking");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [action, setAction] = React.useState("");
  const [settleWeek, setSettleWeek] = React.useState("");
  const cfg = getConfig();

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const contract = await getModeratorCenterV2Contract({ signer: false });
      const ticketHub = await contract.ticketHub();
      const [
        owner,
        paused,
        ready,
        currentWeek,
        allocator,
        registeredChapterCount,
        leaderCoef,
        moderatorCoef,
        saleBoost,
        globalUnique,
        milestone100,
        milestone500,
        milestone1000,
        milestoneBudget,
        allocatedOutstanding,
        totalClaimable,
      ] = await Promise.all([
        contract.owner(),
        contract.paused(),
        contract.operationallyReady(),
        contract.currentWeek(),
        contract.multiCollection(),
        contract.registeredChapterCount(),
        contract.leaderCoefBps(),
        contract.moderatorCoefBps(),
        contract.saleBoostBpsPerTicket(),
        contract.globalUniquePerWeek(),
        contract.milestone100(),
        contract.milestone500(),
        contract.milestone1000(),
        contract.milestoneBudget(),
        contract.totalAllocatedOutstanding(),
        contract.totalClaimable(),
      ]);
      const slotRows = await Promise.all(
        Array.from({ length: 10 }, async (_, slotId) => {
          const [slot, week, weight, generation] = await Promise.all([
            readSlotInfo(contract, slotId),
            readWeekStats(contract, currentWeek, slotId).catch(() => null),
            contract.getWeekWeight(currentWeek, slotId).catch(() => null),
            contract.getSlotGeneration(slotId),
          ]);
          return { ...slot, slotId, week, weight, generation };
        }),
      );
      setState({
        contractAddress: cfg.v2ContractAddress,
        ticketHub,
        owner,
        paused,
        ready,
        currentWeek,
        allocator,
        registeredChapterCount,
        leaderCoef,
        moderatorCoef,
        saleBoost,
        globalUnique,
        milestone100,
        milestone500,
        milestone1000,
        milestoneBudget,
        allocatedOutstanding,
        totalClaimable,
      });
      setSlots(slotRows);
      setSettleWeek((current) => current || (Number(currentWeek) > 0 ? String(Number(currentWeek) - 1) : "0"));
      setContractMode("v2");
    } catch (loadError) {
      setState(null);
      setSlots([]);
      setContractMode("legacy");
      setError(
        loadError?.message?.includes("missing")
          ? loadError.message
          : "Configured address is not ModeratorCenter V2.",
      );
    } finally {
      setLoading(false);
    }
  }, [cfg.v2ContractAddress]);

  React.useEffect(() => {
    load();
  }, [load]);

  const runAction = React.useCallback(
    async (label, send) => {
      setAction(label);
      setError("");
      try {
        const contract = await getModeratorCenterV2Contract({ signer: true });
        const tx = await send(contract);
        await tx.wait();
        onTx?.({ message: `${label} confirmed`, txHash: tx.hash });
        await load();
      } catch (actionError) {
        setError(actionError?.shortMessage || actionError?.message || `${label} failed.`);
      } finally {
        setAction("");
      }
    },
    [load, onTx],
  );

  const isConnectedOwner = sameAddress(walletAddress, state?.owner);
  const enabledSlots = slots.filter((slot) => slot.enabled);
  const leaderCount = enabledSlots.filter((slot) => slot.isLeader).length;

  if (contractMode !== "v2") {
    return (
      <section className="moderator-center__card">
        <div className="moderator-center__card-head">
          <h3>ModeratorCenter V2</h3>
          <span className="moderator-center__chip moderator-center__chip--warn">
            {loading ? "Checking" : "Not active"}
          </span>
        </div>
        {error ? <div className="moderator-center__error">{error}</div> : null}
        <div className="moderator-center__statlines">
          <div className="moderator-center__statline">
            <span>Configured address</span>
            <strong className="mono">{shortValue(cfg.v2ContractAddress)}</strong>
          </div>
          <div className="moderator-center__statline">
            <span>Legacy address</span>
            <strong className="mono">{shortValue(cfg.contractAddress)}</strong>
          </div>
        </div>
        <div className="moderator-center__actions">
          <button type="button" className="biggi-btn biggi-btn--ghost" onClick={load}>
            Refresh
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="moderator-center__stack">
      {error ? <div className="moderator-center__error">{error}</div> : null}
      <div className="moderator-center__hero">
        {[
          ["State", state.paused ? "Paused" : "Active", state.ready ? "Ready" : "Blocked"],
          ["Slots", `${enabledSlots.length} / 10`, `${leaderCount} leader`],
          ["Outstanding", `${formatWei(state.allocatedOutstanding)} POL`, "Weekly pools"],
          ["Claimable", `${formatWei(state.totalClaimable)} POL`, "All payouts"],
        ].map(([label, value, hint]) => (
          <article key={label} className="moderator-center__stat-card">
            <div>
              <span className="moderator-center__stat-label">{label}</span>
              <strong className="moderator-center__stat-value">{value}</strong>
              <div className="moderator-center__stat-hint">{hint}</div>
            </div>
          </article>
        ))}
      </div>

      <div className="moderator-center__grid moderator-center__grid--wide">
        <section className="moderator-center__card">
          <div className="moderator-center__card-head">
            <h3>Configuration</h3>
            <span className="moderator-center__chip moderator-center__chip--cyan">
              V2
            </span>
          </div>
          <div className="moderator-center__statlines">
            {[
              ["Contract", shortValue(state.contractAddress)],
              ["Owner", shortValue(state.owner)],
              ["TicketHub", shortValue(state.ticketHub)],
              ["Allocator", shortValue(state.allocator)],
              ["Registered chapters", asText(state.registeredChapterCount)],
              ["Leader / moderator / boost", `${state.leaderCoef} / ${state.moderatorCoef} / ${state.saleBoost}`],
              ["Unique policy", state.globalUnique ? "Global" : "Per slot"],
              ["Milestones", `${formatWei(state.milestone100)} / ${formatWei(state.milestone500)} / ${formatWei(state.milestone1000)} POL`],
              ["Milestone budget", `${formatWei(state.milestoneBudget)} POL`],
            ].map(([label, value]) => (
              <div key={label} className="moderator-center__statline">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="moderator-center__card">
          <div className="moderator-center__card-head">
            <h3>Operations</h3>
            <span
              className={`moderator-center__chip ${
                isConnectedOwner
                  ? "moderator-center__chip--ok"
                  : "moderator-center__chip--warn"
              }`.trim()}
            >
              {isConnectedOwner ? "Owner connected" : "Read only"}
            </span>
          </div>
          <div className="moderator-center__actions">
            <button
              type="button"
              className="biggi-btn biggi-btn--ghost"
              disabled={!isConnectedOwner || Boolean(action) || state.paused}
              onClick={() => runAction("Pause", (contract) => contract.pause())}
            >
              {action === "Pause" ? "Pausing..." : "Pause"}
            </button>
            <button
              type="button"
              className="biggi-btn biggi-btn--ghost"
              disabled={!isConnectedOwner || Boolean(action) || !state.paused || !state.ready}
              onClick={() => runAction("Unpause", (contract) => contract.unpause())}
            >
              {action === "Unpause" ? "Activating..." : "Unpause"}
            </button>
            <button
              type="button"
              className="biggi-btn biggi-btn--ghost"
              disabled={loading}
              onClick={load}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
          <div className="moderator-center__field">
            <label>Week to settle</label>
            <input
              type="number"
              min="0"
              step="1"
              value={settleWeek}
              onChange={(event) => setSettleWeek(event.target.value)}
            />
          </div>
          <div className="moderator-center__actions">
            <button
              type="button"
              className="biggi-btn biggi-btn--ghost"
              disabled={Boolean(action) || settleWeek === ""}
              onClick={() =>
                runAction(`Settle week ${settleWeek}`, (contract) =>
                  contract.settleWeek(BigInt(settleWeek)),
                )
              }
            >
              {action.startsWith("Settle") ? "Settling..." : "Settle week"}
            </button>
          </div>
        </section>
      </div>

      <section className="moderator-center__card">
        <div className="moderator-center__card-head">
          <h3>Slots</h3>
          <span className="moderator-center__chip">Current week {String(state.currentWeek)}</span>
        </div>
        <div className="moderator-center__table moderator-center__table--wide">
          <div className="moderator-center__table-head">
            <span>Slot</span>
            <span>Role</span>
            <span>Payout</span>
            <span>Unique / tickets</span>
          </div>
          {slots.map((slot) => (
            <div key={slot.slotId} className="moderator-center__table-row">
              <span>{slot.slotId}</span>
              <span>{slot.enabled ? (slot.isLeader ? "Leader" : "Moderator") : "Disabled"}</span>
              <span className="mono">{shortValue(slot.payout)}</span>
              <span>
                {asText(slot.week?.uniqueRefs)} / {asText(slot.week?.ticketSales)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
