import * as React from "react";
import { Contract } from "ethers";
import { BiggiCommunityCenter as COMMUNITYCENTERAbi } from "@/config/abi/index.js";
import { ADDR, getROProvider } from "@/shared/utils/contract.js";
import { fetchCommunityPolls } from "@/shared/services/communityVotingApi.js";
import {
  ZERO_ADDRESS,
  isRealAddress,
} from "@/features/tokenomics/utils/amountFormatting.js";

const COMMUNITY_CENTER_ABI = Array.isArray(COMMUNITYCENTERAbi)
  ? COMMUNITYCENTERAbi
  : [];

const sameAddress = (a, b) =>
  String(a || "")
    .trim()
    .toLowerCase() ===
  String(b || "")
    .trim()
    .toLowerCase();

export function resolveCommunityCenterAddress() {
  const candidates = [];
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      candidates.push(import.meta.env.VITE_ADDR_COMMUNITY_CENTER);
      candidates.push(import.meta.env.VITE_ADDR_COMMUNITY);
    }
  } catch {
    // ignore env lookup failures
  }
  try {
    if (typeof process !== "undefined" && process.env) {
      candidates.push(process.env.VITE_ADDR_COMMUNITY_CENTER);
      candidates.push(process.env.VITE_ADDR_COMMUNITY);
    }
  } catch {
    // ignore env lookup failures
  }
  candidates.push(
    ADDR?.COMMUNITY_CENTER,
    ADDR?.COMMUNITYCENTER,
    ADDR?.BIGGI_COMMUNITY_CENTER,
    ADDR?.COMMUNITY,
  );
  return (
    candidates.find(
      (value) => isRealAddress(value) && !sameAddress(value, ZERO_ADDRESS),
    ) || null
  );
}

const toNumber = (value) => {
  try {
    if (typeof value === "bigint") return Number(value);
    const next = Number(value?.toString?.() ?? value);
    return Number.isFinite(next) ? next : 0;
  } catch {
    return 0;
  }
};

const toBigInt = (value) => {
  try {
    if (value == null) return 0n;
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && Number.isFinite(value)) {
      return BigInt(Math.max(0, Math.trunc(value)));
    }
    const text = String(value?.toString?.() ?? value).trim();
    if (/^\d+$/.test(text)) return BigInt(text);
  } catch {
    // ignore parse failure
  }
  return 0n;
};

const parseEvent = (raw, fallbackId) => {
  const arr = Array.isArray(raw) ? raw : [];
  return {
    id: toNumber(fallbackId),
    title: String(raw?.title ?? arr[0] ?? "").trim(),
    start: toNumber(raw?.start ?? arr[2]),
    end: toNumber(raw?.end ?? arr[3]),
    totalPrize: raw?.totalPrize_ ?? raw?.totalPrize ?? arr[4] ?? 0n,
    locked: raw?.locked ?? arr[5] ?? 0n,
    exists: Boolean(raw?.exists ?? arr[6]),
  };
};

const parseUserStatus = (raw) => {
  const arr = Array.isArray(raw) ? raw : [];
  return {
    amount: raw?.amount ?? arr[0] ?? 0n,
    claimed: Boolean(raw?.claimed ?? arr[1]),
    exists: Boolean(raw?.exists ?? arr[2]),
  };
};

const parseCanClaim = (raw) => {
  const arr = Array.isArray(raw) ? raw : [];
  return {
    ok: Boolean(raw?.ok ?? arr[0]),
    reason: toNumber(raw?.reason ?? arr[1]),
    amount: raw?.amount ?? arr[2] ?? 0n,
  };
};

export const hasCommunityAssignment = (event) =>
  toBigInt(event?.walletStatus?.amount) > 0n;

const scheduleStatus = (event) => {
  const now = Math.floor(Date.now() / 1000);
  if (!event?.exists) return "Missing";
  if (event.start && now < event.start) return "Upcoming";
  if (event.end && now > event.end) return "Finished";
  return "Live";
};

const emptySnapshot = (address = resolveCommunityCenterAddress()) => ({
  address,
  configured: Boolean(address && COMMUNITY_CENTER_ABI.length),
  paused: null,
  owner: null,
  distributor: null,
  poolBalance: 0n,
  totalLocked: 0n,
  eventsCount: 0,
  liveEvents: 0,
  upcomingEvents: 0,
  finishedEvents: 0,
  assignedEvents: 0,
  claimableEvents: 0,
  claimedEvents: 0,
  assignedAmount: 0n,
  claimableAmount: 0n,
  pollsCount: 0,
  livePolls: 0,
  myVotes: 0,
  events: [],
  polls: [],
  updatedAt: null,
});

