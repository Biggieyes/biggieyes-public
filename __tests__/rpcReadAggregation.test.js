import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearTicketChapterStateCache,
  readActiveTicketChapterIds,
  readTicketChapterStates,
} from "../src/shared/utils/ticketChapters.js";
import {
  clearFrontendSnapshotCache,
  getFrontendSnapshotLiteActive,
} from "../src/shared/utils/contract.js";

describe("read-only RPC aggregation", () => {
  beforeEach(() => {
    clearTicketChapterStateCache();
    clearFrontendSnapshotCache();
  });

  it("deduplicates concurrent and short-lived TicketHub chapter reads", async () => {
    const ticketHub = {
      target: "0x0000000000000000000000000000000000000101",
      chapterActive: vi.fn(async (chapterId) => chapterId === 1),
    };

    const [states, activeIds] = await Promise.all([
      readTicketChapterStates(ticketHub),
      readActiveTicketChapterIds(ticketHub),
    ]);

    expect(states).toHaveLength(5);
    expect(activeIds).toEqual([1]);
    expect(ticketHub.chapterActive).toHaveBeenCalledTimes(5);

    await readTicketChapterStates(ticketHub);
    expect(ticketHub.chapterActive).toHaveBeenCalledTimes(5);

    await readTicketChapterStates(ticketHub, { force: true });
    expect(ticketHub.chapterActive).toHaveBeenCalledTimes(10);
  });

  it("uses the deployed BiggiMainReader aggregate and maps its full result", async () => {
    const prices = Array.from({ length: 10 }, (_, index) => BigInt(index + 1));
    const minted = Array.from({ length: 10 }, (_, index) => BigInt(index));
    const backgrounds = Array(10).fill(0n);
    const reader = {
      target: "0x0000000000000000000000000000000000000102",
      getFrontendSnapshot: vi.fn(async () => [
        500n,
        50n,
        7n,
        prices,
        minted,
        backgrounds,
        2n,
        3n,
        false,
        4n,
      ]),
    };

    const first = await getFrontendSnapshotLiteActive(reader, {
      chapterId: 1,
      force: true,
    });
    const second = await getFrontendSnapshotLiteActive(reader, {
      chapterId: 1,
    });

    expect(first).toEqual([500n, 50n, 7n, prices, minted, backgrounds, 4n]);
    expect(second).toEqual(first);
    expect(reader.getFrontendSnapshot).toHaveBeenCalledTimes(1);
  });
});
