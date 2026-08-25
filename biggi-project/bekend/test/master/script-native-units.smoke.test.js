const { expect } = require("chai");
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");
const { parseNativeAmount } = require("../../scripts/master/lib/nativeUnits");

describe("BIGGI_MASTER: deployment native-unit parsing", function () {
  it("treats integer configuration as whole POL, not raw wei", function () {
    expect(parseNativeAmount("1")).to.equal(ethers.utils.parseEther("1"));
    expect(parseNativeAmount("5")).to.equal(ethers.utils.parseEther("5"));
  });

  it("accepts decimal POL configuration", function () {
    expect(parseNativeAmount("0.5")).to.equal(ethers.utils.parseEther("0.5"));
    expect(parseNativeAmount("0.001")).to.equal(ethers.utils.parseEther("0.001"));
  });

  it("rejects raw/exponential or negative ambiguous values", function () {
    expect(() => parseNativeAmount("1e18", "TEST_AMOUNT")).to.throw(
      "TEST_AMOUNT must be a non-negative decimal amount in native token units"
    );
    expect(() => parseNativeAmount("-1")).to.throw();
    expect(() => parseNativeAmount("0x1")).to.throw();
  });

  it("keeps the production threshold correction before buyback proxy unpause", function () {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../../scripts/master/activateTokenomicsAfterLiquidity.js"),
      "utf8"
    );
    const thresholdStep = source.indexOf('"BuybackUpkeepProxy.setThreshold(production)"');
    const unpauseStep = source.indexOf('"BuybackUpkeepProxy.setPaused(false)"');

    expect(thresholdStep).to.be.greaterThan(-1);
    expect(unpauseStep).to.be.greaterThan(thresholdStep);
  });
});
