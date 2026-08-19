import { describe, expect, it, vi } from "vitest";

import {
  readActiveTicketChapterIds,
  resolveActiveTicketChapterId,
  resolveRedeemableTicketForActiveChapter,
} from "../src/shared/utils/ticketChapters.js";

function ticketHubWithActiveChapters(activeChapterIds) {
  const active = new Set(activeChapterIds);
  return {
    chapterActive: vi.fn(async (chapterId) => active.has(chapterId)),
  };
}

describe("sequential ticket chapter availability", () => {
  it("selects the only active chapter", async () => {
    const ticketHub = ticketHubWithActiveChapters([3]);

    await expect(readActiveTicketChapterIds(ticketHub)).resolves.toEqual([3]);
    await expect(resolveActiveTicketChapterId(ticketHub)).resolves.toBe(3);
  });

  it("fails closed when no chapter is active", async () => {
    await expect(
      resolveActiveTicketChapterId(ticketHubWithActiveChapters([])),
    ).rejects.toThrow(/No ticket chapter is currently available/);
  });

  it("fails closed when chapters overlap", async () => {
    await expect(
      resolveActiveTicketChapterId(ticketHubWithActiveChapters([1, 2])),
    ).rejects.toThrow(/multiple ticket chapters are active: 1, 2/);
  });

  it("selects a ticket belonging to the only active chapter", async () => {
    const ticketHub = {
      ...ticketHubWithActiveChapters([3]),
      ticketChapterId: vi.fn(async (ticketId) =>
        ticketId === 1002n ? 3 : 2,
      ),
    };

    await expect(
      resolveRedeemableTicketForActiveChapter(ticketHub, [1001n, 1002n]),
    ).resolves.toEqual({ ticketId: 1002n, chapterId: 3 });
  });

  it("rejects tickets from inactive chapters", async () => {
    const ticketHub = {
      ...ticketHubWithActiveChapters([4]),
      ticketChapterId: vi.fn(async () => 2),
    };

    await expect(
      resolveRedeemableTicketForActiveChapter(ticketHub, [1001n]),
    ).rejects.toThrow(/No ticket for the active chapter 4/);
  });
});
