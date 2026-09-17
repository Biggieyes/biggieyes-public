import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Gallery from "../src/components/Gallery.jsx";
import { countGalleryAssetsByChapter } from "../src/shared/services/gallery/gallery.chapters.js";

vi.mock("../src/providers/ContractsContext.js", () => ({
  useOptionalContracts: () => null,
}));
vi.mock("../src/providers/Web3Context.js", () => ({
  useOptionalWeb3: () => null,
}));
vi.mock(
  "../src/shared/services/gallery/gallery.chapters.js",
  async (importOriginal) => {
    const actual = await importOriginal();
    return {
      ...actual,
      countGalleryAssetsByChapter: vi.fn(actual.countGalleryAssetsByChapter),
    };
  },
);
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.mocked(countGalleryAssetsByChapter).mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Gallery empty-input consistency", () => {
  it.each([
    {
      label: "omitted items",
      address: "0x0000000000000000000000000000000000000001",
    },
    {
      label: "null items",
      address: "0x0000000000000000000000000000000000000001",
      items: null,
    },
    { label: "disconnected wallet", items: [] },
  ])(
    "does not recalculate chapter counts on unrelated renders: $label",
    ({ label: _label, ...props }) => {
      const { rerender } = render(<Gallery {...props} useProvidedOnly />);
      const calls = vi.mocked(countGalleryAssetsByChapter).mock.calls.length;
      expect(calls).toBeGreaterThan(0);
      rerender(<Gallery {...props} useProvidedOnly compact />);
      expect(countGalleryAssetsByChapter).toHaveBeenCalledTimes(calls);
    },
  );
});
