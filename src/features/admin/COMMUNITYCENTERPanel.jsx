import * as React from "react";
import { Contract, formatEther } from "ethers";

import { useWeb3 } from "@/providers/Web3Provider";
import { BiggiCommunityCenter as COMMUNITYCENTERAbi } from "@/config/abi/index.js";
import PanelInfoModal from "@/components/common/PanelInfoModal";
import PanelInfoButton from "@/components/common/PanelInfoButton";
import { getROProvider, ADDR } from "@/shared/utils/contract";
import {
  httpFromIpfs,
  readJsonFromURI,
  resolveImageUrl,
} from "@/shared/services/ipfs.js";
import {
  fetchCommunityPolls,
  submitCommunityVote,
} from "@/shared/services/communityVotingApi.js";

import FullscreenPanel from "../../components/common/FullscreenPanel.jsx";
import MODERATORCENTERPanel from "./MODERATORCENTER/MODERATORCENTERPanel.jsx";
import "../rewards/REWARDSPanel.css";
import "../../styles/biggi-token.skin.css";
import "./COMMUNITYCENTERPanel.css";

const COMMUNITY_CENTER_ABI = Array.isArray(COMMUNITYCENTERAbi)
  ? COMMUNITYCENTERAbi
  : [];
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function isAddress(value) {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

function sameAddress(a, b) {
  return (
    String(a || "").trim().toLowerCase() ===
    String(b || "").trim().toLowerCase()
  );
}

function resolveCOMMUNITYCENTERAddress() {
  const candidates = [];
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      candidates.push(import.meta.env.VITE_ADDR_COMMUNITY_CENTER);
      candidates.push(import.meta.env.VITE_ADDR_COMMUNITY);
    }
  } catch {}
  try {
    if (typeof process !== "undefined" && process.env) {
      candidates.push(process.env.VITE_ADDR_COMMUNITY_CENTER);
      candidates.push(process.env.VITE_ADDR_COMMUNITY);
    }
  } catch {}
  candidates.push(
    ADDR?.COMMUNITY_CENTER,
    ADDR?.COMMUNITYCENTER,
    ADDR?.BIGGI_COMMUNITY_CENTER,
    ADDR?.COMMUNITY,
  );
  return (
    candidates.find(
      (value) => isAddress(value) && !sameAddress(value, ZERO_ADDRESS),
    ) || null
  );
}

function toNumber(value) {
  try {
    if (typeof value === "bigint") return Number(value);
    const next = Number(value?.toString?.() ?? value);
    return Number.isFinite(next) ? next : 0;
  } catch {
    return 0;
  }
}

function shorten(value, start = 6, end = 4) {
  const text = String(value || "");
  if (!text) return "--";
  if (text.length <= start + end + 3) return text;
  return `${text.slice(0, start)}...${text.slice(-end)}`;
}

function formatPol(value) {
  try {
    const amount = Number(formatEther(value ?? 0n));
    if (!Number.isFinite(amount)) return "--";
    if (amount === 0) return "0 POL";
    if (amount >= 1000) {
      return `${amount.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })} POL`;
    }
    if (amount >= 1) return `${amount.toFixed(2)} POL`;
    return `${amount.toFixed(4)} POL`;
  } catch {
    return "--";
  }
}

function formatDateTime(seconds) {
  const ts = toNumber(seconds);
  if (!ts) return "Not scheduled";
  const date = new Date(ts * 1000);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleString();
}

function formatIsoDateTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Not scheduled";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleString();
}

function parseEvent(raw, fallbackId) {
  const arr = Array.isArray(raw) ? raw : [];
  return {
    id: toNumber(fallbackId),
    title: String(raw?.title ?? arr[0] ?? "").trim(),
    ipfsHash: String(raw?.ipfsHash ?? raw?.ipfs ?? arr[1] ?? "").trim(),
    start: toNumber(raw?.start ?? arr[2]),
    end: toNumber(raw?.end ?? arr[3]),
    totalPrize: raw?.totalPrize_ ?? raw?.totalPrize ?? arr[4] ?? 0n,
    locked: raw?.locked ?? arr[5] ?? 0n,
    exists: Boolean(raw?.exists ?? arr[6]),
  };
}

