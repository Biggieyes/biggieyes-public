import { CORE_CHAPTERS } from "./addresses.js";

const CHAPTER_STATE_CACHE_TTL_MS = 5_000;
const chapterStateCache = new Map();
let ticketHubObjectKeys = new WeakMap();
let ticketHubObjectKeySequence = 0;

const getTicketHubCacheKey = (ticketHub) => {
  const address = ticketHub?.target || ticketHub?.address;
  if (address) return String(address).toLowerCase();
  if (
    (typeof ticketHub === "object" && ticketHub !== null) ||
    typeof ticketHub === "function"
  ) {
    if (!ticketHubObjectKeys.has(ticketHub)) {
      ticketHubObjectKeySequence += 1;
      ticketHubObjectKeys.set(
        ticketHub,
        `ticket-hub:${ticketHubObjectKeySequence}`,
      );
    }
    return ticketHubObjectKeys.get(ticketHub);
  }
  return "ticket-hub:missing";
};

export function clearTicketChapterStateCache() {
  chapterStateCache.clear();
  ticketHubObjectKeys = new WeakMap();
  ticketHubObjectKeySequence = 0;
}

export async function readTicketChapterStates(
  ticketHub,
  { force = false } = {},
) {
  if (typeof ticketHub?.chapterActive !== "function") {
    throw new Error("TicketHub does not expose chapterActive().");
  }

  const cacheKey = getTicketHubCacheKey(ticketHub);
  const now = Date.now();
  const cached = chapterStateCache.get(cacheKey);
  if (!force && cached && (cached.inFlight || cached.expiresAt > now)) {
    return cached.promise;
  }

  const promise = Promise.all(
    CORE_CHAPTERS.map(async (chapter) => ({
      chapterId: chapter.chapterId,
      active: Boolean(await ticketHub.chapterActive(chapter.chapterId)),
    })),
  );
  const entry = {
    promise,
    inFlight: true,
    expiresAt: Number.POSITIVE_INFINITY,
  };
  chapterStateCache.set(cacheKey, entry);

  try {
    const states = await promise;
    entry.inFlight = false;
    entry.expiresAt = Date.now() + CHAPTER_STATE_CACHE_TTL_MS;
    return states;
  } catch (error) {
    if (chapterStateCache.get(cacheKey) === entry) {
      chapterStateCache.delete(cacheKey);
    }
    throw error;
  }
}

export async function readActiveTicketChapterIds(ticketHub, options) {
  const states = await readTicketChapterStates(ticketHub, options);

  return states
    .filter((chapter) => chapter.active)
    .map((chapter) => chapter.chapterId);
}

export async function resolveActiveTicketChapterId(ticketHub) {
  const activeChapterIds = await readActiveTicketChapterIds(ticketHub);
  if (activeChapterIds.length === 0) {
    throw new Error("No ticket chapter is currently available for minting.");
  }
  if (activeChapterIds.length > 1) {
    throw new Error(
      `Minting is disabled because multiple ticket chapters are active: ${activeChapterIds.join(", ")}.`,
    );
  }
  return activeChapterIds[0];
}

export async function resolveRedeemableTicketForActiveChapter(
  ticketHub,
  ticketIds,
) {
  if (typeof ticketHub?.ticketChapterId !== "function") {
    throw new Error("TicketHub does not expose ticketChapterId().");
  }

  const chapterId = await resolveActiveTicketChapterId(ticketHub);
  const normalizedIds = [];
  const seen = new Set();
  for (const raw of Array.isArray(ticketIds) ? ticketIds : []) {
    try {
      const ticketId = BigInt(raw?.toString?.() ?? raw);
      const key = ticketId.toString();
      if (!seen.has(key)) {
        seen.add(key);
        normalizedIds.push(ticketId);
      }
    } catch {
      // Ignore malformed reader or cache entries.
    }
  }

  const chapters = await Promise.all(
    normalizedIds.map(async (ticketId) => ({
      ticketId,
      chapterId: Number(await ticketHub.ticketChapterId(ticketId)),
    })),
  );
  const match = chapters.find((ticket) => ticket.chapterId === chapterId);
  if (!match) {
    throw new Error(
      `No ticket for the active chapter ${chapterId} is owned by this wallet.`,
    );
  }
  return match;
}