const safeCall = async (fn, fallback = null) => {
  try {
    return await fn();
  } catch {
    return fallback;
  }
};

export default function useCommunityCenterUserSnapshot({
  walletAddress = "",
  includePolls = true,
  enabled = true,
} = {}) {
  const address = React.useMemo(() => resolveCommunityCenterAddress(), []);
  const [snapshot, setSnapshot] = React.useState(() => emptySnapshot(address));
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(async () => {
    const base = emptySnapshot(address);
    if (!enabled) {
      setSnapshot(base);
      setError(null);
      return base;
    }
    if (!base.configured) {
      setSnapshot(base);
      setError(null);
      return base;
    }

    setLoading(true);
    setError(null);
    try {
      const provider = getROProvider();
      const contract = new Contract(address, COMMUNITY_CENTER_ABI, provider);
      const [
        eventIdsRaw,
        paused,
        owner,
        distributor,
        poolBalance,
        totalLocked,
      ] = await Promise.all([
        safeCall(() => contract.getEvents(), []),
        safeCall(() => contract.paused(), null),
        safeCall(() => contract.owner(), null),
        safeCall(() => contract.distributor(), null),
        safeCall(() => contract.poolBalance(), 0n),
        safeCall(() => contract.totalLocked(), 0n),
      ]);

      const eventIds = Array.isArray(eventIdsRaw) ? eventIdsRaw : [];
      const events = await Promise.all(
        eventIds.map(async (eventId) => {
          const event = parseEvent(
            await safeCall(() => contract.getEvent(eventId), null),
            eventId,
          );
          const [userStatusRaw, canClaimRaw] = walletAddress
            ? await Promise.all([
                safeCall(
                  () => contract.userStatus(eventId, walletAddress),
                  null,
                ),
                safeCall(() => contract.canClaim(eventId, walletAddress), null),
              ])
            : [null, null];
          const walletStatus = userStatusRaw
            ? parseUserStatus(userStatusRaw)
            : null;
          const claim = canClaimRaw ? parseCanClaim(canClaimRaw) : null;
          return {
            ...event,
            schedule: scheduleStatus(event),
            walletStatus,
            claim,
          };
        }),
      );

      let polls = [];
      if (includePolls) {
        const pollJson = await safeCall(
          () => fetchCommunityPolls({ walletAddress }),
          null,
        );
        polls = Array.isArray(pollJson?.polls) ? pollJson.polls : [];
      }

      const next = {
        ...base,
        paused,
        owner,
        distributor,
        poolBalance: toBigInt(poolBalance),
        totalLocked: toBigInt(totalLocked),
        eventsCount: events.length,
        liveEvents: events.filter((event) => event.schedule === "Live").length,
        upcomingEvents: events.filter((event) => event.schedule === "Upcoming")
          .length,
        finishedEvents: events.filter((event) => event.schedule === "Finished")
          .length,
        assignedEvents: events.filter(hasCommunityAssignment).length,
        claimableEvents: events.filter((event) => event.claim?.ok).length,
        claimedEvents: events.filter((event) => event.walletStatus?.claimed)
          .length,
        assignedAmount: events.reduce(
          (sum, event) => sum + toBigInt(event.walletStatus?.amount),
          0n,
        ),
        claimableAmount: events.reduce(
          (sum, event) =>
            sum + (event.claim?.ok ? toBigInt(event.claim.amount) : 0n),
          0n,
        ),
        pollsCount: polls.length,
        livePolls: polls.filter((poll) => poll.status === "Live").length,
        myVotes: polls.filter((poll) => poll.myVoteOptionId).length,
        events,
        polls,
        updatedAt: Date.now(),
      };
      setSnapshot(next);
      return next;
    } catch (err) {
      setError(err);
      setSnapshot(base);
      return base;
    } finally {
      setLoading(false);
    }
  }, [address, enabled, includePolls, walletAddress]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    snapshot,
    loading,
    error,
    refresh,
    address,
    configured: snapshot.configured,
  };
}