function parseUserStatus(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return {
    amount: raw?.amount ?? arr[0] ?? 0n,
    claimed: Boolean(raw?.claimed ?? arr[1]),
    exists: Boolean(raw?.exists ?? arr[2]),
  };
}

function parseCanClaim(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return {
    ok: Boolean(raw?.ok ?? arr[0]),
    reason: toNumber(raw?.reason ?? arr[1]),
    amount: raw?.amount ?? arr[2] ?? 0n,
  };
}

function claimReasonLabel(reason) {
  switch (toNumber(reason)) {
    case 0:
      return "Claim available";
    case 1:
      return "Event does not exist";
    case 2:
      return "Wallet is not a winner";
    case 3:
      return "Prize already claimed";
    case 4:
      return "Contract is paused";
    default:
      return "Claim unavailable";
  }
}

function scheduleStatus(event) {
  const now = Math.floor(Date.now() / 1000);
  if (!event?.exists) return "Missing";
  if (event.start && now < event.start) return "Upcoming";
  if (event.end && now > event.end) return "Finished";
  return "Live";
}

function normalizeMetadataUri(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (
    /^https?:\/\//i.test(raw) ||
    /^ipfs:\/\//i.test(raw) ||
    /^ipns:\/\//i.test(raw) ||
    /^\/ipfs\//i.test(raw) ||
    /^\/ipns\//i.test(raw)
  ) {
    return raw;
  }
  return `ipfs://${raw}`;
}

