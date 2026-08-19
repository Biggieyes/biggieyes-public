import { CORE_CHAPTERS } from "./addresses.js";

export async function readActiveTicketChapterIds(ticketHub) {
  if (typeof ticketHub?.chapterActive !== "function") {
    throw new Error("TicketHub does not expose chapterActive().");
  }

  const states = await Promise.all(
    CORE_CHAPTERS.map(async (chapter) => ({
      chapterId: chapter.chapterId,
      active: Boolean(await ticketHub.chapterActive(chapter.chapterId)),
    })),
  );

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
