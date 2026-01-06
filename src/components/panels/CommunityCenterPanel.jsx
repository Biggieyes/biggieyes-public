// src/components/panels/CommunityCenterPanel.jsx
import * as React from "react";
import { ethers } from "ethers";
import { getROProvider, ADDR } from "../../utils/contract";
import "./RewardsPanel.css";
import "../../styles/biggi-token.skin.css";
import communityCenterAbi from "../../utils/abi/BiggiCommunityCenter.js";
import FullscreenPanel from "../common/FullscreenPanel";
import ModeratorCenterPanel from "./ModeratorCenterPanel";

const COMMUNITY_CENTER_ABI = Array.isArray(communityCenterAbi)
  ? communityCenterAbi
  : [];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function isAddress(value) {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

function resolveCommunityCenterAddress() {
  const candidates = [];
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      const env = import.meta.env;
      candidates.push(env.VITE_ADDR_COMMUNITY_CENTER);
      candidates.push(env.VITE_ADDR_COMMUNITY);
      candidates.push(env.VITE_ADDR_COMMUNITYCENTRE);
    }
  } catch {}
  try {
    if (typeof process !== "undefined" && process.env) {
      const env = process.env;
      candidates.push(env.VITE_ADDR_COMMUNITY_CENTER);
      candidates.push(env.VITE_ADDR_COMMUNITY);
    }
  } catch {}
  try {
    candidates.push(
      ADDR?.COMMUNITY_CENTER,
      ADDR?.CommunityCenter,
      ADDR?.BIGGI_COMMUNITY_CENTER,
      ADDR?.BiggiCommunityCenter,
      ADDR?.COMMUNITY,
    );
  } catch {}

  for (const candidate of candidates) {
    if (isAddress(candidate) && candidate !== ZERO_ADDRESS) {
      return candidate;
    }
  }
  return null;
}

function bnToNumber(value) {
  if (value == null) return 0;
  try {
    return Number(ethers.BigNumber.from(value).toString());
  } catch {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }
}

function formatVotes(value) {
  const num = bnToNumber(value);
  if (!Number.isFinite(num)) return "--";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toLocaleString();
}

function formatDeposit(value) {
  try {
    const numeric = Number(ethers.utils.formatEther(value ?? 0));
    if (!Number.isFinite(numeric)) return "--";
    if (numeric === 0) return "0 POL";
    if (numeric >= 1) return `${numeric.toFixed(2)} POL`;
    return `${numeric.toFixed(4)} POL`;
  } catch {
    return "--";
  }
}

function formatNative(value) {
  try {
    const numeric = Number(ethers.utils.formatEther(value ?? 0));
    if (!Number.isFinite(numeric)) return "--";
    if (numeric === 0) return "0 POL";
    if (numeric >= 1) return `${numeric.toFixed(2)} POL`;
    return `${numeric.toFixed(4)} POL`;
  } catch {
    return "--";
  }
}

function formatPercent(value) {
  if (value == null) return "n/a";
  const num = bnToNumber(value);
  if (!Number.isFinite(num)) return "n/a";
  return `${num}%`;
}

function formatThreshold(value) {
  if (value == null) return "n/a";
  const num = bnToNumber(value);
  if (!Number.isFinite(num) || num <= 0) return "n/a";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toLocaleString();
}