function tryParseInlineMetadata(value) {
  const raw = String(value || "").trim();
  if (!raw || !raw.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

async function safeReadMetadata(uri) {
  const inlineMetadata = tryParseInlineMetadata(uri);
  if (inlineMetadata) {
    const image = inlineMetadata?.image
      ? await resolveImageUrl(inlineMetadata.image, "").catch(() => {
          const raw = String(inlineMetadata.image || "").trim();
          return raw || null;
        })
      : null;
    return {
      uri: "",
      metadata: inlineMetadata,
      image,
    };
  }

  const normalized = normalizeMetadataUri(uri);
  if (!normalized) return { uri: "", metadata: null, image: null };
  const metadata = await readJsonFromURI(normalized).catch(() => null);
  const image = metadata?.image
    ? await resolveImageUrl(metadata.image, normalized).catch(() => null)
    : null;
  return {
    uri: httpFromIpfs(normalized),
    metadata,
    image,
  };
}

function toneColor(label) {
  if (label === "Live" || label === "Claim available") return "#5ddcff";
  if (label === "Upcoming") return "#ffe800";
  if (label === "Finished" || label === "Closed") return "#f6f7fb";
  return "#ffb3b3";
}

const Card = ({
  title,
  subtitle,
  tone = "c",
  action = null,
  className = "",
  children,
}) => (
  <article
    className={`rewards-grid__card biggi-card biggi-card--${tone} ${className}`.trim()}
  >
    <div className="biggi-card__glow" aria-hidden />
    <div className="rewards-grid__card-header biggi-card__header">
      <div className="biggi-card__heading">
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action ? <div className="biggi-card__actions">{action}</div> : null}
    </div>
    <div className="biggi-card__body">{children}</div>
  </article>
);

const ValueRow = ({ label, value, mono = false }) => (
  <div className="biggi-line" style={{ justifyContent: "space-between" }}>
    <span className="muted">{label}</span>
    <span style={mono ? { fontFamily: "monospace" } : undefined}>
      {value || "--"}
    </span>
  </div>
);

export default function COMMUNITYCENTERPanel({
  compact = false,
  walletAddress = "",
  onConnectMetaMask,
  onConnectWalletConnect,
  isAdmin = false,
  onOpenAdmin,
  autoOpenInfo = false,
}) {
  const communityAddress = React.useMemo(
    () => resolveCOMMUNITYCENTERAddress(),
    [],
  );
  const autoInfoOpened = React.useRef(false);
  const { signer, account } = useWeb3();
  const activeWallet = account || walletAddress || "";
  const [eventsLoading, setEventsLoading] = React.useState(true);
  const [eventsError, setEventsError] = React.useState("");
  const [pollsLoading, setPollsLoading] = React.useState(true);
  const [pollsError, setPollsError] = React.useState("");
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [moderatorOpen, setModeratorOpen] = React.useState(false);
  const [claimingEventId, setClaimingEventId] = React.useState(null);
  const [claimMessage, setClaimMessage] = React.useState("");
  const [events, setEvents] = React.useState([]);
  const [polls, setPolls] = React.useState([]);
  const [voteSelections, setVoteSelections] = React.useState({});
  const [votingPollId, setVotingPollId] = React.useState("");
  const [voteMessage, setVoteMessage] = React.useState("");

  const hasConfig = Boolean(communityAddress && COMMUNITY_CENTER_ABI.length);
  const canOpenAdmin = Boolean(onOpenAdmin) && Boolean(isAdmin);

  React.useEffect(() => {
    if (autoOpenInfo && !autoInfoOpened.current) {
      autoInfoOpened.current = true;
      setInfoOpen(true);
    }
    if (!autoOpenInfo) autoInfoOpened.current = false;
  }, [autoOpenInfo]);

  const loadEvents = React.useCallback(async () => {
    if (!hasConfig) {
      setEvents([]);
      setEventsLoading(false);
      setEventsError("Community Center contract address or ABI is missing.");
      return;
    }
    setEventsLoading(true);
    setEventsError("");
    try {
      const provider = getROProvider();
      const contract = new Contract(
        communityAddress,
        COMMUNITY_CENTER_ABI,
        provider,
      );
      const [
        eventIds,
      ] = await Promise.all([
        contract.getEvents().catch(() => []),
      ]);

      const detailed = await Promise.all(
        (Array.isArray(eventIds) ? eventIds : []).map(async (eventId) => {
          const eventRaw = await contract.getEvent(eventId).catch(() => null);
          const event = parseEvent(eventRaw, eventId);
          const [winnerTuple, metadataPayload, userStatusRaw, canClaimRaw] =
            await Promise.all([
              contract.getEventWinners(eventId).catch(() => [[], [], []]),
              safeReadMetadata(event.ipfsHash),
              activeWallet ? contract.userStatus(eventId, activeWallet).catch(() => null) : Promise.resolve(null),
              activeWallet ? contract.canClaim(eventId, activeWallet).catch(() => null) : Promise.resolve(null),
            ]);
          const tuple = Array.isArray(winnerTuple) ? winnerTuple : [[], [], []];
          return {
            ...event,
            winners: (tuple[0] || []).map((winner, index) => ({
              address: winner,
              amount: tuple[1]?.[index] ?? 0n,
              claimed: Boolean(tuple[2]?.[index]),
            })),
            schedule: scheduleStatus(event),
            metadataUri: metadataPayload.uri,
            metadata: metadataPayload.metadata,
            image: metadataPayload.image,
            walletStatus: userStatusRaw ? parseUserStatus(userStatusRaw) : null,
            claim: canClaimRaw ? parseCanClaim(canClaimRaw) : null,
          };
        }),
      );

      detailed.sort((a, b) => b.id - a.id);
      setEvents(detailed);
    } catch (nextError) {
      setEventsError(
        nextError?.shortMessage ||
          nextError?.message ||
          "Failed to load Community Center.",
      );
    } finally {
      setEventsLoading(false);
    }
  }, [activeWallet, communityAddress, hasConfig]);

  const loadPolls = React.useCallback(async () => {
    setPollsLoading(true);
    setPollsError("");
    try {
      const json = await fetchCommunityPolls({ walletAddress: activeWallet });
      setPolls(Array.isArray(json?.polls) ? json.polls : []);
    } catch (nextError) {
      setPolls([]);
      setPollsError(
        nextError?.message || "Failed to load community voting.",
      );
    } finally {
      setPollsLoading(false);
    }
  }, [activeWallet]);

  const loadData = React.useCallback(async () => {
    await Promise.allSettled([loadEvents(), loadPolls()]);
  }, [loadEvents, loadPolls]);

  React.useEffect(() => {
    loadData().catch((nextError) => {
      setEventsError(nextError?.message || "Failed to load Community Center.");
    });
  }, [loadData]);

  const handleClaim = React.useCallback(
    async (eventId) => {
      if (!signer || !activeWallet) {
        setClaimMessage("Connect your wallet first.");
        return;
      }
      setClaimingEventId(eventId);
      setClaimMessage("");
      try {
        const contract = new Contract(communityAddress, COMMUNITY_CENTER_ABI, signer);
        const tx = await contract.claim(eventId);
        await tx.wait();
        setClaimMessage(`Claim for event #${eventId} confirmed.`);
        await loadEvents();
      } catch (nextError) {
        setClaimMessage(
          nextError?.shortMessage || nextError?.message || "Claim failed.",
        );
      } finally {
        setClaimingEventId(null);
      }
    },
    [activeWallet, communityAddress, loadEvents, signer],
  );

  const handleVote = React.useCallback(
    async (pollId) => {
      const selectedOptionId = String(voteSelections[pollId] || "").trim();
      if (!selectedOptionId) {
        setVoteMessage("Select an option first.");
        return;
      }
      if (!signer || !activeWallet) {
        setVoteMessage("Connect your wallet first.");
        return;
      }

      setVotingPollId(pollId);
      setVoteMessage("");
      try {
        const payload = JSON.stringify({
          pollId,
          optionId: selectedOptionId,
          timestamp: Date.now(),
        });
        const signature = await signer.signMessage(`community-vote|${payload}`);
        await submitCommunityVote({
          address: activeWallet,
          payload,
          signature,
        });
        setVoteMessage(`Vote recorded for poll ${pollId}.`);
        await loadPolls();
      } catch (nextError) {
        setVoteMessage(nextError?.message || "Vote failed.");
      } finally {
        setVotingPollId("");
      }
    },
    [activeWallet, loadPolls, signer, voteSelections],
  );

  const infoItems = React.useMemo(
    () => [
      {
        label: "Contract scope",
        description:
          "The contract manages owner-created events, pre-assigned winners, and winner claims. Community voting is a separate wallet-signed off-chain layer, because the current contract does not implement proposals or on-chain voting.",
      },
      {
        label: "What users see",
        description:
          "Community Center now shows only event cards and voting cards. Owner operations stay in Admin Panel, and Moderator Center opens separately.",
      },
      {
        label: "User actions",
        description:
          "Users can connect a wallet, check whether a wallet has a prize assigned on an event, claim payouts, and cast one wallet-signed vote on each live poll.",
      },
    ],
    [],
  );

  const heroItems = React.useMemo(() => {
    const livePolls = polls.filter((poll) => poll.status === "Live").length;
    const claimableEvents = events.filter((event) => event.claim?.ok).length;

    return [
      {
        label: "Wallet",
        value: activeWallet ? shorten(activeWallet, 8, 4) : "Not connected",
        hint: activeWallet
          ? "Eligible claims and live voting unlocked"
          : "Connect a wallet for claims and voting",
      },
      {
        label: "Events tracked",
        value: eventsLoading ? "Syncing..." : String(events.length),
        hint: eventsLoading
          ? "Reading Community Center contract"
          : "Owner-created on-chain event cards",
      },
      {
        label: "Claimable",
        value: activeWallet
          ? eventsLoading
            ? "Syncing..."
            : String(claimableEvents)
          : "--",
        hint: activeWallet
          ? "Events where your wallet can claim now"
          : "Visible after wallet connection",
      },
      {
        label: "Live polls",
        value: pollsLoading ? "Syncing..." : String(livePolls),
        hint: pollsLoading
          ? "Refreshing community voting feed"
          : "Wallet-signed community votes",
      },
    ];
  }, [activeWallet, events, eventsLoading, polls, pollsLoading]);

  return (
    <section
      className={`community-center rewards-grid biggi-skin${compact ? " is-compact" : ""}`}
    >
      <div className="rewards-grid__surface biggi-token-surface community-center__surface">
        <header className="rewards-grid__header biggi-header panel-header panel-header--community community-center__header">
          <div className="rewards-grid__headline">
            <h2 className="rewards-grid__title">Community Center</h2>
            <p className="rewards-grid__subtitle">
              User-facing hub for event rewards, claim status, and wallet-signed
              community voting in one place.
            </p>
          </div>
          <div className="community-center__header-side">
            <div className="community-center__header-meta">
              <span className="rewards-grid__pill">
                {hasConfig ? "Contract ready" : "Contract missing"}
              </span>
              <span className="rewards-grid__pill">
                {activeWallet ? `Wallet ${shorten(activeWallet, 6, 4)}` : "Wallet disconnected"}
              </span>
            </div>
            <div className="rewards-grid__header-actions community-center__header-actions">
              <button
                type="button"
                className="biggi-btn biggi-btn--ghost"
                onClick={() => loadData()}
              >
                Refresh
              </button>
              <button
                type="button"
                className="biggi-btn biggi-btn--ghost"
                onClick={() => setModeratorOpen(true)}
              >
                Moderator Center
              </button>
              {canOpenAdmin ? (
                <button
                  type="button"
                  className="biggi-btn biggi-btn--ghost"
                  onClick={() => onOpenAdmin?.()}
                >
                  Admin Panel
                </button>
              ) : null}
              <PanelInfoButton
                onClick={() => setInfoOpen(true)}
                ariaLabel="Community center panel info"
              />
            </div>
          </div>
        </header>

        <div className="biggi-hero community-center__hero">
          {heroItems.map((item) => (
            <article key={item.label} className="biggi-hero__card biggi-hero__stat">
              <span className="biggi-hero__label">{item.label}</span>
              <strong className="biggi-hero__value">{item.value}</strong>
              <span className="biggi-hero__hint">{item.hint}</span>
            </article>
          ))}
        </div>

        {!hasConfig ? (
          <Card
            title="Configuration Missing"
            subtitle="Event cards cannot load without address and ABI."
            tone="v"
            className="community-center__alert-card"
          >
            <p className="muted community-center__copy">
              Configure the contract address in <code>src/shared/utils/addresses.js</code>
              {" "}and ensure the ABI export is present.
            </p>
          </Card>
        ) : null}

        {eventsError && hasConfig ? (
          <Card
            title="Load Error"
            subtitle="Read-only contract fetch failed."
            tone="v"
            className="community-center__alert-card"
          >
            <p className="community-center__copy">{eventsError}</p>
          </Card>
        ) : null}

        <div className="community-center__content">
          <Card
            title="Events"
            subtitle={
              eventsLoading
                ? "Loading on-chain events..."
                : "Owner-created event cards backed by the Community Center contract."
            }
            tone="c"
            className="community-center__section-card"
          >
            <div className="community-center__stack">
              {!activeWallet ? (
                <div className="community-center__notice">
                  <p className="muted community-center__copy">
                    Connect a wallet to see whether a prize is assigned to your address
                    and to claim on-chain payouts.
                  </p>
                  <div className="community-center__actions">
                    <button
                      type="button"
                      className="biggi-btn biggi-btn--ghost"
                      onClick={onConnectMetaMask}
                    >
                      Connect MetaMask
                    </button>
                    <button
                      type="button"
                      className="biggi-btn biggi-btn--ghost"
                      onClick={onConnectWalletConnect}
                    >
                      WalletConnect
                    </button>
                  </div>
                </div>
              ) : null}
              {claimMessage ? (
                <div className="community-center__feedback">{claimMessage}</div>
              ) : null}
              {!events.length && !eventsLoading ? (
                <div className="community-center__empty">No events found on-chain.</div>
              ) : null}
              {events.map((event) => {
                const claimLabel = event.claim
                  ? claimReasonLabel(event.claim.reason)
                  : activeWallet
                    ? "No wallet status"
                    : "Connect wallet";
                return (
                  <article key={event.id} className="community-center__entry">
                    <div
                      className={`community-center__entry-top${event.image ? " has-thumb" : ""}`}
                    >
                      {event.image ? (
                        <img
                          src={event.image}
                          alt={event.metadata?.title || event.title || `Event ${event.id}`}
                          className="community-center__thumb"
                        />
                      ) : null}
                      <div className="community-center__entry-copy">
                        <div className="community-center__entry-head">
                          <strong>{event.metadata?.title || event.title || `Event #${event.id}`}</strong>
                          <span
                            className="community-center__status-chip"
                            style={{ "--community-tone": toneColor(event.schedule) }}
                          >
                            {event.schedule}
                          </span>
                          {event.claim?.ok ? (
                            <span
                              className="community-center__status-chip"
                              style={{ "--community-tone": toneColor("Claim available") }}
                            >
                              Claim available
                            </span>
                          ) : null}
                        </div>
                        {event.metadata?.description ? (
                          <p className="muted community-center__copy">
                            {event.metadata.description}
                          </p>
                        ) : null}
                        <ValueRow label="Event ID" value={String(event.id)} />
                        <ValueRow label="Prize total" value={formatPol(event.totalPrize)} />
                        <ValueRow label="Start" value={formatDateTime(event.start)} />
                        <ValueRow label="End" value={formatDateTime(event.end)} />
                        <ValueRow label="Winners" value={String(event.winners.length)} />
                        {event.metadataUri ? (
                          <a
                            href={event.metadataUri}
                            target="_blank"
                            rel="noreferrer"
                            className="muted community-center__meta-link"
                          >
                            Open metadata
                          </a>
                        ) : null}
                      </div>
                    </div>

                    {activeWallet && event.walletStatus?.exists ? (
                      <div className="community-center__wallet-status">
                        <strong>My status</strong>
                        <ValueRow
                          label="Assigned amount"
                          value={formatPol(event.walletStatus.amount)}
                        />
                        <ValueRow label="Claim state" value={claimLabel} />
                        <ValueRow
                          label="Already claimed"
                          value={event.walletStatus.claimed ? "Yes" : "No"}
                        />
                        <div className="community-center__actions">
                          <button
                            type="button"
                            className="biggi-btn biggi-btn--accent"
                            disabled={!event.claim?.ok || claimingEventId === event.id}
                            onClick={() => handleClaim(event.id)}
                          >
                            {claimingEventId === event.id ? "Claiming..." : "Claim prize"}
                          </button>
                        </div>
                      </div>
                    ) : activeWallet ? (
                      <div className="community-center__feedback">
                        This wallet is not assigned to the event payout list.
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </Card>

          <Card
            title="Voting"
            subtitle={
              pollsLoading
                ? "Loading community polls..."
                : "Wallet-signed off-chain voting for the community."
            }
            tone="y"
            className="community-center__section-card"
          >
            <div className="community-center__stack">
              {pollsError ? (
                <div className="community-center__feedback community-center__feedback--error">
                  {pollsError}
                </div>
              ) : null}
              {!activeWallet ? (
                <div className="community-center__notice">
                  <p className="muted community-center__copy">
                    Connect a wallet to cast one vote on each live community poll.
                  </p>
                  <div className="community-center__actions">
                    <button
                      type="button"
                      className="biggi-btn biggi-btn--ghost"
                      onClick={onConnectMetaMask}
                    >
                      Connect MetaMask
                    </button>
                    <button
                      type="button"
                      className="biggi-btn biggi-btn--ghost"
                      onClick={onConnectWalletConnect}
                    >
                      WalletConnect
                    </button>
                  </div>
                </div>
              ) : null}
              {voteMessage ? (
                <div className="community-center__feedback">{voteMessage}</div>
              ) : null}
              {!polls.length && !pollsLoading ? (
                <div className="community-center__empty">
                  No community polls available right now.
                </div>
              ) : null}
              {polls.map((poll) => {
                const selectedOptionId = String(
                  voteSelections[poll.id] || poll.myVoteOptionId || "",
                ).trim();
                const totalVotes = Number(poll.totalVotes || 0);
                const myVote = Array.isArray(poll.options)
                  ? poll.options.find((option) => option.id === poll.myVoteOptionId)
                  : null;
                const canVote =
                  Boolean(activeWallet) &&
                  poll.status === "Live" &&
                  !poll.myVoteOptionId;

                return (
                  <article key={poll.id} className="community-center__entry">
                    <div className="community-center__entry-copy">
                      <div className="community-center__entry-head">
                        <strong>{poll.title || poll.id}</strong>
                        <span
                          className="community-center__status-chip"
                          style={{ "--community-tone": toneColor(poll.status) }}
                        >
                          {poll.status}
                        </span>
                        {poll.linkedEventId != null ? (
                          <span className="muted">Event #{poll.linkedEventId}</span>
                        ) : null}
                      </div>
                      {poll.description ? (
                        <p className="muted community-center__copy">
                          {poll.description}
                        </p>
                      ) : null}
                      <ValueRow label="Opens" value={formatIsoDateTime(poll.startsAt)} />
                      <ValueRow label="Closes" value={formatIsoDateTime(poll.endsAt)} />
                      <ValueRow label="Total votes" value={String(totalVotes)} />
                      {myVote ? <ValueRow label="Your vote" value={myVote.label} /> : null}
                    </div>

                    <div className="community-center__options">
                      {(Array.isArray(poll.options) ? poll.options : []).map((option) => {
                        const optionVotes = Number(option.votes || 0);
                        const percent = totalVotes
                          ? `${Math.round((optionVotes / totalVotes) * 100)}%`
                          : "0%";
                        const isSelected = selectedOptionId === option.id;
                        return (
                          <label
                            key={`${poll.id}-${option.id}`}
                            className={`community-center__option${isSelected ? " is-selected" : ""}${canVote ? "" : " is-disabled"}`}
                          >
                            <input
                              type="radio"
                              name={`poll-${poll.id}`}
                              checked={isSelected}
                              disabled={!canVote}
                              onChange={() =>
                                setVoteSelections((prev) => ({
                                  ...prev,
                                  [poll.id]: option.id,
                                }))
                              }
                            />
                            <div className="community-center__option-copy">
                              <div className="community-center__option-row">
                                <span>{option.label}</span>
                                <span className="muted">
                                  {optionVotes} votes ({percent})
                                </span>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    <div className="community-center__actions">
                      {canVote ? (
                        <button
                          type="button"
                          className="biggi-btn biggi-btn--accent"
                          disabled={
                            !selectedOptionId || String(votingPollId) === String(poll.id)
                          }
                          onClick={() => handleVote(poll.id)}
                        >
                          {String(votingPollId) === String(poll.id)
                            ? "Submitting vote..."
                            : "Vote now"}
                        </button>
                      ) : (
                        <span className="muted">
                          {!activeWallet
                            ? "Connect a wallet to vote."
                            : poll.myVoteOptionId
                              ? "This wallet already voted on the poll."
                              : poll.status === "Upcoming"
                                ? "Voting opens when the poll starts."
                                : "Voting is closed."}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </Card>
        </div>

      <PanelInfoModal
        open={infoOpen}
        title="Community Center"
        items={infoItems}
        onClose={() => setInfoOpen(false)}
      />

      <FullscreenPanel
        open={moderatorOpen}
        title="Moderator Center"
        onClose={() => setModeratorOpen(false)}
        preventScroll
      >
        <MODERATORCENTERPanel
          compact={compact}
          walletAddress={activeWallet}
          onConnectMetaMask={onConnectMetaMask}
          onConnectWalletConnect={onConnectWalletConnect}
        />
      </FullscreenPanel>
      </div>
    </section>
  );
}
