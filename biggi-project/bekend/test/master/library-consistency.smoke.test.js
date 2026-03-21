const { expect } = require("chai");
const fs = require("fs");
const path = require("path");

function readNormalized(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n").trim();
}

describe("BIGGI_MASTER: library consistency smoke", function () {
  it("keeps BiggiCapsLib synchronized between root and TOKENOMICMAINNET", async () => {
    const rootCaps = path.resolve(
      __dirname,
      "../../contracts/default_workspace (10)/contracts/BIGGI_MASTER/Library/BiggiCapsLib.sol"
    );
    const tokenomicsCaps = path.resolve(
      __dirname,
      "../../contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/Library/BiggiCapsLib.sol"
    );

    expect(readNormalized(rootCaps)).to.equal(readNormalized(tokenomicsCaps));
  });
});