function formatDuration(seconds) {
  const value = bnToNumber(seconds);
  if (!Number.isFinite(value) || value <= 0) return "n/a";
  if (value % 86400 === 0) {
    const days = value / 86400;
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  if (value % 3600 === 0) {
    const hours = value / 3600;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  if (value % 60 === 0) {
    const mins = value / 60;
    return `${mins} min`;
  }
  return `${value} sec`;
}

function formatDate(seconds) {
  const ts = bnToNumber(seconds);
  if (!Number.isFinite(ts) || ts <= 0) return "Not scheduled";
  const date = new Date(ts * 1000);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleString();
}

function shorten(text, max = 20) {
  if (!text || typeof text !== "string") return "";
  if (text.length <= max) return text;
  const prefix = text.slice(0, Math.max(4, max - 8));
  const suffix = text.slice(-4);
  return `${prefix}...${suffix}`;
}

async function safeContractCall(contract, method, args = [], fallback = null) {
  try {
    if (!contract || typeof contract[method] !== "function") return fallback;
    const result = await contract[method](...args);
    return result ?? fallback;
  } catch {
    return fallback;
  }
}

function parseProposal(raw, fallbackId) {
  const arr = Array.isArray(raw) ? raw : [];
  return {
    id: bnToNumber(raw?.pid ?? raw?.id ?? arr[0] ?? fallbackId ?? 0),
    proposer: raw?.proposer ?? arr[1] ?? ZERO_ADDRESS,
    ipfs: raw?.ipfs ?? arr[2] ?? "",
    start: bnToNumber(raw?.start ?? arr[3]),
    end: bnToNumber(raw?.end ?? arr[4]),
    forVotes: bnToNumber(raw?.forV ?? raw?.forVotes ?? arr[5]),
    againstVotes: bnToNumber(raw?.againstV ?? arr[6]),
    abstainVotes: bnToNumber(raw?.abstainV ?? arr[7]),
    executed: Boolean(raw?.executed ?? arr[8]),
    canceled: Boolean(raw?.canceled ?? arr[9]),
  };
}

function parseEvent(raw, fallbackId) {
  const arr = Array.isArray(raw) ? raw : [];
  return {
    id: bnToNumber(raw?.eid ?? raw?.id ?? arr[0] ?? fallbackId ?? 0),
    organizer: raw?.organizer ?? arr[1] ?? ZERO_ADDRESS,
    ipfs: raw?.ipfs ?? arr[2] ?? "",
    start: bnToNumber(raw?.start ?? arr[3]),
    end: bnToNumber(raw?.end ?? arr[4]),
    capacity: bnToNumber(raw?.capacity ?? arr[5]),
    depositWei: raw?.depositWei ?? arr[6],
    attendeeCount: bnToNumber(raw?.attendeeCount ?? arr[7]),
    canceled: Boolean(raw?.canceled ?? arr[8]),
    completed: Boolean(raw?.completed ?? arr[9]),
    withdrawn: Boolean(raw?.withdrawn ?? arr[10]),
  };
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function computeProposalStatus(proposal) {
  if (proposal.canceled) return "Canceled";
  if (proposal.executed) return "Executed";
  const now = nowSeconds();
  if (now < proposal.start) return "Pending";
  if (now > proposal.end) return "Finalizing";
  return "Voting live";
}

function computeEventStatus(event) {
  if (event.canceled) return "Canceled";
  if (event.completed) return "Completed";
  if (event.withdrawn) return "Withdrawn";
  const now = nowSeconds();
  if (now < event.start) return "Upcoming";
  if (now > event.end) return "Finished";
  if (event.capacity && event.attendeeCount >= event.capacity)
    return "At capacity";
  return "Live";
}

const Card = ({ title, subtitle, tone = "y", children }) => {
  const toneClass = tone ? ` biggi-card--${tone}` : "";
  return (
    <article className={`rewards-grid__card biggi-card${toneClass}`}>
      <div className="biggi-card__glow" aria-hidden />
      <div className="rewards-grid__card-header biggi-card__header">
        <div className="biggi-card__heading">
          {title ? <h3>{title}</h3> : null}
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      <div className="biggi-card__body">{children}</div>
    </article>
  );
};

const KeyValueGrid = ({ items = [] }) => (
  <div className="biggi-grid">
    {items.map(({ k, v, tone, mono }, idx) => (
      <div key={`${k}-${idx}`} className="biggi-line">
        <span className="muted">{k}</span>
        <span
          className={`biggi-value${mono ? " mono" : ""}`}
          style={tone ? { borderColor: `${tone}55`, color: tone } : undefined}
        >
          {v ?? "--"}
        </span>
      </div>
    ))}
  </div>
);

export default function CommunityCenterPanel({
  compact = false,
  walletAddress = "",
  onConnectMetaMask,
  onConnectWalletConnect,
}) {
  const [address, setAddress] = React.useState(() =>
    resolveCommunityCenterAddress(),
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [moderatorOpen, setModeratorOpen] = React.useState(false);
  const [summary, setSummary] = React.useState({
    proposalCount: 0,
    eventCount: 0,
    quorumPercent: null,
    proposalThreshold: null,
    votingDuration: null,
  });
  const [proposals, setProposals] = React.useState([]);
  const [events, setEvents] = React.useState([]);
  const [poolBalance, setPoolBalance] = React.useState(null);

  const counts = React.useMemo(() => {
    const statusCounts = proposals.reduce(
      (acc, p) => {
        const status = computeProposalStatus(p);
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      { Pending: 0, "Voting live": 0, Finalizing: 0, Executed: 0, Canceled: 0 },
    );

    const eventCounts = events.reduce(
      (acc, e) => {
        const status = computeEventStatus(e);
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      { Upcoming: 0, Live: 0, Finished: 0, Completed: 0, Canceled: 0 },
    );

    const liveTurnout = proposals
      .filter((p) => computeProposalStatus(p) === "Voting live")
      .map((p) => p.forVotes + p.againstVotes + p.abstainVotes)
      .reduce((a, b) => a + b, 0);

    return { statusCounts, eventCounts, liveTurnout };
  }, [proposals, events]);

  const voteBars = React.useMemo(() => {
    return proposals.slice(0, 4).map((proposal) => {
      const total =
        proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
      const pct =
        total > 0 ? Math.min(100, (proposal.forVotes / total) * 100) : 0;
      return {
        id: proposal.id,
        label: `#${proposal.id}`,
        pct,
        total,
        status: computeProposalStatus(proposal),
      };
    });
  }, [proposals]);

  React.useEffect(() => {
    let cancelled = false;
    const setPlaceholder = () => {
      if (cancelled) return;
      setSummary({
        proposalCount: 0,
        eventCount: 0,
        quorumPercent: null,
        proposalThreshold: null,
        votingDuration: null,
      });
      setProposals([]);
      setEvents([]);
      setPoolBalance(null);
      setError(null);
      setLoading(false);
    };

    async function load() {
      const resolvedAddress = resolveCommunityCenterAddress();
      if (!cancelled) setAddress(resolvedAddress);

      if (!resolvedAddress) {
        setPlaceholder();
        return;
      }

      if (
        !Array.isArray(COMMUNITY_CENTER_ABI) ||
        COMMUNITY_CENTER_ABI.length === 0
      ) {
        setPlaceholder();
        return;
      }

      try {
        if (!cancelled) {
          setLoading(true);
          setError(null);
        }

        const provider = getROProvider();
        if (!provider) {
          setPlaceholder();
          return;
        }

        const contract = new ethers.Contract(
          resolvedAddress,
          COMMUNITY_CENTER_ABI,
          provider,
        );

        const [
          proposalCountBn,
          eventCountBn,
          quorumBn,
          thresholdBn,
          durationBn,
          poolBalanceBn,
        ] = await Promise.all([
          safeContractCall(
            contract,
            "proposalCount",
            [],
            ethers.BigNumber.from(0),
          ),
          safeContractCall(
            contract,
            "eventCount",
            [],
            ethers.BigNumber.from(0),
          ),
          safeContractCall(contract, "quorumPercent", [], null),
          safeContractCall(contract, "proposalThreshold", [], null),
          safeContractCall(contract, "votingDuration", [], null),
          safeContractCall(contract, "poolBalance", [], null),
        ]);

        const proposalCount = bnToNumber(proposalCountBn);
        const eventCount = bnToNumber(eventCountBn);

        const fetchedProposals = [];
        for (
          let id = proposalCount - 1;
          id >= 0 && fetchedProposals.length < 5;
          id -= 1
        ) {
          const raw = await safeContractCall(
            contract,
            "getProposal",
            [id],
            null,
          );
          if (!raw) continue;
          fetchedProposals.push(parseProposal(raw, id));
        }

        const fetchedEvents = [];
        for (
          let id = eventCount - 1;
          id >= 0 && fetchedEvents.length < 5;
          id -= 1
        ) {
          const raw = await safeContractCall(contract, "getEvent", [id], null);
          if (!raw) continue;
          fetchedEvents.push(parseEvent(raw, id));
        }

        if (!cancelled) {
          setSummary({
            proposalCount,
            eventCount,
            quorumPercent: quorumBn != null ? bnToNumber(quorumBn) : null,
            proposalThreshold:
              thresholdBn != null ? bnToNumber(thresholdBn) : null,
            votingDuration: durationBn != null ? bnToNumber(durationBn) : null,
          });
          setProposals(fetchedProposals);
          setEvents(fetchedEvents);
          setPoolBalance(poolBalanceBn);
        }
      } catch (err) {
        if (!cancelled)
          setError(err?.message || "Failed to load community center data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const summaryItems = React.useMemo(
    () => [
      {
        k: "Proposals",
        v: loading ? "..." : summary.proposalCount.toLocaleString(),
        tone: "#FFE800",
        mono: true,
      },
      {
        k: "Events",
        v: loading ? "..." : summary.eventCount.toLocaleString(),
        tone: "#5DDCFF",
        mono: true,
      },
      {
        k: "Quorum",
        v: loading ? "..." : formatPercent(summary.quorumPercent),
        tone: "#9B7BFF",
      },
      {
        k: "Threshold",
        v: loading ? "..." : formatThreshold(summary.proposalThreshold),
        tone: "#27D9D2",
        mono: true,
      },
      {
        k: "Voting window",
        v: loading ? "..." : formatDuration(summary.votingDuration),
        tone: "#FFE800",
      },
      {
        k: "Pool balance",
        v: loading ? "..." : formatNative(poolBalance),
        tone: "#FFE800",
      },
    ],
    [loading, summary, poolBalance],
  );
  return (
    <>
      <section
        className={`rewards-grid biggi-skin${compact ? " is-compact" : ""}`}
      >
        <div className="rewards-grid__surface biggi-token-surface">
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "radial-gradient(900px 360px at 82% -15%, rgba(95,219,255,0.16), transparent 70%)",
              mixBlendMode: "screen",
            }}
          />

          <header className="rewards-grid__header biggi-header panel-header panel-header--community">
            <div className="rewards-grid__headline">
              <h2 className="rewards-grid__title">Community Center</h2>
              <p className="rewards-grid__subtitle">
                Governance proposals, community events, and participation
                telemetry.
              </p>
            </div>
            <div className="rewards-grid__header-actions">
              <button
                type="button"
                className="biggi-btn biggi-btn--ghost"
                onClick={() => setModeratorOpen(true)}
              >
                Moderator Center
              </button>
              <span
                className="rewards-grid__subtitle"
                style={{ fontSize: "0.78rem", color: "#c8cae3" }}
              >
                {address
                  ? `Contract ${shorten(address, 24)}`
                  : "Contract address missing"}
              </span>
            </div>
          </header>

          {!error && (
            <div className="biggi-hero">
              <div className="biggi-hero__card">
                <span className="biggi-hero__label">Live Participation</span>
                <strong className="biggi-hero__value">
                  {loading ? "..." : formatVotes(counts.liveTurnout)}
                </strong>
                <span className="biggi-hero__hint">
                  Votes across live proposals
                </span>
              </div>
              <div className="biggi-hero__card">
                <span className="biggi-hero__label">Proposals</span>
                <strong className="biggi-hero__value">
                  {loading ? "..." : summary.proposalCount}
                </strong>
                <span className="biggi-hero__hint">
                  {counts.statusCounts["Voting live"] || 0} live /{" "}
                  {counts.statusCounts.Pending || 0} pending
                </span>
              </div>
              <div className="biggi-hero__card">
                <span className="biggi-hero__label">Events</span>
                <strong className="biggi-hero__value">
                  {loading ? "..." : summary.eventCount}
                </strong>
                <span className="biggi-hero__hint">
                  {counts.eventCounts.Live || 0} live /{" "}
                  {counts.eventCounts.Upcoming || 0} upcoming
                </span>
              </div>
              <div className="biggi-hero__card">
                <span className="biggi-hero__label">Quorum Target</span>
                <strong className="biggi-hero__value">
                  {loading ? "..." : formatPercent(summary.quorumPercent)}
                </strong>
                <span className="biggi-hero__hint">
                  Threshold {formatThreshold(summary.proposalThreshold)}
                </span>
              </div>
              <div className="biggi-hero__card">
                <span className="biggi-hero__label">Pool Balance</span>
                <strong className="biggi-hero__value">
                  {loading ? "..." : formatNative(poolBalance)}
                </strong>
                <span className="biggi-hero__hint">
                  Community pool in native
                </span>
              </div>
            </div>
          )}

          {error ? null : (
            <>
              <section className="rewards-grid__cards-panel">
                <div className="rewards-grid__cards">
                  <Card
                    title="Community snapshot"
                    subtitle="Key governance metrics"
                    tone="y"
                  >
                    <KeyValueGrid items={summaryItems} />
                  </Card>

                  <Card
                    title="Participation heat"
                    subtitle="For-votes share on latest proposals"
                    tone="c"
                  >
                    {loading ? (
                      <p className="muted">Loading participation...</p>
                    ) : voteBars.length ? (
                      <div className="biggi-bars">
                        {voteBars.map((bar) => (
                          <div key={bar.id} className="biggi-bar">
                            <div className="biggi-bar__meta">
                              <span className="biggi-value mono">
                                {bar.label}
                              </span>
                              <span className="muted">{bar.status}</span>
                              <span className="muted">
                                {formatVotes(bar.total)} votes
                              </span>
                            </div>
                            <div className="biggi-bar__track">
                              <span
                                className="biggi-bar__fill"
                                style={{ width: `${bar.pct}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">No participation data yet.</p>
                    )}
                  </Card>

                  <Card
                    title="Recent proposals"
                    subtitle="Voting tallies & timeline"
                    tone="c"
                  >
                    {loading ? (
                      <p className="muted">Loading proposals...</p>
                    ) : proposals.length ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 14,
                        }}
                      >
                        {proposals.map((proposal) => (
                          <div
                            key={proposal.id}
                            style={{
                              borderRadius: 12,
                              border: "1px solid rgba(95, 219, 255, 0.16)",
                              background: "rgba(17, 17, 24, 0.55)",
                              padding: 12,
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 12,
                              }}
                            >
                              <span className="biggi-value mono">
                                #{proposal.id}
                              </span>
                              <span className="muted">
                                {computeProposalStatus(proposal)}
                              </span>
                            </div>
                            <div
                              className="muted"
                              style={{ fontSize: "0.8rem" }}
                            >
                              {proposal.ipfs
                                ? shorten(proposal.ipfs, 28)
                                : "No metadata (IPFS)"}
                            </div>
                            <div className="biggi-grid" style={{ gap: 4 }}>
                              <div className="biggi-line">
                                <span className="muted">For</span>
                                <span className="biggi-value mono">
                                  {formatVotes(proposal.forVotes)}
                                </span>
                              </div>
                              <div className="biggi-line">
                                <span className="muted">Against</span>
                                <span className="biggi-value mono">
                                  {formatVotes(proposal.againstVotes)}
                                </span>
                              </div>
                              <div className="biggi-line">
                                <span className="muted">Abstain</span>
                                <span className="biggi-value mono">
                                  {formatVotes(proposal.abstainVotes)}
                                </span>
                              </div>
                            </div>
                            <div
                              className="muted"
                              style={{ fontSize: "0.75rem" }}
                            >
                              {formatDate(proposal.start)} -{" "}
                              {formatDate(proposal.end)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">No proposals recorded yet.</p>
                    )}
                  </Card>
                </div>
              </section>

              <section className="rewards-grid__cards-panel">
                <div className="rewards-grid__cards">
                  <Card
                    title="Latest events"
                    subtitle="Community gatherings & RSVP stats"
                    tone="b"
                  >
                    {loading ? (
                      <p className="muted">Loading events...</p>
                    ) : events.length ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 14,
                        }}
                      >
                        {events.map((event) => (
                          <div
                            key={event.id}
                            style={{
                              borderRadius: 12,
                              border: "1px solid rgba(155, 123, 255, 0.18)",
                              background: "rgba(17, 17, 24, 0.55)",
                              padding: 12,
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 12,
                              }}
                            >
                              <span className="biggi-value mono">
                                Event #{event.id}
                              </span>
                              <span className="muted">
                                {computeEventStatus(event)}
                              </span>
                            </div>
                            <div
                              className="muted"
                              style={{ fontSize: "0.8rem" }}
                            >
                              {event.ipfs
                                ? shorten(event.ipfs, 28)
                                : "No metadata (IPFS)"}
                            </div>
                            <div className="biggi-grid" style={{ gap: 4 }}>
                              <div className="biggi-line">
                                <span className="muted">Capacity</span>
                                <span className="biggi-value mono">
                                  {event.capacity
                                    ? `${event.attendeeCount}/${event.capacity}`
                                    : `${event.attendeeCount}`}
                                </span>
                              </div>
                              <div className="biggi-line">
                                <span className="muted">Deposit</span>
                                <span className="biggi-value mono">
                                  {formatDeposit(event.depositWei)}
                                </span>
                              </div>
                            </div>
                            <div
                              className="muted"
                              style={{ fontSize: "0.75rem" }}
                            >
                              {formatDate(event.start)} -{" "}
                              {formatDate(event.end)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">
                        No community events scheduled yet.
                      </p>
                    )}
                  </Card>

                  <Card
                    title="Contract details"
                    subtitle="Runtime diagnostics"
                    tone="p"
                  >
                    <div className="biggi-grid">
                      <div className="biggi-line">
                        <span className="muted">Contract</span>
                        <span className="biggi-value mono">
                          {address ? shorten(address, 28) : "Not set"}
                        </span>
                      </div>
                      <div className="biggi-line">
                        <span className="muted">ABI entries</span>
                        <span className="biggi-value mono">
                          {COMMUNITY_CENTER_ABI.length
                            ? COMMUNITY_CENTER_ABI.length
                            : "None"}
                        </span>
                      </div>
                      <div className="biggi-line">
                        <span className="muted">Provider</span>
                        <span className="biggi-value">Read-only</span>
                      </div>
                    </div>
                  </Card>
                </div>
              </section>
            </>
          )}
        </div>
      </section>

      <FullscreenPanel
        open={moderatorOpen}
        title="Moderator Center"
        onClose={() => setModeratorOpen(false)}
        onPrev={undefined}
        onNext={undefined}
        containerStyle={{
          background: "transparent",
          border: "none",
          boxShadow: "none",
          padding: 0,
          width: "min(1200px, 94vw)",
          whiteSpace: "normal",
          lineHeight: "normal",
        }}
        contentStyle={{ padding: 0 }}
      >
        <ModeratorCenterPanel
          compact={compact}
          walletAddress={walletAddress}
          onConnectMetaMask={onConnectMetaMask}
          onConnectWalletConnect={onConnectWalletConnect}
        />
      </FullscreenPanel>
    </>
  );
}
