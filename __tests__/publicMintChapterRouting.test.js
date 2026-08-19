import { beforeEach, describe, expect, it, vi } from "vitest";

const contractMocks = vi.hoisted(() => ({
  getChapterMain2: vi.fn(),
  getReadOnlyChapterMain2: vi.fn(),
}));

vi.mock("@/shared/utils/contract", () => ({
  fromWei: vi.fn((value) => String(value)),
  getChapterMain2: contractMocks.getChapterMain2,
  getReadOnlyChapterMain2: contractMocks.getReadOnlyChapterMain2,
}));

import {
  mintPublic,
  mintPublicWithBiggi,
} from "../src/shared/services/main2Service.js";

describe("public mint chapter routing", () => {
  beforeEach(() => {
    contractMocks.getChapterMain2.mockReset();
    contractMocks.getReadOnlyChapterMain2.mockReset();
  });

  it("routes native and BIGGI public mints through the requested chapter", async () => {
    const wait = vi.fn().mockResolvedValue({ status: 1 });
    const contract = {
      mintPublic: vi.fn().mockResolvedValue({ wait }),
      mintPublicWithBiggi: vi.fn().mockResolvedValue({ wait }),
    };
    contractMocks.getChapterMain2.mockResolvedValue(contract);

    await mintPublic(3, 41, 123n);
    await mintPublicWithBiggi(3, 42);

    expect(contractMocks.getChapterMain2).toHaveBeenNthCalledWith(1, 3);
    expect(contractMocks.getChapterMain2).toHaveBeenNthCalledWith(2, 3);
    expect(contract.mintPublic).toHaveBeenCalledWith(41, { value: 123n });
    expect(contract.mintPublicWithBiggi).toHaveBeenCalledWith(42);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it("rejects a write without an explicit chapter", async () => {
    await expect(mintPublic(undefined, 1, 1n)).rejects.toThrow(
      "A valid CORE chapterId is required.",
    );
    expect(contractMocks.getChapterMain2).not.toHaveBeenCalled();
  });
});
