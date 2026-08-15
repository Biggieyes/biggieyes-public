const hre = require("hardhat");

const { ethers, network } = hre;

const ADDRESSES = {
  owner: "0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2",
  token: "0xD73152845Bc5a9b8253ea0100BB10388CC5c0EeD",
  reserve: "0x2786e46e01a5d229118fEdC102267217C7e94574",
  dripDistributor: "0x2E4677729cb8a02aDd752Bcbd2637809C20CBAf3",
  tokenRewards: "0xA455775BBe0BC863f644516147b95Ef5103b29FA",
  marketingSupport: "0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2",
};

const EXPECTED = {
  reserve: ethers.utils.parseUnits("600000000", 18),
  dripDistributor: ethers.utils.parseUnits("200000000", 18),
  tokenRewards: ethers.utils.parseUnits("200000000", 18),
  marketingSupport: ethers.utils.parseUnits("200000000", 18),
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  assert(network.name === "hardhat" && network.config.forking, "Polygon fork is required");

  // Execute calls above the remote fork block so Hardhat uses its configured
  // current hardfork instead of requiring Polygon's complete fork history.
  await network.provider.send("evm_mine");

  const token = await ethers.getContractAt("BiggiToken", ADDRESSES.token);
  const drip = new ethers.Contract(
    ADDRESSES.dripDistributor,
    ["function totalReceived() view returns (uint256)"],
    ethers.provider
  );

  assert((await token.owner()) === ethers.utils.getAddress(ADDRESSES.owner), "Unexpected token owner");
  assert(!(await token.distributed()), "Token is already distributed");
  assert(!(await token.reserveLocked()), "Reserve is already locked");
  assert((await token.totalSupply()).isZero(), "Initial total supply is not zero");

  const before = {
    reserve: await token.balanceOf(ADDRESSES.reserve),
    dripDistributor: await token.balanceOf(ADDRESSES.dripDistributor),
    tokenRewards: await token.balanceOf(ADDRESSES.tokenRewards),
    marketingSupport: await token.balanceOf(ADDRESSES.marketingSupport),
    dripReceived: await drip.totalReceived(),
  };

  await network.provider.request({ method: "hardhat_impersonateAccount", params: [ADDRESSES.owner] });
  await network.provider.send("hardhat_setBalance", [ADDRESSES.owner, "0x3635C9ADC5DEA00000"]);
  const owner = await ethers.getSigner(ADDRESSES.owner);

  const tx = await token.connect(owner).initialDistribute();
  const receipt = await tx.wait();

  assert(await token.distributed(), "distributed flag was not set");
  assert(await token.reserveLocked(), "reserve lock was not set");
  assert(
    (await token.totalSupply()).eq(
      EXPECTED.reserve.add(EXPECTED.dripDistributor).add(EXPECTED.tokenRewards).add(EXPECTED.marketingSupport)
    ),
    "Unexpected total supply"
  );

  for (const key of ["reserve", "dripDistributor", "tokenRewards", "marketingSupport"]) {
    const address = ADDRESSES[key];
    const delta = (await token.balanceOf(address)).sub(before[key]);
    assert(delta.eq(EXPECTED[key]), `Unexpected ${key} allocation: ${delta.toString()}`);
  }

  const dripDelta = (await drip.totalReceived()).sub(before.dripReceived);
  assert(dripDelta.eq(EXPECTED.dripDistributor), "Drip accounting was not synchronized");

  console.log(
    JSON.stringify(
      {
        ok: true,
        forkBlock: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        totalSupply: (await token.totalSupply()).toString(),
        allocations: Object.fromEntries(Object.entries(EXPECTED).map(([key, value]) => [key, value.toString()])),
        dripAccountingDelta: dripDelta.toString(),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
