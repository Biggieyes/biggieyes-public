const { expect } = require("chai");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const planPath = path.join(__dirname, "../../metadata/main/core-v2-seed-plan.json");
const layoutPath = path.join(__dirname, "../../metadata/main/main-layout.json");

describe("VRF V2 metadata seed plan", function () {
  it("keeps the candidate layout pinned but future chapters unapproved", function () {
    const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
    const rawLayout = fs.readFileSync(layoutPath);
    const layout = JSON.parse(rawLayout.toString("utf8"));
    const hash = crypto.createHash("sha256").update(rawLayout).digest("hex");

    expect(plan.schemaVersion).to.equal(1);
    expect(plan.chainId).to.equal(137);
    expect(plan.layoutFile).to.equal("main-layout.json");
    expect(plan.layoutSha256).to.equal(hash);
    expect(plan.rowsPerChapter).to.equal(550);
    expect(plan.decision).to.equal("defer-future-layouts-until-user-defined");
    expect(plan.broadcastAuthorized).to.equal(false);
    expect(plan.chapters).to.deep.equal([
      { chapterId: 1, source: "historical-onchain-copy" },
      { chapterId: 2, source: "deferred-user-definition" },
      { chapterId: 3, source: "deferred-user-definition" },
      { chapterId: 4, source: "deferred-user-definition" },
      { chapterId: 5, source: "deferred-user-definition" },
    ]);

    expect(layout).to.have.length(550);
    const countByBlock = new Map();
    const backgroundsByBlockMain = new Map();
    layout.forEach((row, index) => {
      expect(row.idx).to.equal(index + 1);
      expect(row.blockIdx).to.be.within(1, 10);
      expect(row.mainId).to.be.within((row.blockIdx - 1) * 10 + 1, row.blockIdx * 10);
      expect(row.background).to.be.within(1, 11 - row.blockIdx);
      countByBlock.set(row.blockIdx, (countByBlock.get(row.blockIdx) || 0) + 1);
      const key = `${row.blockIdx}:${row.mainId}`;
      if (!backgroundsByBlockMain.has(key)) backgroundsByBlockMain.set(key, new Set());
      backgroundsByBlockMain.get(key).add(row.background);
    });

    for (let block = 1; block <= 10; block += 1) {
      expect(countByBlock.get(block)).to.equal(110 - 10 * block);
      for (let mainId = (block - 1) * 10 + 1; mainId <= block * 10; mainId += 1) {
        expect(backgroundsByBlockMain.get(`${block}:${mainId}`)?.size).to.equal(11 - block);
      }
    }
  });
});
