import * as React from "react";
import { formatWei, getModeratorCenterV2Contract } from "@/utils/eth";
import { parseModeratorWeek, readModeratorWeek } from "./moderatorWeek.js";
import "./ModeratorTools.css";

const dateLabel = (seconds) =>
  new Date(seconds * 1000).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const shortAddress = (address) =>
  `${address.slice(0, 8)}...${address.slice(-6)}`;

export default function ModeratorTools({ walletAddress = "", onMyRewards }) {
  const [week, setWeek] = React.useState(null);
  const [draft, setDraft] = React.useState("");
  const [reload, setReload] = React.useState(0);
  const [report, setReport] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [inputError, setInputError] = React.useState("");
  const [mine, setMine] = React.useState(false);
  const [exportError, setExportError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setReport(null);
    setExportError("");
    (async () => {
      try {
        const contract = await getModeratorCenterV2Contract({ signer: false });
        const data = await readModeratorWeek(contract, week);
        if (!active) return;
        setReport(data);
        setDraft(String(data.week));
      } catch {
        if (active)
          setError("Weekly data is unavailable. Retry the Polygon connection.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [week, reload]);

  const chooseWeek = (value) => {
    try {
      setWeek(value == null ? null : parseModeratorWeek(value));
      setInputError("");
      setReload((value) => value + 1);
    } catch (validationError) {
      setInputError(validationError.message);
    }
  };
  const exportReport = () => {
    if (!report || loading) return;
    let url;
    try {
      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: "application/json",
      });
      url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `biggi-moderator-week-${report.week}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setExportError("The report could not be downloaded.");
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };
  const rows = (report?.slots || []).filter(
    (slot) =>
      slot.enabled &&
      (!mine ||
        !walletAddress ||
        slot.payout.toLowerCase() === walletAddress.toLowerCase()),
  );
  const metrics = [
    ["Weekly pool", report?.allocatedWei],
    ["Credited to wallets", report?.settled ? report.creditedWei : null],
    ["Rolled over", report?.settled ? report.rolledOverWei : null],
  ];

  return (
    <section
      className="moderator-tools"
      aria-label="Moderator tools"
      aria-busy={loading}
    >
      <div className="moderator-tools__heading">
        <div>
          <h3>Weekly activity</h3>
          <span>Polygon mainnet / Moderator V2</span>
        </div>
        <button
          type="button"
          className="biggi-btn biggi-btn--ghost"
          onClick={onMyRewards}
        >
          My rewards
        </button>
      </div>
      <form
        className="moderator-tools__toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          chooseWeek(draft);
        }}
      >
        <div className="moderator-center__field moderator-tools__week">
          <label htmlFor="moderator-tools-week">Week ID</label>
          <div className="moderator-tools__week-input">
            <button
              type="button"
              className="biggi-btn moderator-tools__icon"
              title="Previous week"
              aria-label="Previous week"
              disabled={loading || !report || report.week === 0}
              onClick={() => chooseWeek(report.week - 1)}
            >
              <span aria-hidden="true">&#8592;</span>
            </button>
            <input
              id="moderator-tools-week"
              type="number"
              min="0"
              max="1000000"
              step="1"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              required
            />
            <button
              type="button"
              className="biggi-btn moderator-tools__icon"
              title="Next week"
              aria-label="Next week"
              disabled={loading || !report || report.week >= report.currentWeek}
              onClick={() => chooseWeek(report.week + 1)}
            >
              <span aria-hidden="true">&#8594;</span>
            </button>
          </div>
        </div>
        <button
          type="submit"
          className="biggi-btn biggi-btn--ghost"
          disabled={loading}
        >
          Load week
        </button>
        <button
          type="button"
          className="biggi-btn biggi-btn--ghost"
          disabled={loading}
          onClick={() => chooseWeek(null)}
        >
          Current week
        </button>
        <div className="moderator-tools__toolbar-end">
          <button
            type="button"
            className="biggi-btn moderator-tools__icon"
            title="Refresh weekly data"
            aria-label="Refresh weekly data"
            disabled={loading}
            onClick={() => setReload((value) => value + 1)}
          >
            <span aria-hidden="true">&#8635;</span>
          </button>
          <button
            type="button"
            className="biggi-btn biggi-btn--ghost"
            disabled={loading || !report}
            onClick={exportReport}
          >
            <span aria-hidden="true">&#8595;</span> Export JSON
          </button>
        </div>
      </form>
      {inputError && (
        <p className="moderator-center__error" role="alert">
          {inputError}
        </p>
      )}
      {error && (
        <p className="moderator-center__error" role="alert">
          {error}
        </p>
      )}
      {exportError && (
        <p className="moderator-center__error" role="alert">
          {exportError}
        </p>
      )}
      <div className="moderator-tools__period" aria-live="polite">
        <strong>
          {loading
            ? "Loading week..."
            : report
              ? `${dateLabel(report.startsAt)} - ${dateLabel(report.endsAt - 1)} (UTC)`
              : "Data unavailable"}
        </strong>
        <span
          className={`moderator-center__chip ${report?.settled ? "moderator-center__chip--ok" : "moderator-center__chip--warn"}`}
        >
          {loading ? "Checking" : report?.status || "Unavailable"}
        </span>
      </div>
      <dl className="moderator-tools__metrics">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value == null ? "--" : `${formatWei(value)} POL`}</dd>
          </div>
        ))}
      </dl>
      <div className="moderator-tools__table-heading">
        <h4>Moderators</h4>
        <label className="moderator-center__toggle">
          <input
            type="checkbox"
            checked={mine && !!walletAddress}
            disabled={!walletAddress}
            onChange={(event) => setMine(event.target.checked)}
          />{" "}
          My wallet only
        </label>
      </div>
      <div
        className="moderator-tools__table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Weekly moderator activity"
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Slot / role</th>
              <th scope="col">Payout wallet</th>
              <th scope="col">Unique buyers</th>
              <th scope="col">Paid tickets</th>
              <th scope="col">Weight</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((slot) => (
              <tr key={slot.slotId}>
                <th scope="row">
                  Slot {slot.slotId}
                  <span>{slot.isLeader ? "Leader" : "Moderator"}</span>
                </th>
                <td>
                  <a
                    href={`https://polygonscan.com/address/${slot.payout}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={slot.payout}
                  >
                    {shortAddress(slot.payout)}
                  </a>
                </td>
                <td>{slot.uniqueBuyers}</td>
                <td>{slot.paidTickets}</td>
                <td>{slot.weight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="moderator-tools__empty">
          {loading
            ? "Loading on-chain activity..."
            : error
              ? "Activity unavailable"
              : !report?.opened
                ? "No on-chain activity has opened this week."
                : mine && walletAddress
                  ? "No assigned slot for this wallet in this week."
                  : "No enabled slots in this week."}
        </p>
      )}
      {report && (
        <dl className="moderator-tools__details">
          <div>
            <dt>Settlement available from</dt>
            <dd>{dateLabel(report.settlesAt)} 00:00 UTC</dd>
          </div>
          <div>
            <dt>Snapshot version</dt>
            <dd>
              {report.configVersion === "0"
                ? "Not created"
                : report.configVersion}
            </dd>
          </div>
          <div>
            <dt>Source block</dt>
            <dd>
              <a
                href={`https://polygonscan.com/block/${report.blockNumber}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {report.blockNumber}
              </a>
            </dd>
          </div>
          <div>
            <dt>Contract</dt>
            <dd>
              <a
                href={`https://polygonscan.com/address/${report.contract}#readContract`}
                target="_blank"
                rel="noopener noreferrer"
                title={report.contract}
              >
                {shortAddress(report.contract)}
              </a>
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
