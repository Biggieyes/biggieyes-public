const { expect } = require("chai");
const fs = require("fs");
const path = require("path");

function readNormalized(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n").trim();
}

describe("BIGGI_MASTER: library consistency smoke", function () {
  const sharedLibraries = [
    "BiggiBpsLib.sol",
    "BiggiCapsLib.sol",
    "BiggiErrorsLib.sol",
    "BiggiIdIndexLib.sol",
    "BiggiSwapLib.sol",
  ];

  for (const libraryName of sharedLibraries) {
    it(`keeps ${libraryName} synchronized between CORE and TOKENOMICMAINNET`, async () => {
      const coreLibrary = path.resolve(
        __dirname,
        `../../contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/CORE_LIBRARY/${libraryName}`
      );
      const tokenomicsLibrary = path.resolve(
        __dirname,
        `../../contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/TOKENOMIC_LIBRARY/${libraryName}`
      );

      expect(readNormalized(coreLibrary)).to.equal(readNormalized(tokenomicsLibrary));
    });
  }

  it("keeps distributor and treasury BPS groups summing to 100%", async () => {
    const bpsPath = path.resolve(
      __dirname,
      "../../contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/CORE_LIBRARY/BiggiBpsLib.sol"
    );
    const source = readNormalized(bpsPath);
    const getConst = (name) => {
      const match = source.match(new RegExp(`${name}\\s*=\\s*(\\d+)`));
      if (!match) throw new Error(`Missing ${name}`);
      return Number(match[1]);
    };

    expect(getConst("DEV_BPS") + getConst("DISTRIBUTOR_BPS")).to.equal(10_000);
    expect(
      getConst("DIST_COLLECTION_BPS") +
        getConst("DIST_RESERVE_BPS") +
        getConst("DIST_BUYBACK_BPS") +
        getConst("DIST_TREASURY_BPS") +
        getConst("DIST_COMMUNITY_BPS")
    ).to.equal(10_000);
    expect(
      getConst("TREASURY_TO_REWARDS_BPS") +
        getConst("TREASURY_TO_RESERVE_BPS") +
        getConst("TREASURY_TO_DRIP_BPS")
    ).to.equal(10_000);
  });
});
