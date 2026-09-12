import fs from "node:fs";
import { parse } from "@babel/parser";
import { describe, expect, it, vi } from "vitest";

function declaration(file, name) {
  const source = fs.readFileSync(new URL(file, import.meta.url), "utf8");
  const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
  let found;
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "VariableDeclarator" && node.id?.name === name)
      found = node;
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") walk(value);
    }
  };
  walk(ast);
  if (!found) throw new Error(`Missing ${name}`);
  return { source, node: found };
}

describe("audit integration invariants", () => {
  it.each([
    ["confirmed", "Claim confirmed."],
    ["cancelled", "Claim cancelled in wallet."],
    ["failed", "Claim failed. Check wallet activity before retrying."],
    [undefined, "No claim transaction was confirmed."],
  ])(
    "the actual RewardsPanel callback displays %s, never a false success",
    async (status, expected) => {
      const { source, node } = declaration(
        "../src/features/rewards/REWARDSPanel.jsx",
        "handleClaim",
      );
      const callback = node.init.arguments[0];
      const onClaim = vi
        .fn()
        .mockResolvedValue(status ? { status } : undefined);
      const setClaimMessage = vi.fn();
      const setClaiming = vi.fn();
      // Exercise the real callback body without booting unrelated RPC readers.
      const run = new Function(
        "onClaim",
        "setClaimMessage",
        "setClaiming",
        `return (${source.slice(callback.start, callback.end)});`,
      )(onClaim, setClaimMessage, setClaiming);
      await run();
      expect(onClaim).toHaveBeenCalledOnce();
      expect(setClaimMessage).toHaveBeenLastCalledWith(expected);
      expect(setClaiming).toHaveBeenLastCalledWith(false);
    },
  );

  it("invalidates the memoized collection panel when prices, counts or info state change", () => {
    const { node } = declaration("../src/app/AppCore.jsx", "renderActivePanel");
    const dependencies = node.init.arguments[1].elements.map(
      (entry) => entry.name,
    );
    expect(dependencies).toEqual(
      expect.arrayContaining([
        "blockPrices",
        "blockMintCounts",
        "autoOpenInfoPanel",
      ]),
    );
  });
});
