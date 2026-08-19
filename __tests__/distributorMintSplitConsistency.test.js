import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  BPS_DENOM,
  DEV_BPS,
  DISTRIBUTOR_BPS,
  DIST_BUYBACK_BPS,
  DIST_COLLECTION_BPS,
  DIST_COMMUNITY_BPS,
  DIST_RESERVE_BPS,
  DIST_TREASURY_BPS,
} from "../src/shared/bps.js";

const BPS_LIBS = [
  "biggi-project/bekend/contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/CORE_LIBRARY/BiggiBpsLib.sol",
  "biggi-project/bekend/contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/TOKENOMIC_LIBRARY/BiggiBpsLib.sol",
];

const JS_BPS = {
  BPS_DENOM,
  DEV_BPS,
  DISTRIBUTOR_BPS,
  DIST_COLLECTION_BPS,
  DIST_RESERVE_BPS,
  DIST_BUYBACK_BPS,
  DIST_TREASURY_BPS,
  DIST_COMMUNITY_BPS,
};

function readConstant(source, name) {
  const match = source.match(
    new RegExp(`constant\\s+${name}\\s*=\\s*([0-9_]+)\\s*;`),
  );
  if (!match) throw new Error(`Missing Solidity constant ${name}`);
  return Number(match[1].replace(/_/g, ""));
}

describe("mint native distributor split consistency", () => {
  it.each(BPS_LIBS)(
    "keeps frontend BPS constants aligned with %s",
    (sourcePath) => {
      const source = readFileSync(sourcePath, "utf8");

      for (const [name, value] of Object.entries(JS_BPS)) {
        expect(readConstant(source, name)).toBe(value);
      }
    },
  );

  it("preserves the full gross mint routing percentages", () => {
    expect(DEV_BPS + DISTRIBUTOR_BPS).toBe(BPS_DENOM);
    expect(
      DIST_COLLECTION_BPS +
        DIST_RESERVE_BPS +
        DIST_BUYBACK_BPS +
        DIST_TREASURY_BPS +
        DIST_COMMUNITY_BPS,
    ).toBe(BPS_DENOM);

    const effective = (bps) => (DISTRIBUTOR_BPS * bps) / BPS_DENOM;

    expect(effective(DIST_COLLECTION_BPS)).toBe(1500);
    expect(effective(DIST_RESERVE_BPS)).toBe(2100);
    expect(effective(DIST_BUYBACK_BPS)).toBe(1200);
    expect(effective(DIST_TREASURY_BPS)).toBe(600);
    expect(effective(DIST_COMMUNITY_BPS)).toBe(600);
  });
});
